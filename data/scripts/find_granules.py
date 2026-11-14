#!/usr/bin/env python3
"""List the provisional NISAR GUNW granules of one track/frame and save them as a CSV.

Uses public CMR metadata, so no login is needed.

    python data/scripts/find_granules.py --track 34 --frame 20 --direction A
    python data/scripts/find_granules.py --track 42 --frame 70 --direction D

Writes data/processed/granules_t034_f020.csv (one row per pair, in date order). The other
scripts read the pair list from that file, so the data freeze is "stop re-running this".
"""
from __future__ import annotations

import argparse
import sys

import common
import nisar_gunw as ng

COLUMNS = ["pair", "ref_date", "sec_date", "granule_id", "release", "polarization",
           "cmr_concept_id", "hdf5_url"]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--track", type=int, required=True)
    ap.add_argument("--frame", type=int, required=True)
    ap.add_argument("--direction", choices=["A", "D"], required=True)
    ap.add_argument("--point", type=float, nargs=2, metavar=("LON", "LAT"), default=[-120.3566, 36.7390],
                    help="any point inside the frame (default: station P304)")
    args = ap.parse_args()

    granules = ng.find_granules(args.track, args.frame, args.direction, tuple(args.point))
    if not granules:
        print("No granules found. Check track, frame, direction and --point.", file=sys.stderr)
        return 1
    out = common.granule_csv(args.track, args.frame)
    common.write_csv(out, granules, COLUMNS)

    dates = sorted({g["ref_date"] for g in granules} | {g["sec_date"] for g in granules})
    print(f"{len(granules)} pairs, {len(dates)} dates, {dates[0]} to {dates[-1]}")
    print("releases:", sorted({g["release"] for g in granules}))
    breaks = ng.chain_breaks(granules)
    for b in breaks:
        print("CHAIN BREAK:", b)
    print("sequential chain:", "yes" if not breaks else "NO")
    print("wrote", out.relative_to(common.REPO_ROOT).as_posix())
    return 0


if __name__ == "__main__":
    sys.exit(main())
