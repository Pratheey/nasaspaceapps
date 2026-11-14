"""Radar pixels (projected x/y metres) -> the app's 0.01 deg lat/lon cells (D3).

Each app cell (~0.9 km x 1.1 km) holds many radar pixels. For each pair we take the
MEDIAN of the valid pixels in the cell. A cell is kept for a pair only if at least
`min_valid_fraction` of its pixels are valid; otherwise it is NaN for that pair (so a
cell's value is not built from a different handful of pixels each date).

Grid layout (contracts/app_data.md): row-major, north->south then west->east;
cell (row, col) centre: lat = lat_max - (row+0.5)*step, lon = lon_min + (col+0.5)*step.
"""
from __future__ import annotations

import warnings
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class AppGrid:
    lat_max: float = 36.95
    lon_min: float = -120.60
    step_deg: float = 0.01
    nrows: int = 100
    ncols: int = 120

    @property
    def ncells(self) -> int:
        return self.nrows * self.ncols

    def centres(self):
        """Flat arrays (ncells,) of cell-centre lat and lon, in contract order."""
        rows, cols = np.mgrid[0:self.nrows, 0:self.ncols]
        lat = self.lat_max - (rows + 0.5) * self.step_deg
        lon = self.lon_min + (cols + 0.5) * self.step_deg
        return lat.ravel(), lon.ravel()

    def as_meta(self) -> dict:
        return {"lat_max": self.lat_max, "lon_min": self.lon_min, "step_deg": self.step_deg,
                "nrows": self.nrows, "ncols": self.ncols}


def cell_index(lat, lon, grid: AppGrid) -> np.ndarray:
    """Flat cell index for each point; -1 where outside the grid."""
    lat = np.asarray(lat, dtype=float); lon = np.asarray(lon, dtype=float)
    row = np.floor((grid.lat_max - lat) / grid.step_deg).astype(int)
    col = np.floor((lon - grid.lon_min) / grid.step_deg).astype(int)
    inside = (row >= 0) & (row < grid.nrows) & (col >= 0) & (col < grid.ncols)
    inside &= np.isfinite(lat) & np.isfinite(lon)
    return np.where(inside, row * grid.ncols + col, -1)


def pixel_latlon(x, y, crs):
    """1-D projected x, y (metres) + CRS (e.g. 'EPSG:32611') -> 2-D lat, lon (y, x)."""
    from pyproj import Transformer

    xx, yy = np.meshgrid(np.asarray(x, dtype=float), np.asarray(y, dtype=float))
    tr = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    lon, lat = tr.transform(xx, yy)
    return np.asarray(lat), np.asarray(lon)


def aggregate(values, idx, ncells: int, min_valid_fraction: float = 0.5):
    """Median of pixels per cell.

    values: (n_layers, n_pixels), NaN = invalid. idx: (n_pixels,) from cell_index.
    Returns (out (n_layers, ncells), n_pixels_per_cell (ncells,)).
    """
    values = np.asarray(values, dtype=float)
    idx = np.asarray(idx).ravel()
    nlay = values.shape[0]
    out = np.full((nlay, ncells), np.nan)

    keep = idx >= 0
    order = np.argsort(idx[keep], kind="stable")
    cells_sorted = idx[keep][order]
    vals_sorted = values[:, keep][:, order]
    counts = np.bincount(cells_sorted, minlength=ncells)
    ends = np.cumsum(counts)
    starts = ends - counts

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)  # all-NaN slices -> NaN is what we want
        for c in np.flatnonzero(counts):
            sub = vals_sorted[:, starts[c]:ends[c]]
            nvalid = np.isfinite(sub).sum(axis=1)
            med = np.nanmedian(sub, axis=1)
            med[nvalid < min_valid_fraction * counts[c]] = np.nan
            out[:, c] = med
    return out, counts