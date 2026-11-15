"""Build stations.json (contracts/app_data.md section 4).

Inputs:
  - Daniel's GPS files in gps/processed/ (contracts/gps.md):
      stations.csv   station, lat, lon, height_m, role, steps_removed
      gps_los.csv    station, date, los_m, los_rel_ref_m, sigma_m   (daily, NISAR LOS, tied to P304)
      gps_fits.csv   station, window_start, window_end, component, trend/amp/peak columns
      residuals.csv  pair, station, nisar_los_m, gps_los_m, residual_m, unwrap_flag
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

from .export import floats
from .regrid import AppGrid, cell_index

GPS_FILES = ("stations.csv", "gps_los.csv", "gps_fits.csv", "residuals.csv")


def gps_files_present(gps_dir) -> bool:
    return gps_dir is not None and all((Path(gps_dir) / f).exists() for f in GPS_FILES)


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


def build_stations(gps: dict, *, dates, grid: AppGrid, cumulative, fit, seasonal, c,
                   is_synthetic: bool, placeholder_coords: bool = False) -> dict:
    """cumulative: (n_dates, ncells); fit/seasonal/c: per-cell results from run.py."""
    iso = [d.isoformat() for d in dates]
    out = []
    for st in gps["stations"]:
        name = st["station"]
        lat, lon = float(st["lat"]), float(st["lon"])
        idx = int(cell_index([lat], [lon], grid)[0])
        inside = idx >= 0
        if not inside:
            continue   # D5: stations outside the app bbox appear only in residuals.csv

        daily = gps["los"].get(name, {})
        gps_vals = [daily.get(d, (None, None)) for d in iso]   # decimated to the NISAR dates

        gf = gps["fits"].get(name, {}).get("los", {})
        pm = _num(gf.get("peak_month"))
        sig_known = bool(inside and seasonal.fitted[idx])

        entry = {
            "station": name, "lat": lat, "lon": lon, "role": st.get("role", "held_out"),
            "cell_index": idx if inside else None,
            "gps": {"dates": iso, "los_m": [_r4(v) for v, _ in gps_vals], "sigma_m": [_r4(s) for _, s in gps_vals]},
            "nisar": {"dates": iso, "los_m": floats(cumulative[:, idx]) if inside else [None] * len(iso)},
            "gps_fit": {
                "trend_m_per_yr": _r4(_num(gf.get("trend_m_per_yr"))),
                "trend_sigma_m_per_yr": _r4(_num(gf.get("trend_sigma_m_per_yr"))),
                "amp_m": _r4(_num(gf.get("amp_m"))),
                "amp_sigma_m": _r4(_num(gf.get("amp_sigma_m"))),
                "peak_month": None if pm is None else int(pm),
            },
            "nisar_fit": {
                "trend_m_per_yr": floats([fit.B[idx]])[0] if inside else None,
                "trend_sigma_m_per_yr": floats([fit.sigma_B[idx]])[0] if inside else None,
                "amp_m": floats([seasonal.amp[idx]])[0] if inside else None,
                "amp_sigma_m": floats([seasonal.amp_sigma[idx]])[0] if inside else None,
                "seasonal_significant": bool(seasonal.significant[idx]) if sig_known else None,
                "c_m": floats([c[idx]])[0] if inside else None,
                "a_m": floats([fit.a[idx]])[0] if inside else None,
                "b_m": floats([fit.b[idx]])[0] if inside else None,
            },
            "residuals": None if st.get("role") == "reference" else _residual_summary(gps["residuals"].get(name, [])),
        }
        if placeholder_coords:
            entry["coords_are_placeholder"] = True
        out.append(entry)
    return {"is_synthetic": bool(is_synthetic), "stations": out}