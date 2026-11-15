"""FAKE data with a known answer, for testing. Never present it as NASA data.

- single_pixel_pairs: one pixel, chosen B/a/b -> pairs (to check the fit recovers them)
- make_stack: a small stack shaped like contracts/stack.md, on a projected UTM grid, with
  two subsidence bowls, seasonal breathing, masking, and one missing pair in a patch.

Noise is added per DATE and then differenced, like real data: neighbouring pairs share a
date, so their errors are correlated.

The dates follow the brief (26 dates, 12-day repeat from 2025-11-24, two gaps) until
Pratheek confirms the real list in data/README.md.
"""
from __future__ import annotations

import datetime as dt

import numpy as np

from .timebase import to_years


def nisar_like_dates() -> list:
    start = dt.date(2025, 11, 24)
    all_dates = [start + dt.timedelta(days=12 * k) for k in range(28)]
    return [d for k, d in enumerate(all_dates) if k not in (6, 19)]


def series_from_params(t, B, a, b) -> np.ndarray:
    """Position at each date relative to the first date. Broadcasts: (..., n_dates)."""
    t = np.asarray(t, dtype=float)
    B = np.asarray(B, dtype=float)[..., None]
    a = np.asarray(a, dtype=float)[..., None]
    b = np.asarray(b, dtype=float)[..., None]
    u = B * t + a * np.sin(2 * np.pi * t) + b * np.cos(2 * np.pi * t)
    return u - u[..., :1]


def single_pixel_pairs(B, a, b, noise_sd: float = 0.0, seed: int = 0, dates=None):
    """Returns (t_ref, t_sec, d, dates) for one pixel."""
    dates = dates or nisar_like_dates()
    t = to_years(dates)
    u = series_from_params(t, B, a, b)
    u = u + np.random.default_rng(seed).normal(0.0, noise_sd, u.shape)
    return t[:-1], t[1:], np.diff(u), dates


def truth_fields(lat, lon):
    """Known B (m/yr), a, b (m) as functions of position: two bowls, peak ~early March,
    and zero motion in the stable control corners (seasonal.STABLE_CONTROL_BOXES)."""
    def bowl(lat0, lon0, width):
        return np.exp(-(((lat - lat0) ** 2 + (lon - lon0) ** 2) / (2 * width ** 2)))

    from .seasonal import control_mask

    b1, b2 = bowl(36.10, -119.56, 0.15), bowl(36.60, -120.20, 0.10)
    moving = ~control_mask(lat, lon)          # the stable control corners do not move at all
    B = (-0.25 * b1 - 0.12 * b2 - 0.004) * moving
    amp = (0.004 + 0.006 * np.clip(b1 + b2, 0, 1)) * moving
    phase = 2 * np.pi * (2.5 / 12)
    return B, amp * np.sin(phase), amp * np.cos(phase)


def make_stack(spacing_m: float = 500.0, noise_sd: float = 0.004, seed: int = 0,
               mask_fraction: float = 0.05, crs: str = "EPSG:32611"):
    """Synthetic pair stack in the contracts/stack.md shape. Returns (xarray.Dataset, truth dict)."""
    import xarray as xr
    from pyproj import Transformer

    rng = np.random.default_rng(seed)
    dates = nisar_like_dates()
    t = to_years(dates)

    fwd = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    xs, ys = fwd.transform([-120.65, -119.35, -120.65, -119.35], [35.90, 35.90, 37.00, 37.00])
    x = np.arange(min(xs), max(xs), spacing_m)
    y = np.arange(max(ys), min(ys), -spacing_m)  # north -> south
    inv = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    xx, yy = np.meshgrid(x, y)
    lon, lat = inv.transform(xx, yy)

    B, a, b = truth_fields(lat, lon)
    u = series_from_params(t, B, a, b)                     # (y, x, n_dates)
    u = u + rng.normal(0.0, noise_sd, u.shape)
    disp = np.moveaxis(np.diff(u, axis=-1), -1, 0)          # (pair, y, x)

    masked = rng.random(lat.shape) < mask_fraction
    masked |= np.hypot(lat - 36.45, lon + 119.85) < 0.08    # a decorrelated patch
    disp[:, masked] = np.nan
    gap = np.hypot(lat - 36.80, lon + 119.70) < 0.07        # one pair lost in this patch
    disp[13, gap] = np.nan

    npair = disp.shape[0]
    coherence = np.where(np.isfinite(disp), rng.uniform(0.4, 0.9, disp.shape), rng.uniform(0.0, 0.2, disp.shape))
    ds = xr.Dataset(
        {
            "los_disp_m": (("pair", "y", "x"), disp.astype(np.float32)),
            "coherence": (("pair", "y", "x"), coherence.astype(np.float32)),
            "valid": (("pair", "y", "x"), np.isfinite(disp).astype(np.uint8)),
            "los_east": (("y", "x"), np.full(lat.shape, -0.62, np.float32)),
            "los_north": (("y", "x"), np.full(lat.shape, -0.11, np.float32)),
            "los_up": (("y", "x"), np.full(lat.shape, 0.78, np.float32)),
            "ref_date": (("pair",), np.array([d.isoformat() for d in dates[:-1]])),
            "sec_date": (("pair",), np.array([d.isoformat() for d in dates[1:]])),
            "granule_id": (("pair",), np.array([f"SYNTHETIC_PAIR_{k + 1:02d}" for k in range(npair)])),
            "iono_applied": (("pair",), np.ones(npair, np.uint8)),
        },
        coords={"pair": np.arange(1, npair + 1), "x": x, "y": y},
        attrs={
            "crs": crs, "coherence_threshold": 0.3, "reference_station": "P304",
            "sign_convention": "positive toward satellite", "product_maturity": "synthetic",
            "is_synthetic": 1, "notes": "SYNTHETIC test stack, not NASA data",
        },
    )
    truth = {"B": B, "a": a, "b": b, "lat": lat, "lon": lon, "noise_sd": noise_sd}
    return ds, truth


