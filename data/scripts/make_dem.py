#!/usr/bin/env python3
"""Terrain height on the stack grid, from the Copernicus GLO-90 DEM (public, no login).

    python data/scripts/make_dem.py --track 34 --frame 20

process_pairs.py calls this module itself on its first pair, so running it by hand is only
needed to rebuild or inspect the DEM. Downloads the 1-degree tiles that cover the window
into data/raw/dem/ (about 5 MB each) and writes data/interim/dem_tTTT_fFFF.nc with
`height_m` (y, x): height above the WGS84 ellipsoid, bilinear on the 80 m grid.

Copernicus heights are above the EGM2008 geoid. They are moved to the ellipsoid with one
constant, GEOID_UNDULATION_M, which is good to a couple of metres over this window (the
script prints the check against the GPS station heights).

Source: Copernicus DEM GLO-90, (c) DLR e.V. 2010-2014 and (c) Airbus Defence and Space GmbH
2014-2018, provided under COPERNICUS by the European Union and ESA; all rights reserved.
"""
from __future__ import annotations

import argparse
import math
import sys
import urllib.request

import numpy as np
import xarray as xr

import common

TILE_URL = ("https://copernicus-dem-90m.s3.amazonaws.com/"
            "Copernicus_DSM_COG_30_{ns}{lat:02d}_00_{ew}{lon:03d}_00_DEM/"
            "Copernicus_DSM_COG_30_{ns}{lat:02d}_00_{ew}{lon:03d}_00_DEM.tif")
GEOID_UNDULATION_M = -32.0  # EGM2008 geoid above the ellipsoid, central San Joaquin Valley


def tile_path(lat: int, lon: int):
    name = f"{'N' if lat >= 0 else 'S'}{abs(lat):02d}_{'E' if lon >= 0 else 'W'}{abs(lon):03d}.tif"
    path = common.RAW / "dem" / name
    if not path.exists():
        url = TILE_URL.format(ns="N" if lat >= 0 else "S", lat=abs(lat),
                              ew="E" if lon >= 0 else "W", lon=abs(lon))
        path.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url, timeout=180) as resp:
            path.write_bytes(resp.read())
    return path


def build_dem(x: np.ndarray, y: np.ndarray, epsg: int) -> np.ndarray:
    """Ellipsoidal terrain height (m) on the grid (y north to south, x), from Copernicus GLO-90."""
    import rasterio
    from pyproj import Transformer
    from rasterio.merge import merge
    from rasterio.transform import from_origin
    from rasterio.warp import Resampling, reproject

    dx, dy = float(x[1] - x[0]), float(y[0] - y[1])
    to_ll = Transformer.from_crs(epsg, 4326, always_xy=True)
    lon, lat = to_ll.transform([x[0], x[-1], x[0], x[-1]], [y[0], y[0], y[-1], y[-1]])
    tiles = [tile_path(la, lo)
             for la in range(math.floor(min(lat)), math.floor(max(lat)) + 1)
             for lo in range(math.floor(min(lon)), math.floor(max(lon)) + 1)]
    sources = [rasterio.open(t) for t in tiles]
    mosaic, transform = merge(sources)
    src_crs = sources[0].crs
    for src in sources:
        src.close()

    height = np.full((y.size, x.size), np.nan, dtype="f4")
    reproject(
        source=mosaic[0], destination=height,
        src_transform=transform, src_crs=src_crs,
        dst_transform=from_origin(x[0] - dx / 2, y[0] + dy / 2, dx, dy), dst_crs=f"EPSG:{epsg}",
        resampling=Resampling.bilinear, dst_nodata=np.nan,
    )
    return height + np.float32(GEOID_UNDULATION_M)


def dem_path(track: int, frame: int):
    return common.INTERIM / f"dem_{common.tag(track, frame)}.nc"


def load_or_build(track: int, frame: int, x: np.ndarray, y: np.ndarray, epsg: int) -> np.ndarray:
    """Terrain height on exactly this grid: read from data/interim/ if it matches, else build."""
    out = dem_path(track, frame)
    if out.exists():
        with xr.open_dataset(out) as ds:
            if np.array_equal(ds.x.values, x) and np.array_equal(ds.y.values, y):
                return ds.height_m.values
    height = build_dem(x, y, epsg)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_name(out.stem + ".partial")
    xr.Dataset(
        {"height_m": (("y", "x"), height)}, coords={"x": x, "y": y},
        attrs={"crs": f"EPSG:{epsg}", "source": "Copernicus DEM GLO-90",
               "vertical_datum": "WGS84 ellipsoid (EGM2008 heights + constant geoid undulation)",
               "geoid_undulation_m": GEOID_UNDULATION_M},
    ).to_netcdf(tmp, encoding={"height_m": {"zlib": True, "complevel": 4}})
    tmp.replace(out)
    return height


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--track", type=int, required=True)
    ap.add_argument("--frame", type=int, required=True)
    args = ap.parse_args()

    from pyproj import Transformer

    files = sorted(common.pair_dir(args.track, args.frame).glob("pair_*.nc"))
    if not files:
        print("No pair files yet. process_pairs.py builds the DEM itself on its first pair.", file=sys.stderr)
        return 1
    with xr.open_dataset(files[0]) as ds:
        x, y, epsg = ds.x.values, ds.y.values, int(ds.attrs["epsg"])
    dx, dy = float(x[1] - x[0]), float(y[0] - y[1])
    out = dem_path(args.track, args.frame)
    if out.exists():
        out.unlink()
    height = load_or_build(args.track, args.frame, x, y, epsg)

    print(f"height {np.nanmin(height):.0f} to {np.nanmax(height):.0f} m, "
          f"median {np.nanmedian(height):.0f} m; missing {np.isnan(height).mean():.1%}")
    to_xy = Transformer.from_crs(4326, epsg, always_xy=True)
    diffs = []
    for st in common.load_stations():
        sx, sy = to_xy.transform(st["lon"], st["lat"])
        r, c = int(np.argmin(np.abs(y - sy))), int(np.argmin(np.abs(x - sx)))
        if abs(y[r] - sy) <= dy and abs(x[c] - sx) <= dx:
            diffs.append(float(height[r, c]) - st["height_m"])
    if diffs:
        print(f"DEM minus GPS station height at {len(diffs)} stations: median {np.median(diffs):+.1f} m, "
              f"range {min(diffs):+.1f} to {max(diffs):+.1f} m")
    print("wrote", out.relative_to(common.REPO_ROOT).as_posix())
    return 0


if __name__ == "__main__":
    sys.exit(main())
