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
    """Known B (m/yr), a, b (m) as functions of position: two bowls, peak ~early March."""
    def bowl(lat0, lon0, width):
        return np.exp(-(((lat - lat0) ** 2 + (lon - lon0) ** 2) / (2 * width ** 2)))

    b1, b2 = bowl(36.10, -119.56, 0.15), bowl(36.60, -120.20, 0.10)
    B = -0.25 * b1 - 0.12 * b2 - 0.004
    amp = 0.004 + 0.006 * np.clip(b1 + b2, 0, 1)
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