# --- fake GPS files in the contracts/gps.md shape (placeholder coordinates, as in contracts/samples) ---
PLACEHOLDER_STATIONS = [
    ("P302", 36.70, -120.45, "held_out"),
    ("P303", 36.30, -119.80, "held_out"),
    ("P304", 36.55, -119.55, "reference"),
    ("P307", 36.30, -119.45, "held_out"),
]
L_BAND_HALF_WAVELENGTH_M = 0.119


def make_gps_files(out_dir, ds, seed: int = 1, gps_noise_m: float = 0.002) -> None:
    """Write stations.csv, gps_los.csv, gps_fits.csv, residuals.csv like Daniel will.
    The GPS follows the same synthetic truth as the stack, with its own small noise."""
    import csv
    from pathlib import Path

    from . import fit as fitmod
    from . import seasonal as seas
    from .regrid import pixel_latlon

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(seed)

    nisar_dates = nisar_like_dates()
    days = [nisar_dates[0] + dt.timedelta(days=k) for k in range((nisar_dates[-1] - nisar_dates[0]).days + 1)]
    t_daily = to_years(days)

    lat_px, lon_px = pixel_latlon(ds["x"].values, ds["y"].values, ds.attrs["crs"])
    disp = np.asarray(ds["los_disp_m"].values, dtype=float)

    series = {}
    for name, lat, lon, _ in PLACEHOLDER_STATIONS:
        B, a, b = truth_fields(np.array(lat), np.array(lon))
        u = series_from_params(t_daily, B, a, b) + rng.normal(0.0, gps_noise_m, len(days))
        series[name] = u - u[0]

    with open(out / "stations.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["station", "lat", "lon", "height_m", "role", "steps_removed"])
        for name, lat, lon, role in PLACEHOLDER_STATIONS:
            w.writerow([name, lat, lon, "", role, "SYNTHETIC placeholder station"])

    with open(out / "gps_los.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["station", "date", "los_m", "los_rel_ref_m", "sigma_m"])
        for name, *_ in PLACEHOLDER_STATIONS:
            for k, d in enumerate(days):
                w.writerow([name, d.isoformat(), f"{series[name][k]:.5f}",
                            f"{series[name][k] - series['P304'][k]:.5f}", gps_noise_m])

    with open(out / "gps_fits.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["station", "window_start", "window_end", "component", "trend_m_per_yr",
                    "trend_sigma_m_per_yr", "amp_m", "amp_sigma_m", "peak_month"])
        for name, *_ in PLACEHOLDER_STATIONS:
            r = fitmod.fit_pairs(np.diff(series[name]), t_daily[:-1], t_daily[1:])
            A, sA = seas.amplitude(r.a, r.b, r.cov[1:, 1:])
            w.writerow([name, days[0].isoformat(), days[-1].isoformat(), "los", f"{float(r.B):.5f}",
                        f"{float(r.sigma_B):.5f}", f"{float(A):.5f}", f"{float(sA):.5f}",
                        int(seas.peak_month(r.a, r.b))])

    idx_of = {d: k for k, d in enumerate(days)}
    with open(out / "residuals.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["pair", "station", "nisar_los_m", "gps_los_m", "residual_m", "unwrap_flag"])
        for name, lat, lon, role in PLACEHOLDER_STATIONS:
            if role == "reference":
                continue
            iy, ix = np.unravel_index(np.argmin((lat_px - lat) ** 2 + (lon_px - lon) ** 2), lat_px.shape)
            pix = disp[:, iy, ix]
            for k in range(len(pix)):
                g = series[name][idx_of[nisar_dates[k + 1]]] - series[name][idx_of[nisar_dates[k]]]
                n = pix[k]
                res = n - g if np.isfinite(n) else np.nan
                near_cycle = np.isfinite(res) and abs(res) > 0.06 and \
                    abs(res - L_BAND_HALF_WAVELENGTH_M * round(res / L_BAND_HALF_WAVELENGTH_M)) < 0.03
                w.writerow([k + 1, name, "" if not np.isfinite(n) else f"{n:.5f}", f"{g:.5f}",
                            "" if not np.isfinite(res) else f"{res:.5f}", int(near_cycle)])
            net_n = np.sum(pix) if np.all(np.isfinite(pix)) else np.nan
            net_g = series[name][-1]
            w.writerow(["net", name, "" if not np.isfinite(net_n) else f"{net_n:.5f}", f"{net_g:.5f}",
                        "" if not np.isfinite(net_n) else f"{net_n - net_g:.5f}", 0])


def make_canal_geojson(path) -> None:
    """A MADE-UP canal line crossing the southern synthetic bowl (not a real canal)."""
    import json
    from pathlib import Path

    coords = [[-120.05, 36.45], [-119.85, 36.25], [-119.62, 36.12], [-119.45, 35.98]]
    fc = {"type": "FeatureCollection", "features": [{
        "type": "Feature", "properties": {"name": "Synthetic canal", "is_synthetic": True},
        "geometry": {"type": "LineString", "coordinates": coords}}]}
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(fc), encoding="utf-8")