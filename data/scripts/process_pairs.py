#!/usr/bin/env python3
"""Process GUNW pairs one by one into small per-pair files (subset reads, no downloads).

    python data/scripts/process_pairs.py --track 34 --frame 20 --pairs 1
    python data/scripts/process_pairs.py --track 34 --frame 20 --pairs all

Needs data/processed/granules_tTTT_fFFF.csv (find_granules.py) and an Earthdata login in
~/.netrc. Writes data/interim/tTTT_fFFF/pair_NN.nc; pairs already on disk are skipped
unless --overwrite is given, so an interrupted run can simply be started again.
Then run build_stack.py.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
import time

import numpy as np
import xarray as xr

import common
import make_dem
import nisar_gunw as ng

GRID_VARS = ["los_disp_ref_m", "los_disp_iono_only_ref_m", "coherence", "valid", "anomaly",
             "los_east", "los_north", "los_up"]
STATION_KEYS = ["los_disp_ref_m", "los_disp_iono_only_ref_m", "coherence", "n_valid_px", "anomaly",
                "los_east", "los_north", "los_up"]
SCALARS = ["epsg", "wavelength_m", "polarization", "ref_connected_component", "ref_n_px",
           "iono_applied", "tropo_applied", "set_applied", "anomalies_masked", "terrain_heights_used",
           "coherence_threshold",
           "geometry_height_m", "valid_fraction", "water_fraction", "anomaly_fraction"]
ENCODING = {name: {"zlib": True, "complevel": 4} for name in GRID_VARS}


def pair_to_dataset(result: dict, granule: dict, stations: list[dict]) -> xr.Dataset:
    """Pack one processed pair, plus its values at the stations, into a Dataset."""
    from pyproj import Transformer

    tr = Transformer.from_crs(4326, result["epsg"], always_xy=True)
    samples = []
    for s in stations:
        sx, sy = tr.transform(s["lon"], s["lat"])
        try:
            samples.append(ng.sample_station(result, sx, sy))
        except ValueError:  # station outside the window
            samples.append(None)

    def column(key: str) -> np.ndarray:
        return np.array(
            [np.nan if (smp is None or smp[key] is None) else smp[key] for smp in samples],
            dtype="f8",
        )

    data = {name: (("y", "x"), result[name]) for name in GRID_VARS}
    data.update({f"st_{key}": ("station", column(key)) for key in STATION_KEYS})
    ds = xr.Dataset(
        data,
        coords={"x": result["x"], "y": result["y"], "station": [s["station"] for s in stations]},
    )
    ds.attrs.update({k: result[k] for k in SCALARS})
    ds.attrs.update(
        pair=int(granule["pair"]),
        ref_date=granule["ref_date"],
        sec_date=granule["sec_date"],
        granule_id=granule["granule_id"],
        cmr_concept_id=granule["cmr_concept_id"],
        granule_info=json.dumps(result["info"]),
        reference_station=common.REFERENCE_STATION,
        sign_convention="positive toward satellite",
        product_maturity="provisional",
        created_utc=dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
    return ds


def main() -> int:
    w = ng.DEFAULT_WINDOW
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--track", type=int, required=True)
    ap.add_argument("--frame", type=int, required=True)
    ap.add_argument("--pairs", default="all", help="'all', '3', '1-5' or '1,4,7-9'")
    ap.add_argument("--coherence", type=float, default=0.3, help="coherence threshold (default 0.3)")
    ap.add_argument("--window", type=float, nargs=4, metavar=("LON_MIN", "LON_MAX", "LAT_MIN", "LAT_MAX"),
                    default=[w.lon_min, w.lon_max, w.lat_min, w.lat_max])
    ap.add_argument("--no-troposphere", action="store_true")
    ap.add_argument("--no-tides", action="store_true")
    ap.add_argument("--mask-anomalies", action="store_true",
                    help="also mask pixels the product flags as input-data anomalies (default: keep, flag)")
    ap.add_argument("--flat-height", action="store_true",
                    help="read the troposphere/tide/LOS cubes at a constant 50 m instead of terrain height")
    ap.add_argument("--overwrite", action="store_true")
    args = ap.parse_args()

    granules = common.read_csv(common.granule_csv(args.track, args.frame))
    stations = common.load_stations()
    ref = next(s for s in stations if s["station"] == common.REFERENCE_STATION)
    out_dir = common.pair_dir(args.track, args.frame)
    out_dir.mkdir(parents=True, exist_ok=True)
    window = ng.Window(*args.window)

    def terrain(x, y, epsg):
        return make_dem.load_or_build(args.track, args.frame, x, y, epsg)

    height_provider = None if args.flat_height else terrain

    failed = []
    for p in common.parse_pairs(args.pairs, len(granules)):
        g = granules[p - 1]
        out = out_dir / f"pair_{p:02d}.nc"
        if out.exists() and not args.overwrite:
            print(f"pair {p:2d}: already on disk, skipped", flush=True)
            continue
        t0 = time.time()
        try:
            with ng.open_gunw(g["hdf5_url"]) as f:
                result = ng.process_pair(
                    f, (ref["lon"], ref["lat"]), window=window,
                    coherence_threshold=args.coherence,
                    apply_troposphere=not args.no_troposphere,
                    apply_solid_earth_tides=not args.no_tides,
                    mask_anomalies=args.mask_anomalies,
                    height_provider=height_provider,
                )
        except Exception as exc:  # keep going: one bad pair must not stop the rest
            failed.append(p)
            print(f"pair {p:2d}: FAILED {g['ref_date']} -> {g['sec_date']}: {exc!r}", flush=True)
            continue
        ds = pair_to_dataset(result, g, stations)
        tmp = out.with_name(out.stem + ".partial")
        ds.to_netcdf(tmp, encoding=ENCODING)
        ds.close()
        tmp.replace(out)
        print(f"pair {p:2d}: {g['ref_date']} -> {g['sec_date']}  valid {result['valid_fraction']:.1%}  "
              f"anomaly {result['anomaly_fraction']:.1%}  ref px {result['ref_n_px']}  {time.time() - t0:.0f} s", flush=True)
    if failed:
        print("FAILED pairs:", failed)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
