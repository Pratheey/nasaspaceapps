#!/usr/bin/env python3
"""Self-check of the processed pairs against raw NGL GPS at the stations (PROVISIONAL).

    python data/scripts/qa_stations_vs_gps.py --track 34 --frame 20

This is the data lane's own sanity check: sign, units, gross unwrapping steps. It is NOT
the held-out residual table (H-9), which is Daniel's, uses his cleaned GPS series, and is
the only source for uncertainty numbers shown in the app or pitch.

Everything is relative to the reference station, in line of sight, positive toward the
satellite. GPS = 7-day median of raw NGL IGS20 daily solutions around each date.
Writes data/processed/qa_stations_vs_gps_tTTT_fFFF.csv.
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys

import numpy as np
import xarray as xr

import common
import nisar_gunw as ng
from build_stack import ngl_tenv3

COLUMNS = ["pair", "ref_date", "sec_date", "station", "kind", "nisar_rel_ref_m",
           "nisar_iono_only_rel_ref_m", "gps_rel_ref_m", "residual_m", "residual_iono_only_m",
           "residual_cycles", "near_cycle_flag"]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--track", type=int, required=True)
    ap.add_argument("--frame", type=int, required=True)
    args = ap.parse_args()

    files = sorted(common.pair_dir(args.track, args.frame).glob("pair_*.nc"))
    if not files:
        print("No pair files. Run process_pairs.py first.", file=sys.stderr)
        return 1

    with xr.open_dataset(files[0]) as ds:
        stations = [str(s) for s in ds.station.values]
        enu = {s: tuple(float(ds[f"st_los_{c}"][i]) for c in ("east", "north", "up"))
               for i, s in enumerate(stations)}
        half_cycle_m = float(ds.attrs["wavelength_m"]) / 2.0
    series = {s: ng.read_tenv3(ngl_tenv3(s)) for s in stations}
    ref = common.REFERENCE_STATION

    def gps(station: str, day: str):
        return ng.gps_los_at(series[station], enu[station], dt.date.fromisoformat(day))[0]

    def gps_rel(station: str, d0: str, d1: str):
        vals = [gps(station, d1), gps(station, d0), gps(ref, d1), gps(ref, d0)]
        return None if any(v is None for v in vals) else (vals[0] - vals[1]) - (vals[2] - vals[3])

    rows = []
    cum = {s: {"full": 0.0, "iono": 0.0, "ok": True, "start": None} for s in stations}
    for path in files:
        with xr.open_dataset(path) as ds:
            a = ds.attrs
            for i, s in enumerate(stations):
                if s == ref:
                    continue
                full = float(ds.st_los_disp_ref_m[i])
                iono = float(ds.st_los_disp_iono_only_ref_m[i])
                g = gps_rel(s, a["ref_date"], a["sec_date"])
                ok = np.isfinite(full)
                rows.append(_row(a["pair"], a["ref_date"], a["sec_date"], s, "pair",
                                 full if ok else None, iono if ok else None, g, half_cycle_m))
                c = cum[s]
                c["start"] = c["start"] or a["ref_date"]
                c["ok"] = c["ok"] and ok  # a missing pair makes later cumulative values missing
                if c["ok"]:
                    c["full"] += full
                    c["iono"] += iono
                rows.append(_row(a["pair"], c["start"], a["sec_date"], s, "cumulative",
                                 c["full"] if c["ok"] else None, c["iono"] if c["ok"] else None,
                                 gps_rel(s, c["start"], a["sec_date"]), half_cycle_m))

    out = common.PROCESSED / f"qa_stations_vs_gps_{common.tag(args.track, args.frame)}.csv"
    common.write_csv(out, rows, COLUMNS)

    print(f"{len(files)} pairs. Residual = NISAR - GPS, both relative to {ref}, LOS, mm.")
    print("station   pairs  rms_pair  rms_pair_iono_only  worst_pair  flagged   final_cum_nisar  final_cum_gps")
    for s in stations:
        if s == ref:
            continue
        pr = [r for r in rows if r["station"] == s and r["kind"] == "pair" and r["residual_m"] is not None]
        if not pr:
            print(f"{s}: no valid pairs")
            continue
        res = np.array([r["residual_m"] for r in pr])
        res_i = np.array([r["residual_iono_only_m"] for r in pr])
        flagged = [r["pair"] for r in pr if r["near_cycle_flag"]]
        last = [r for r in rows if r["station"] == s and r["kind"] == "cumulative"][-1]

        def mm(v):
            return "   n/a" if v is None else f"{v * 1000:6.1f}"

        print(f"{s}      {len(pr):3d}   {np.sqrt(np.mean(res**2)) * 1000:6.1f}   {np.sqrt(np.mean(res_i**2)) * 1000:6.1f}"
              f"              {np.abs(res).max() * 1000:6.1f}     {flagged or '-'}   "
              f"{mm(last['nisar_rel_ref_m'])}          {mm(last['gps_rel_ref_m'])}")
    print("wrote", out.relative_to(common.REPO_ROOT).as_posix())
    return 0


def _row(pair, d0, d1, station, kind, nisar, nisar_iono, gps, half_cycle_m):
    res = None if nisar is None or gps is None else nisar - gps
    res_i = None if nisar_iono is None or gps is None else nisar_iono - gps
    cycles = None if res is None else res / half_cycle_m
    # same rule as contracts/gps.md: within ~3 cm of a non-zero multiple of one cycle (~12 cm)
    flag = None if cycles is None else int(round(cycles) != 0 and abs(res - round(cycles) * half_cycle_m) < 0.03)

    def r5(v):
        return None if v is None else round(v, 5)

    return {"pair": int(pair), "ref_date": d0, "sec_date": d1, "station": station, "kind": kind,
            "nisar_rel_ref_m": r5(nisar), "nisar_iono_only_rel_ref_m": r5(nisar_iono),
            "gps_rel_ref_m": r5(gps), "residual_m": r5(res), "residual_iono_only_m": r5(res_i),
            "residual_cycles": None if cycles is None else round(cycles, 3), "near_cycle_flag": flag}


if __name__ == "__main__":
    sys.exit(main())
