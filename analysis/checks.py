"""Checks from the plan (analysis lane, hours 16-22). Rerun whenever sigma or the stack changes.

1. Cells vs Pratheek's station values: how much the 1 km cell median changes the series at each
   station, compared with his 3 x 3-pixel median there (data/processed/station_values_*.csv).
2. Sensitivity: how many cells get each label as sigma of net change and the seasonal threshold vary.

    python -m analysis.checks --stack data/interim/stack_t034_f020_v2.nc --sigma-json gps/processed/uncertainty.json
"""
from __future__ import annotations

import argparse
import csv
from pathlib import Path

import numpy as np

from . import labels, regrid, run, seasonal

REPO = Path(__file__).resolve().parent.parent


def station_comparison(res: dict, dates, values_csv, stations_csv, grid=regrid.AppGrid()) -> list[dict]:
    iso = [d.isoformat() for d in dates]
    pairs: dict = {}
    for r in csv.DictReader(open(values_csv, encoding="utf-8-sig")):
        v = r["los_disp_m"]
        pairs.setdefault(r["station"], {})[int(r["pair"])] = float(v) if v and r.get("valid", "1") == "1" else np.nan
    coords = {r["station"]: (float(r["lat"]), float(r["lon"])) for r in csv.DictReader(open(stations_csv, encoding="utf-8-sig"))}
    out = []
    for s, pv in sorted(pairs.items()):
        if s not in coords:
            continue
        c = int(regrid.cell_index([coords[s][0]], [coords[s][1]], grid)[0])
        if c < 0:
            continue
        steps = np.array([pv.get(k + 1, np.nan) for k in range(len(iso) - 1)])
        point = np.concatenate([[0.0], np.cumsum(steps)])          # NaN after the first missing pair
        cell = res["cumulative"][:, c]
        ok = np.isfinite(point) & np.isfinite(cell)
        diff = cell[ok] - point[ok]
        out.append({"station": s, "dates_compared": int(ok.sum()),
                    "rms_cm": float(np.sqrt(np.mean(diff ** 2)) * 100) if ok.any() else np.nan,
                    "net_cell_cm": float(cell[-1] * 100) if np.isfinite(cell[-1]) else np.nan,
                    "net_point_cm": float(point[-1] * 100) if np.isfinite(point[-1]) else np.nan,
                    "corr": float(np.corrcoef(cell[ok], point[ok])[0, 1]) if ok.sum() > 3 else np.nan})
    return out


def sensitivity(res: dict, sigmas, thresholds: dict, grid=regrid.AppGrid()) -> list[dict]:
    """Label counts for every (sigma, seasonal threshold) combination."""
    f, net = res["fit"], res["net"]
    rows = []
    for tname, thr in thresholds.items():
        s = seasonal.evaluate(f, amp_threshold_m=thr)
        for sig in sigmas:
            counts = np.bincount(labels.label(net, sig, s.significant), minlength=4)
            rows.append({"threshold": tname, "sigma_cm": sig * 100, "seasonal_cells": int(s.significant.sum()),
                         **{f"label_{i}": int(counts[i]) for i in range(4)}})
    return rows


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--stack", required=True)
    ap.add_argument("--sigma-json", required=True)
    ap.add_argument("--station-values", default=str(REPO / "data/processed/station_values_t034_f020.csv"))
    ap.add_argument("--stations", default=str(REPO / "data/processed/stations_ngl.csv"))
    ap.add_argument("--out", default=str(REPO / "analysis/_real_draft_checks"))
    args = ap.parse_args(argv)

    ds = run.load_stack(args.stack)
    sigma, source = run.load_sigma(args.sigma_json)
    res = run.run(ds, sigma, source, args.out, gps_dir=None)
    dates = run.netchange.check_chain(ds["ref_date"].values, ds["sec_date"].values)

    print("## Cells vs station values (1 km cell median vs 3x3-pixel median at the station)\n")
    print("| Station | Dates compared | RMS difference (cm) | Correlation | Net: cell / point (cm) |\n|---|---|---|---|---|")
    for r in station_comparison(res, dates, args.station_values, args.stations):
        print(f"| {r['station']} | {r['dates_compared']} | {r['rms_cm']:.2f} | {r['corr']:+.2f} | "
              f"{r['net_cell_cm']:+.1f} / {r['net_point_cm']:+.1f} |")

    lat_c, lon_c = regrid.AppGrid().centres()
    f = res["fit"]
    sw_only = seasonal.calibrate_amplitude_threshold(f, seasonal.control_mask(lat_c, lon_c, [seasonal.STABLE_CONTROL_BOXES[1]]))
    calib = res["calibration"]
    thresholds = {}
    for boxes, result in (("both boxes", calib), ("south-west box only", sw_only)):
        if result.amp_threshold_m is None:
            thresholds[f"{boxes} (calibration unavailable, seasonal labels disabled)"] = np.inf
        else:
            thresholds[f"calibrated, {boxes} ({result.amp_threshold_m * 1000:.1f} mm)"] = result.amp_threshold_m
    thresholds["F-test only (no threshold)"] = None
    sigmas = sorted({0.012, round(sigma, 4), 0.022, 0.03})
    print("\n## Sensitivity: label counts vs sigma of net change and seasonal threshold\n")
    print("| Seasonal threshold | sigma (cm) | Seasonal cells | 0 | 1 | 2 | 3 |\n|---|---|---|---|---|---|---|")
    for r in sensitivity(res, sigmas, thresholds):
        print(f"| {r['threshold']} | {r['sigma_cm']:.2f} | {r['seasonal_cells']} | {r['label_0']} | {r['label_1']} | {r['label_2']} | {r['label_3']} |")


if __name__ == "__main__":
    main()
