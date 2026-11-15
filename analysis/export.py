"""Write the app files exactly as contracts/app_data.md describes.

Units are metres, values rounded to 4 decimals (0.1 mm), missing values are null.
stations.json needs Daniel's GPS series (gps/processed/), so it is written only when
station entries are passed in.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import numpy as np

DECIMALS = 4
DEMO_STATIONS = {"sinking": ["CAFP", "CAHA"], "calm": "P300"}   # D5
MAX_BYTES = 5 * 1024 * 1024


def floats(arr, decimals: int = DECIMALS) -> list:
    arr = np.asarray(arr, dtype=float).ravel()
    return [None if not np.isfinite(v) else round(float(v), decimals) for v in arr]


def ints(arr) -> list:
    arr = np.asarray(arr, dtype=float).ravel()
    return [None if not np.isfinite(v) else int(v) for v in arr]


def bools(values, known) -> list:
    """True/False where known, null where not (e.g. no fit possible)."""
    values = np.asarray(values, dtype=bool).ravel()
    known = np.asarray(known, dtype=bool).ravel()
    return [bool(v) if k else None for v, k in zip(values, known)]


def build_grid(*, is_synthetic, net, net_sigma, label, seasonal, fit, c, n_valid_dates) -> dict:
    return {
        "is_synthetic": bool(is_synthetic),
        "net_change_m": floats(net),
        "net_change_sigma_m": floats(net_sigma),
        "label": [int(v) for v in np.asarray(label).ravel()],
        "seasonal_significant": bools(seasonal.significant, seasonal.fitted),
        "amp_m": floats(seasonal.amp),
        "amp_sigma_m": floats(seasonal.amp_sigma),
        "peak_month": ints(seasonal.peak_month),
        "trend_m_per_yr": floats(fit.B),
        "trend_sigma_m_per_yr": floats(fit.sigma_B),
        "fit_c_m": floats(c),
        "fit_a_m": floats(fit.a),
        "fit_b_m": floats(fit.b),
        "n_valid_dates": [int(v) for v in np.asarray(n_valid_dates).ravel()],
    }


def build_series(*, is_synthetic, cumulative_cells) -> dict:
    """cumulative_cells: (n_dates, ncells) -> values_m[cell][date]."""
    cum = np.asarray(cumulative_cells, dtype=float)
    return {"is_synthetic": bool(is_synthetic), "values_m": [floats(cum[:, i]) for i in range(cum.shape[1])]}


def build_meta(*, is_synthetic, grid_meta, dates, pairs, sigma_net_m, sigma_source,
               alpha, track=34, direction="ascending", frame=20, product_maturity="provisional",
               reference_station="P304", held_out=("P302", "P303", "P307"), labels=None, notes=(),
               sign_convention=None, product=None, demo_stations=None, significance=None,
               canal_profiles=()) -> dict:
    from .labels import LABEL_TEXT
    from .timebase import T0

    meta = {
        "contract_version": 1.2,
        "is_synthetic": bool(is_synthetic),
        "created_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "product": product or ("SYNTHETIC (shape of NISAR L2 GUNW)" if is_synthetic else "NISAR L2 GUNW"),
        "product_maturity": "synthetic" if is_synthetic else product_maturity,
        "track": track, "direction": direction, "frame": frame,
        "sign_convention": sign_convention or "positive toward satellite (≈ uplift); negative ≈ sinking",
        "units": "m",
        "reference_station": reference_station,
        "held_out_stations": list(held_out),
        "demo_stations": demo_stations if demo_stations is not None else DEMO_STATIONS,
        "grid": grid_meta,
        "dates": [d.isoformat() for d in dates],
        "pairs": pairs,
        "fit": {"t0": T0.isoformat(), "period_yr": 1.0,
                "model": "u(t)=c+B*t+a*sin(2πt)+b*cos(2πt), t in years since t0, fitted on pairwise differences"},
        "sigma_net_m": round(float(sigma_net_m), DECIMALS),
        "sigma_source": sigma_source,
        "significance": significance or f"joint F-test on (a,b), p < {alpha}",
        "labels": labels or LABEL_TEXT,
        "notes": list(notes),
    }
    if canal_profiles:                       # contracts v1.2 section 5: missing key = no profiles
        meta["canal_profiles"] = list(canal_profiles)
    return meta


def write_json(path: Path, obj) -> int:
    text = json.dumps(obj, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    path.write_text(text, encoding="utf-8")
    size = len(text.encode("utf-8"))
    if size > MAX_BYTES:
        print(f"WARNING: {path.name} is {size / 1e6:.1f} MB, over the 5 MB limit")
    return size


def write_all(out_dir, meta, grid, series, stations=None) -> dict:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    sizes = {"meta.json": write_json(out / "meta.json", meta),
             "grid.json": write_json(out / "grid.json", grid),
             "series.json": write_json(out / "series.json", series)}
    if stations is not None:
        sizes["stations.json"] = write_json(out / "stations.json", stations)
    else:
        (out / "stations.json").unlink(missing_ok=True)
    return sizes
