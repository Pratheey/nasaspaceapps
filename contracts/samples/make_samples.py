#!/usr/bin/env python3
"""Generate SYNTHETIC app data files in the contracts/app_data.md v1.2 shape.

This is fake data for building the app without the real NISAR results. Every file says
"is_synthetic": true. Never present it as NASA data. Station coordinates are the real NGL
positions (D5 stations inside the app bbox); every displacement value is invented.

Run: python3 contracts/samples/make_samples.py   (numpy only)
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import numpy as np

OUT = Path(__file__).resolve().parent
rng = np.random.default_rng(42)

# --- grid (samples use 0.02 deg; real data uses 0.01 deg) ---
LAT_MAX, LON_MIN, STEP, NROWS, NCOLS = 36.95, -120.60, 0.02, 50, 60
rows, cols = np.mgrid[0:NROWS, 0:NCOLS]
lat = LAT_MAX - (rows + 0.5) * STEP
lon = LON_MIN + (cols + 0.5) * STEP

# --- dates: 12-day repeat, 2 acquisitions dropped to mimic the real 26-date record ---
start = dt.date(2025, 11, 24)
all_dates = [start + dt.timedelta(days=12 * k) for k in range(28)]
dates = [d for k, d in enumerate(all_dates) if k not in (6, 19)]
T0 = dt.date(2026, 1, 1)
t = np.array([(d - T0).days / 365.25 for d in dates])
nd = len(dates)

# --- synthetic truth: two subsidence bowls + seasonal breathing peaking ~March ---
def bowl(lat0, lon0, width):
    return np.exp(-(((lat - lat0) ** 2 + (lon - lon0) ** 2) / (2 * width ** 2)))

# bowls near Corcoran/Hanford (CAHA) and Five Points (CAFP), the D5 demo stations
b1, b2 = bowl(36.15, -119.58, 0.15), bowl(36.42, -120.08, 0.10)
trend = -0.25 * b1 - 0.12 * b2 - 0.004                      # m/yr
amp = 0.004 + 0.004 * np.clip(b1 + b2, 0, 1)                # m
phase = 2 * np.pi * (2.5 / 12)                              # max around early March
a_true, b_true = amp * np.sin(phase), amp * np.cos(phase)   # a*sin + b*cos peaks at t = phase/2pi

def model(c, B, a, b, tt):
    return c + B * tt + a * np.sin(2 * np.pi * tt) + b * np.cos(2 * np.pi * tt)

truth = model(0, trend[..., None], a_true[..., None], b_true[..., None], t)  # (r, c, nd)
truth = truth - truth[..., :1]
noise_sd = 0.006
series = truth + rng.normal(0, noise_sd, truth.shape)
series[..., 0] = 0.0

# masking: a decorrelated patch (ploughed fields), random loss, and a pair dropout in one area
mask = rng.random((NROWS, NCOLS)) < 0.06
mask |= (np.hypot(lat - 36.45, lon - -119.85) < 0.08)
series[mask] = np.nan
dropout = (np.hypot(lat - 36.80, lon - -119.70) < 0.07)
series[dropout, 14:] = np.nan                                # missing pair -> later dates missing

flat = series.reshape(-1, nd)
ncell = flat.shape[0]

# --- per-cell fit on cumulative series (equivalent to the pairwise fit for a chain) ---
X = np.column_stack([np.ones(nd), t, np.sin(2 * np.pi * t), np.cos(2 * np.pi * t)])
F_CRIT = 3.44  # F(2, 22) at p = 0.05; real analysis must use the actual dof
SIGMA_NET = float(np.sqrt(2) * noise_sd)

out = {k: [None] * ncell for k in [
    "net_change_m", "net_change_sigma_m", "label", "seasonal_significant", "amp_m",
    "amp_sigma_m", "peak_month", "trend_m_per_yr", "trend_sigma_m_per_yr",
    "fit_c_m", "fit_a_m", "fit_b_m", "n_valid_dates"]}

def r4(x):
    return None if x is None or not np.isfinite(x) else round(float(x), 4)

for i in range(ncell):
    y = flat[i]
    ok = np.isfinite(y)
    out["n_valid_dates"][i] = int(ok.sum())
    out["label"][i] = 0
    if ok.sum() < 8:
        continue
    Xi, yi = X[ok], y[ok]
    coef, *_ = np.linalg.lstsq(Xi, yi, rcond=None)
    resid = yi - Xi @ coef
    dof = ok.sum() - 4
    s2 = float(resid @ resid) / dof
    cov = s2 * np.linalg.inv(Xi.T @ Xi)
    # F-test: full model vs no seasonal terms
    X0 = Xi[:, :2]
    c0, *_ = np.linalg.lstsq(X0, yi, rcond=None)
    rss0 = float(((yi - X0 @ c0) ** 2).sum())
    F = ((rss0 - float(resid @ resid)) / 2) / s2
    sig = bool(F > F_CRIT)
    c, B, a, b = coef
    A = float(np.hypot(a, b))
    A_sd = float(np.sqrt((a * a * cov[2, 2] + b * b * cov[3, 3] + 2 * a * b * cov[2, 3])) / A) if A > 0 else None
    peak = int(((np.arctan2(a, b) / (2 * np.pi)) % 1.0) * 12) + 1
    net = y[-1] - y[0] if np.isfinite(y[-1]) else None
    out["trend_m_per_yr"][i] = r4(B)
    out["trend_sigma_m_per_yr"][i] = r4(np.sqrt(cov[1, 1]))
    out["fit_c_m"][i], out["fit_a_m"][i], out["fit_b_m"][i] = r4(c), r4(a), r4(b)
    out["seasonal_significant"][i] = sig
    if sig:
        out["amp_m"][i], out["amp_sigma_m"][i], out["peak_month"][i] = r4(A), r4(A_sd), peak
    if net is not None:
        out["net_change_m"][i] = r4(net)
        out["net_change_sigma_m"][i] = r4(SIGMA_NET)
        sinking = net < -2 * SIGMA_NET
        within = abs(net) <= 2 * SIGMA_NET
        out["label"][i] = 1 if (sig and sinking) else 2 if (sig and within) else 3 if sinking else 0

grid = {"is_synthetic": True, **out}

# --- stations: real NGL coordinates of the D5 stations inside the app bbox (values synthetic) ---
stations_def = [
    ("P304", 36.7390, -120.3566, "reference"),
    ("P307", 36.9473, -120.0579, "held_out"),
    ("P294", 36.1232, -120.4399, "held_out"),
    ("P297", 35.9741, -120.5519, "held_out"),
    ("P298", 36.0158, -120.2941, "held_out"),
    ("P300", 36.3044, -120.2770, "held_out"),
    ("CAFP", 36.4240, -120.1020, "held_out"),
    ("CAFR", 36.8144, -119.7475, "held_out"),
    ("CAHA", 36.3234, -119.6228, "held_out"),
    ("CAKC", 36.0080, -119.9674, "held_out"),
    ("TRAN", 36.6508, -120.2490, "held_out"),
]
stations = []
for sid, slat, slon, role in stations_def:
    r = int((LAT_MAX - slat) / STEP); cc = int((slon - LON_MIN) / STEP)
    idx = r * NCOLS + cc
    gps = truth[r, cc] + rng.normal(0, 0.002, nd)
    gps -= gps[0]
    nis = flat[idx]
    resid = nis - gps
    stations.append({
        "station": sid, "lat": slat, "lon": slon, "role": role, "cell_index": idx,
        "gps": {"dates": [d.isoformat() for d in dates], "los_m": [r4(v) for v in gps],
                "sigma_m": [0.002] * nd},
        "nisar": {"dates": [d.isoformat() for d in dates], "los_m": [r4(v) for v in nis]},
        "gps_fit": {"trend_m_per_yr": r4(trend[r, cc]), "trend_sigma_m_per_yr": 0.001,
                    "amp_m": r4(amp[r, cc]), "amp_sigma_m": 0.0005, "peak_month": 3},
        "nisar_fit": {"trend_m_per_yr": out["trend_m_per_yr"][idx],
                      "trend_sigma_m_per_yr": out["trend_sigma_m_per_yr"][idx],
                      "amp_m": out["amp_m"][idx], "amp_sigma_m": out["amp_sigma_m"][idx],
                      "seasonal_significant": out["seasonal_significant"][idx],
                      "c_m": out["fit_c_m"][idx], "a_m": out["fit_a_m"][idx], "b_m": out["fit_b_m"][idx]},
        "residuals": None if role == "reference" else {
            "net_m": r4(resid[-1]) if np.isfinite(resid[-1]) else None,
            "pairs_rms_m": r4(np.sqrt(np.nanmean(np.diff(resid) ** 2))),
            "n_pairs": int(np.isfinite(np.diff(resid)).sum()),
            "unwrap_flagged_pairs": []},
    })

meta = {
    "contract_version": 1.2, "is_synthetic": True,
    "created_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "product": "SYNTHETIC (shape of NISAR L2 GUNW)", "product_maturity": "synthetic",
    "track": 34, "direction": "ascending", "frame": 20,
    "sign_convention": "positive toward satellite (≈ uplift); negative ≈ sinking",
    "units": "m", "reference_station": "P304",
    "held_out_stations": [s[0] for s in stations_def if s[3] == "held_out"],
    "demo_stations": {"sinking": ["CAFP", "CAHA"], "calm": "P300"},
    "canal_profiles": ["canal_profile_california_aqueduct.json"],
    "grid": {"lat_max": LAT_MAX, "lon_min": LON_MIN, "step_deg": STEP, "nrows": NROWS, "ncols": NCOLS},
    "dates": [d.isoformat() for d in dates],
    "pairs": [{"pair": k + 1, "ref_date": dates[k].isoformat(), "sec_date": dates[k + 1].isoformat(),
               "granule_id": f"SYNTHETIC_PAIR_{k + 1:02d}", "iono_applied": True, "used_in_fit": True}
              for k in range(nd - 1)],
    "fit": {"t0": T0.isoformat(), "period_yr": 1.0,
            "model": "u(t)=c+B*t+a*sin(2πt)+b*cos(2πt), t in years since t0, fitted on pairwise differences"},
    "sigma_net_m": round(SIGMA_NET, 4), "sigma_source": "synthetic noise level",
    "significance": "joint F-test on (a,b), p < 0.05",
    "labels": {"0": "Insufficient evidence", "1": "Seasonal movement with persistent sinking",
               "2": "Seasonal movement, no resolved trend",
               "3": "Persistent sinking, seasonal component uncertain"},
    "notes": ["SYNTHETIC DATA for building the app. Not NASA data.",
              "Station coordinates are real NGL positions; every value at them is synthetic."],
}

def dump(name, obj):
    (OUT / name).write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False))

dump("meta.json", meta)
dump("grid.json", grid)
dump("series.json", {"is_synthetic": True, "values_m": [[r4(v) for v in row] for row in flat]})
dump("stations.json", {"is_synthetic": True, "stations": stations})

# --- canal profile sample (contracts/app_data.md section 5): real centre line, synthetic values ---
CANALS = OUT.parents[1] / "context" / "canals" / "canals_bbox.geojson"
if CANALS.exists():
    feat = json.loads(CANALS.read_text(encoding="utf-8"))["features"][0]
    ll = np.asarray(feat["geometry"]["coordinates"], dtype=float)[:, :2]
    R = 6371008.8
    dx = np.radians(np.diff(ll[:, 0])) * np.cos(np.radians(ll[:-1, 1])) * R
    dy = np.radians(np.diff(ll[:, 1])) * R
    cum = np.concatenate([[0.0], np.cumsum(np.hypot(dx, dy))])
    dist = np.append(np.arange(0.0, cum[-1], 500.0), cum[-1])
    plon, plat = np.interp(dist, cum, ll[:, 0]), np.interp(dist, cum, ll[:, 1])
    rr = ((LAT_MAX - plat) / STEP).astype(int); cc2 = ((plon - LON_MIN) / STEP).astype(int)
    ok = (rr >= 0) & (rr < NROWS) & (cc2 >= 0) & (cc2 < NCOLS)
    idx = np.where(ok, rr * NCOLS + cc2, -1)
    pick = lambda arr: [arr[i] if i >= 0 else None for i in idx]
    net_p = pick(grid["net_change_m"])
    netf = np.array([np.nan if v is None else v for v in net_p], dtype=float)
    dkm = dist / 1000.0
    grad = np.full(len(dkm), np.nan)
    for i in range(len(dkm)):
        lo = np.searchsorted(dkm, dkm[i] - 1.0); hi = np.searchsorted(dkm, dkm[i] + 1.0, side="right") - 1
        if hi > lo and np.isfinite(netf[lo]) and np.isfinite(netf[hi]):
            grad[i] = (netf[hi] - netf[lo]) / (dkm[hi] - dkm[lo])
    name = feat["properties"]["name"]
    dump("canal_profile_" + name.lower().replace(" ", "_") + ".json", {
        "is_synthetic": True, "name": name,
        "geometry_source": feat["properties"].get("source_layer", ""),
        "spacing_m": 500.0, "gradient_baseline_km": 2.0,
        "distance_km": [round(float(v), 3) for v in dkm],
        "lat": [round(float(v), 5) for v in plat], "lon": [round(float(v), 5) for v in plon],
        "cell_index": [int(i) if i >= 0 else None for i in idx],
        "net_change_m": net_p, "net_change_sigma_m": pick(grid["net_change_sigma_m"]),
        "trend_m_per_yr": pick(grid["trend_m_per_yr"]), "trend_sigma_m_per_yr": pick(grid["trend_sigma_m_per_yr"]),
        "label": [int(v) if v is not None else 0 for v in pick(grid["label"])],
        "net_change_gradient_m_per_km": [r4(v) if np.isfinite(v) else None for v in grad],
        "net_change_gradient_sigma_m_per_km": [round(float(np.sqrt(2) * SIGMA_NET / 2.0), 5) if np.isfinite(v) else None for v in grad],
        "note": "Screening tool: where to look closer along the canal. Not a measure of damage or capacity.",
    })

counts = np.bincount(np.array(grid["label"]), minlength=4)
print("labels 0..3:", counts.tolist(), "| dates:", nd, "| sigma_net_m:", round(SIGMA_NET, 4))
for s in stations:
    print(s["station"], s["role"], "net:", s["nisar"]["los_m"][-1], "nisar trend:", s["nisar_fit"]["trend_m_per_yr"],
          "sig:", s["nisar_fit"]["seasonal_significant"])
