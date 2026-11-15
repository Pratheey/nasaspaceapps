"""Build stations.json (contracts/app_data.md section 4).

Inputs:
  - Daniel's GPS files in gps/processed/ (contracts/gps.md):
      stations.csv   station, lat, lon, height_m, role, steps_removed
      gps_los.csv    station, date, los_m, los_rel_ref_m, sigma_m   (daily, NISAR LOS, tied to P304)
      gps_fits.csv   station, window_start, window_end, component, trend/amp/peak columns
      residuals.csv  pair, station, nisar_los_m, gps_los_m, residual_m, unwrap_flag
  - for vertical, gps_cleaned_enu.csv and the H-13 GPS epoch sampling method
  - this lane's per-cell results (cumulative series and fit at the station's cell)

Output per station: where it is, its app cell, the GPS series at the NISAR dates, the NISAR
series at that cell, both fits, and the residual summary. The reference station (P304) is
not a check, so its residuals are null. Only stations inside the app bbox are listed (D5);
the others still count as held-out checks in Daniel's residuals.csv.

The app needs all four files in public/data/ or it silently falls back to the samples, so
without the GPS files the real map will not show at all.
"""
from __future__ import annotations

import csv
from pathlib import Path

import numpy as np

from . import fit as fit_model, seasonal as seasonal_model, timebase
from .export import floats
from .regrid import AppGrid, cell_index

GPS_FILES = ("stations.csv", "gps_los.csv", "gps_fits.csv", "residuals.csv")
VERTICAL_GPS_FILES = ("stations.csv", "gps_cleaned_enu.csv")


def gps_files_present(gps_dir, component: str = "los") -> bool:
    files = VERTICAL_GPS_FILES if component == "up" else GPS_FILES
    return gps_dir is not None and all((Path(gps_dir) / f).is_file() for f in files)


def _read(path) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as fh:  # -sig: tolerate a Windows BOM
        return [{k.strip(): (v or "").strip() for k, v in row.items()} for row in csv.DictReader(fh)]


def _num(s):
    """'' or 'nan' -> None, else float."""
    if s is None or s == "":
        return None
    v = float(s)
    return v if np.isfinite(v) else None


def _r4(v):
    return None if v is None else round(float(v), 4)


def load_gps(gps_dir) -> dict:
    d = Path(gps_dir)
    los: dict = {}
    for row in _read(d / "gps_los.csv"):
        los.setdefault(row["station"], {})[row["date"][:10]] = (_num(row["los_m"]), _num(row.get("sigma_m")))
    fits: dict = {}
    for row in _read(d / "gps_fits.csv"):
        fits.setdefault(row["station"], {})[row["component"]] = row
    residuals: dict = {}
    for row in _read(d / "residuals.csv"):
        residuals.setdefault(row["station"], []).append(row)
    return {"stations": _read(d / "stations.csv"), "los": los, "fits": fits, "residuals": residuals}


def load_vertical_gps(gps_dir, dates, reference_station: str) -> dict:
    """Sample GPS Up with the same cleaned seven-day medians as the H-13 check."""
    import pandas as pd

    from radar.vertical import gps_positions

    directory = Path(gps_dir)
    station_rows = _read(directory / "stations.csv")
    enu = pd.read_csv(directory / "gps_cleaned_enu.csv", parse_dates=["date"])
    enu = enu.set_index(["station", "date"]).sort_index()
    available = set(enu.index.get_level_values("station"))
    if reference_station not in available:
        raise ValueError(f"Vertical GPS is missing reference station {reference_station}")
    names = [row["station"] for row in station_rows if row["station"] in available]
    positions = gps_positions(enu, dates, sorted(set(names) | {reference_station}))
    reference_up = positions[reference_station][:, 2]
    up = {}
    for name in names:
        relative = positions[name][:, 2] - reference_up
        observed = np.flatnonzero(np.isfinite(relative))
        if observed.size:
            relative -= relative[observed[0]]
        up[name] = relative
    return {"stations": station_rows, "up": up}


def _residual_summary(rows) -> dict:
    net = next((r for r in rows if r["pair"].lower() == "net"), None)
    pairs = [r for r in rows if r["pair"].lower() != "net"]
    flagged = sorted(int(r["pair"]) for r in pairs if r.get("unwrap_flag") in ("1", "1.0", "true", "True"))
    good = [_num(r["residual_m"]) for r in pairs if int(r["pair"]) not in flagged]
    good = [v for v in good if v is not None]
    return {
        "net_m": _r4(_num(net["residual_m"])) if net else None,
        "pairs_rms_m": _r4(np.sqrt(np.mean(np.square(good)))) if good else None,
        "n_pairs": len(good),
        "unwrap_flagged_pairs": flagged,
    }


