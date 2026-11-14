#!/usr/bin/env python3
"""Self-check of the processed pairs against raw NGL GPS at the stations (PROVISIONAL).

    python data/scripts/qa_stations_vs_gps.py --track 34 --frame 20

Run build_stack.py first: this reads data/processed/station_values_tTTT_fFFF.csv.

This is the data lane's own sanity check: sign, units, gross unwrapping steps. It is NOT
the held-out residual table (H-9), which is Daniel's, uses his cleaned GPS series, and is
the only source for uncertainty numbers shown in the app or pitch.

Everything is relative to the reference station, in line of sight, positive toward the
satellite. GPS = 7-day median of raw NGL IGS20 daily solutions around each date, with no
offsets removed. For the running sum, each station starts at its first date that has GPS
(some stations have no solution near the first NISAR date).

Writes data/processed/qa_stations_vs_gps_tTTT_fFFF.csv (every pair and running sum) and
data/processed/qa_summary_tTTT_fFFF.csv (one row per station).
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys

import numpy as np

import common
import nisar_gunw as ng
from build_stack import ngl_tenv3

COLUMNS = ["pair", "ref_date", "sec_date", "station", "kind", "nisar_rel_ref_m",
           "nisar_iono_only_rel_ref_m", "gps_rel_ref_m", "residual_m", "residual_iono_only_m",
           "residual_cycles", "near_cycle_flag"]
SUMMARY_COLUMNS = ["station", "n_pairs", "rms_pair_residual_m", "worst_pair_residual_m",
                   "near_cycle_pairs", "cum_start_date", "cum_end_date", "n_cum_dates",
                   "gps_net_m", "nisar_net_m", "net_residual_m", "gps_range_m",
                   "rms_cum_residual_m", "corr_cum"]


def _f(text: str):
    return None if text == "" else float(text)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--track", type=int, required=True)
    ap.add_argument("--frame", type=int, required=True)
    args = ap.parse_args()

    tag = common.tag(args.track, args.frame)
    table = common.PROCESSED / f"station_values_{tag}.csv"
    if not table.exists():
        print("No station table. Run build_stack.py first.", file=sys.stderr)
        return 1
    values = common.read_csv(table)
    ref = common.REFERENCE_STATION
    stations = sorted({r["station"] for r in values})
    pairs = sorted({(int(r["pair"]), r["ref_date"], r["sec_date"]) for r in values})
    half_cycle_m = None
    for path in sorted(common.pair_dir(args.track, args.frame).glob("pair_*.nc")):
        import xarray as xr

        with xr.open_dataset(path) as ds:
            half_cycle_m = float(ds.attrs["wavelength_m"]) / 2.0
        break
    if half_cycle_m is None:
        print("No pair files found (needed for the wavelength).", file=sys.stderr)
        return 1

    by = {(int(r["pair"]), r["station"]): r for r in values}
    enu = {s: tuple(float(by[(pairs[0][0], s)][f"los_{c}"]) for c in ("east", "north", "up"))
           for s in stations}
    series = {s: ng.read_tenv3(ngl_tenv3(s)) for s in stations}

    def gps(station: str, day: str):
        return ng.gps_los_at(series[station], enu[station], dt.date.fromisoformat(day))[0]

    def gps_rel(station: str, d0: str, d1: str):
        vals = [gps(station, d1), gps(station, d0), gps(ref, d1), gps(ref, d0)]
        return None if any(v is None for v in vals) else (vals[0] - vals[1]) - (vals[2] - vals[3])

    def nisar_rel(pair: int, station: str, column: str):
        r = by[(pair, station)]
        v = _f(r[column])
        return None if v is None else v - float(r["ref_tie_m"])

    rows, summary = [], []
    for s in stations:
        if s == ref:
            continue
        # first date at which both this station and the reference have GPS
        dates = [pairs[0][1]] + [p[2] for p in pairs]
        start = next((k for k, d in enumerate(dates) if gps(s, d) is not None and gps(ref, d) is not None), None)
        cum_full, cum_iono, ok = 0.0, 0.0, start is not None
        cum_n, cum_g = [], []
        pair_res = []
        for k, (p, d0, d1) in enumerate(pairs):
            full = nisar_rel(p, s, "los_disp_m")
            iono = nisar_rel(p, s, "los_disp_iono_only_m")
            row = _row(p, d0, d1, s, "pair", full, iono, gps_rel(s, d0, d1), half_cycle_m)
            rows.append(row)
            if row["residual_m"] is not None:
                pair_res.append(row)
            if start is None or k < start:
                continue
            ok = ok and full is not None  # a missing pair makes later running sums missing
            if ok:
                cum_full += full
                cum_iono += iono
            g = gps_rel(s, dates[start], d1)
            row = _row(p, dates[start], d1, s, "cumulative", cum_full if ok else None,
                       cum_iono if ok else None, g, half_cycle_m)
            rows.append(row)
            if row["residual_m"] is not None:
                cum_n.append(cum_full)
                cum_g.append(g)

        res = np.array([r["residual_m"] for r in pair_res])
        n, g = np.array(cum_n), np.array(cum_g)
        last = next((r for r in reversed(rows) if r["station"] == s and r["kind"] == "cumulative"
                     and r["residual_m"] is not None), None)

        def r4(v):
            return None if v is None or not np.isfinite(v) else round(float(v), 4)

        summary.append({
            "station": s,
            "n_pairs": len(pair_res),
            "rms_pair_residual_m": r4(np.sqrt(np.mean(res**2))) if res.size else None,
            "worst_pair_residual_m": r4(np.abs(res).max()) if res.size else None,
            "near_cycle_pairs": " ".join(str(r["pair"]) for r in pair_res if r["near_cycle_flag"]),
            "cum_start_date": last["ref_date"] if last else None,
            "cum_end_date": last["sec_date"] if last else None,
            "n_cum_dates": int(n.size),
            "gps_net_m": r4(last["gps_rel_ref_m"]) if last else None,
            "nisar_net_m": r4(last["nisar_rel_ref_m"]) if last else None,
            "net_residual_m": r4(last["residual_m"]) if last else None,
            "gps_range_m": r4(np.ptp(np.append(g, 0.0))) if g.size else None,
            "rms_cum_residual_m": r4(np.sqrt(np.mean((n - g) ** 2))) if n.size else None,
            "corr_cum": r4(np.corrcoef(n, g)[0, 1]) if n.size > 2 else None,
        })

    out = common.PROCESSED / f"qa_stations_vs_gps_{tag}.csv"
    common.write_csv(out, rows, COLUMNS)
    out_sum = common.PROCESSED / f"qa_summary_{tag}.csv"
    common.write_csv(out_sum, summary, SUMMARY_COLUMNS)

    def cm(v):
        return "   n/a" if v is None else f"{v * 100:6.1f}"

    print(f"{len(pairs)} pairs, {len(summary)} stations. NISAR - GPS, both relative to {ref}, LOS, cm.")
    print("station  pairs  rms_pair  worst  near_cycle   gps_net  nisar_net  gps_range  rms_cum   corr   from")
    for r in summary:
        corr = "  n/a" if r["corr_cum"] is None else f"{r['corr_cum']:5.2f}"
        print(f"{r['station']:7s}  {r['n_pairs']:4d}   {cm(r['rms_pair_residual_m'])}  {cm(r['worst_pair_residual_m'])}"
              f"   {r['near_cycle_pairs'] or '-':9s}  {cm(r['gps_net_m'])}   {cm(r['nisar_net_m'])}"
              f"     {cm(r['gps_range_m'])}   {cm(r['rms_cum_residual_m'])}  {corr}   {r['cum_start_date']}")
    print("wrote", out.relative_to(common.REPO_ROOT).as_posix(), "and", out_sum.relative_to(common.REPO_ROOT).as_posix())
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
