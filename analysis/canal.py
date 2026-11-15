"""Canal profile: displacement sampled along a canal centre line. A SCREENING tool.

Canals in the valley flow by gravity on very gentle slopes, so a stretch that sinks more
than its neighbours makes a sag. The profile turns the canal into a line chart:
distance along the canal (km) vs net change, fitted trend and their 1-sigma.

It also reports the along-canal gradient of net change (how much the canal's slope changed
over the window, in m per km) over a short baseline. That gradient is noisy: its sigma is
sqrt(2) * sigma_net / baseline.

What it does NOT show: damage, lost capacity, or anything about the canal structure. It
says "look closer here", nothing more (docs/PROPOSAL.md section 8).

Input geometry: GeoJSON LineString or MultiLineString in lon/lat (from Daniel's context
layers, H-8). Output: canal_profile_<slug>.json. This file is NOT in contracts v1 yet.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np

from .export import floats
from .regrid import AppGrid, cell_index


def read_lines(path) -> list[tuple[str, np.ndarray]]:
    """GeoJSON -> list of (name, (n, 2) lon/lat array). MultiLineStrings become several lines."""
    gj = json.loads(Path(path).read_text(encoding="utf-8"))
    feats = gj["features"] if gj.get("type") == "FeatureCollection" else [gj]
    out = []
    for i, f in enumerate(feats):
        geom = f.get("geometry", f)
        name = (f.get("properties") or {}).get("name") or Path(path).stem
        parts = [geom["coordinates"]] if geom["type"] == "LineString" else geom["coordinates"]
        for j, part in enumerate(parts):
            label = name if len(parts) == 1 else f"{name} part {j + 1}"
            out.append((label, np.asarray(part, dtype=float)[:, :2]))
    return out


def densify(lonlat: np.ndarray, spacing_m: float = 500.0):
    """Points every `spacing_m` along the line. Returns lon, lat, distance_km."""
    from pyproj import Geod

    geod = Geod(ellps="WGS84")
    lons, lats, dists = [lonlat[0, 0]], [lonlat[0, 1]], [0.0]
    total = 0.0
    for (lo1, la1), (lo2, la2) in zip(lonlat[:-1], lonlat[1:]):
        seg = geod.inv(lo1, la1, lo2, la2)[2]
        n = max(int(np.ceil(seg / spacing_m)), 1)
        for k in range(1, n + 1):
            f = k / n
            lons.append(lo1 + f * (lo2 - lo1))
            lats.append(la1 + f * (la2 - la1))
            dists.append((total + f * seg) / 1000.0)
        total += seg
    return np.array(lons), np.array(lats), np.array(dists)


def gradient(values, distance_km, baseline_km: float = 2.0):
    """Change in net change per km over ~baseline_km, centred. NaN where either end is missing."""
    v = np.asarray(values, dtype=float)
    d = np.asarray(distance_km, dtype=float)
    out = np.full(v.shape, np.nan)
    for i in range(len(d)):
        lo = np.searchsorted(d, d[i] - baseline_km / 2)
        hi = np.searchsorted(d, d[i] + baseline_km / 2, side="right") - 1
        if hi > lo and np.isfinite(v[lo]) and np.isfinite(v[hi]):
            out[i] = (v[hi] - v[lo]) / (d[hi] - d[lo])
    return out


def profile(name: str, lonlat: np.ndarray, grid: AppGrid, *, net, net_sigma, trend, trend_sigma,
            label, is_synthetic: bool, source: str, spacing_m: float = 500.0,
            baseline_km: float = 2.0) -> dict:
    lon, lat, dist = densify(lonlat, spacing_m)
    idx = cell_index(lat, lon, grid)
    inside = idx >= 0

    def at(arr):
        arr = np.asarray(arr, dtype=float)
        return np.where(inside, arr[np.where(inside, idx, 0)], np.nan)

    net_s = at(net)
    sig_s = at(net_sigma)
    grad = gradient(net_s, dist, baseline_km)
    with np.errstate(invalid="ignore"):
        grad_sigma = np.where(np.isfinite(grad), np.sqrt(2) * sig_s / baseline_km, np.nan)
    lab = np.where(inside, np.asarray(label)[np.where(inside, idx, 0)], 0)

    return {
        "is_synthetic": bool(is_synthetic),
        "name": name,
        "geometry_source": source,
        "spacing_m": spacing_m,
        "gradient_baseline_km": baseline_km,
        "distance_km": floats(dist, 3),
        "lat": floats(lat, 5),
        "lon": floats(lon, 5),
        "cell_index": [int(i) if i >= 0 else None for i in idx],
        "net_change_m": floats(net_s),
        "net_change_sigma_m": floats(sig_s),
        "trend_m_per_yr": floats(at(trend)),
        "trend_sigma_m_per_yr": floats(at(trend_sigma)),
        "label": [int(v) for v in lab],
        "net_change_gradient_m_per_km": floats(grad, 5),
        "net_change_gradient_sigma_m_per_km": floats(grad_sigma, 5),
        "note": "Screening tool: where to look closer along the canal. Not a measure of damage or capacity.",
    }


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") or "canal"