def _vertical_comparison(gps_up, radar_up, dates, alpha):
    """Compare matched-date GPS Up with the same radar cell used in the app."""
    t = timebase.to_years(dates)
    gps_delta = np.diff(gps_up)
    result = fit_model.fit_pairs(gps_delta, t[:-1], t[1:])
    season = seasonal_model.evaluate(result, alpha)
    gps_fit = {
        "trend_m_per_yr": result.B,
        "trend_sigma_m_per_yr": result.sigma_B,
        "amp_m": season.amp,
        "amp_sigma_m": season.amp_sigma,
        "peak_month": season.peak_month,
    }
    residual = np.diff(radar_up) - gps_delta
    good = residual[np.isfinite(residual)]
    net = (radar_up[-1] - radar_up[0]) - (gps_up[-1] - gps_up[0])
    return gps_fit, {
        "net_m": _r4(_num(net)),
        "pairs_rms_m": _r4(np.sqrt(np.mean(np.square(good)))) if good.size else None,
        "n_pairs": int(good.size),
        "unwrap_flagged_pairs": [],
    }


def build_stations(gps: dict, *, dates, grid: AppGrid, cumulative, fit, seasonal, c,
                   is_synthetic: bool, placeholder_coords: bool = False,
                   component: str = "los", alpha: float = seasonal_model.ALPHA) -> dict:
    """cumulative: (n_dates, ncells); fit/seasonal/c: per-cell results from run.py."""
    iso = [d.isoformat() for d in dates]
    out = []
    for st in gps["stations"]:
        name = st["station"]
        lat, lon = float(st["lat"]), float(st["lon"])
        idx = int(cell_index([lat], [lon], grid)[0])
        if idx < 0:
            continue   # D5: stations outside the app bbox appear only in residuals.csv

        radar_values = cumulative[:, idx]
        if component == "up":
            if not np.isfinite(radar_values[1:]).any():
                continue
            gps_up = gps["up"].get(name, np.full(len(iso), np.nan))
            shared = np.flatnonzero(np.isfinite(radar_values) & np.isfinite(gps_up))
            if shared.size:
                start = shared[0]
                gps_values = floats(gps_up + (radar_values[start] - gps_up[start]))
            else:
                gps_values = [None] * len(iso)
            gps_sigmas = [None] * len(iso)  # no uncertainty series for these GPS medians
            gf, residuals = _vertical_comparison(gps_up, radar_values, dates, alpha)
        else:
            daily = gps["los"].get(name, {})
            gps_vals = [daily.get(d, (None, None)) for d in iso]
            gps_values = [_r4(v) for v, _ in gps_vals]
            gps_sigmas = [_r4(s) for _, s in gps_vals]
            gf = gps["fits"].get(name, {}).get("los", {})
            residuals = _residual_summary(gps["residuals"].get(name, []))
        pm = _num(gf.get("peak_month"))
        sig_known = bool(seasonal.fitted[idx])

        entry = {
            "station": name, "lat": lat, "lon": lon, "role": st.get("role", "held_out"),
            "cell_index": idx,
            # The v1.2 vertical contract retains the legacy los_m key.
            "gps": {"dates": iso, "los_m": gps_values, "sigma_m": gps_sigmas},
            "nisar": {"dates": iso, "los_m": floats(radar_values)},
            "gps_fit": {
                "trend_m_per_yr": _r4(_num(gf.get("trend_m_per_yr"))),
                "trend_sigma_m_per_yr": _r4(_num(gf.get("trend_sigma_m_per_yr"))),
                "amp_m": _r4(_num(gf.get("amp_m"))),
                "amp_sigma_m": _r4(_num(gf.get("amp_sigma_m"))),
                "peak_month": None if pm is None else int(pm),
            },
            "nisar_fit": {
                "trend_m_per_yr": _r4(_num(fit.B[idx])),
                "trend_sigma_m_per_yr": _r4(_num(fit.sigma_B[idx])),
                "amp_m": _r4(_num(seasonal.amp[idx])),
                "amp_sigma_m": _r4(_num(seasonal.amp_sigma[idx])),
                "seasonal_significant": bool(seasonal.significant[idx]) if sig_known else None,
                "c_m": _r4(_num(c[idx])),
                "a_m": _r4(_num(fit.a[idx])),
                "b_m": _r4(_num(fit.b[idx])),
            },
            "residuals": None if st.get("role") == "reference" else residuals,
        }
        if placeholder_coords:
            entry["coords_are_placeholder"] = True
        out.append(entry)
    return {"is_synthetic": bool(is_synthetic), "stations": out}
