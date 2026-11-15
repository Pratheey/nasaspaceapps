"""Canal profile: displacement sampled along a canal centre line. A SCREENING tool.

Canals in the valley flow by gravity on very gentle slopes, so a stretch that sinks more
than its neighbours makes a sag. The profile turns the canal into a line chart:
distance along the canal (km) vs net change, fitted trend and their 1-sigma.

It also reports the along-canal gradient of net change (how much the canal's slope changed
over the window, in m per km) over a short baseline. Its sigma uses the two endpoint
uncertainties and the distance between those endpoints.

What it does NOT show: damage, lost capacity, or anything about the canal structure. It
says "look closer here", nothing more (docs/PROPOSAL.md section 8).

Input geometry: GeoJSON LineString or MultiLineString in lon/lat (from Daniel's context
layers, H-8). Output: canal_profile_<slug>.json (contract v1.2).
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
        if geom["type"] == "LineString":
            parts = [geom["coordinates"]]
        elif geom["type"] == "MultiLineString":
            parts = geom["coordinates"]
        else:
            raise ValueError(f"{path}: {name} is not a LineString or MultiLineString")
        for j, part in enumerate(parts):
            label = name if len(parts) == 1 else f"{name} part {j + 1}"
            out.append((label, np.asarray(part, dtype=float)[:, :2]))
    return out


def densify(lonlat: np.ndarray, spacing_m: float = 500.0):
    """Points every `spacing_m` along the line (plus the end point). Returns lon, lat, distance_km.
    Distances are geodesic; positions are interpolated linearly between the line's vertices."""
    from pyproj import Geod

    geod = Geod(ellps="WGS84")
    lonlat = np.asarray(lonlat, dtype=float)
    if not np.isfinite(spacing_m) or spacing_m <= 0:
        raise ValueError("Canal sample spacing must be finite and positive")
    if lonlat.ndim != 2 or lonlat.shape[0] < 2 or lonlat.shape[1] != 2 or not np.all(np.isfinite(lonlat)):
        raise ValueError("Canal line needs at least two finite longitude/latitude points")
    seg = np.array([geod.inv(lonlat[i, 0], lonlat[i, 1], lonlat[i + 1, 0], lonlat[i + 1, 1])[2]
                    for i in range(len(lonlat) - 1)])
    nonzero = seg > 1e-6
    keep = np.r_[True, nonzero]
    if not np.all(np.isfinite(seg)) or not keep[1:].any():
        raise ValueError("Canal line length must be finite and positive")
    lonlat = lonlat[keep]
    seg = seg[nonzero]
    cum = np.concatenate([[0.0], np.cumsum(seg)])
    targets = np.arange(0.0, cum[-1], spacing_m)
    if cum[-1] - targets[-1] > 1e-6:
        targets = np.append(targets, cum[-1])
    lon = np.interp(targets, cum, lonlat[:, 0])
    lat = np.interp(targets, cum, lonlat[:, 1])
    return lon, lat, targets / 1000.0


def _gradients(values, distance_km, baseline_km, endpoint_sigma=None):
    v = np.asarray(values, dtype=float)
    d = np.asarray(distance_km, dtype=float)
    if not np.isfinite(baseline_km) or baseline_km <= 0:
        raise ValueError("Gradient baseline must be finite and positive")
    lo = np.searchsorted(d, d - baseline_km / 2)
    hi = np.searchsorted(d, d + baseline_km / 2, side="right") - 1
    spread = d[hi] - d[lo]
    valid = (spread > 0) & np.isfinite(v[lo]) & np.isfinite(v[hi])
    grad = np.divide(v[hi] - v[lo], spread, out=np.full(v.shape, np.nan), where=valid)
    grad_sigma = np.full(v.shape, np.nan)
    if endpoint_sigma is not None:
        sigma = np.asarray(endpoint_sigma, dtype=float)
        np.divide(np.hypot(sigma[lo], sigma[hi]), spread, out=grad_sigma, where=valid)
    return grad, grad_sigma


def gradient(values, distance_km, baseline_km: float = 2.0):
    """Change in net change per km over ~baseline_km, centred. NaN where either end is missing."""
    return _gradients(values, distance_km, baseline_km)[0]


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
    grad, grad_sigma = _gradients(net_s, dist, baseline_km, sig_s)
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
