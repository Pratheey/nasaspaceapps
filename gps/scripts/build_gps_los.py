#!/usr/bin/env python3
"""GPS -> NISAR line of sight, residuals and fits (H-5, H-9, H-17). gps lane (Daniel).

    python gps/scripts/build_gps_los.py --gps-dir gps/raw --values data/processed/station_values_t034_f020.csv

Inputs
  gps/raw/<STATION>_IGS20.tenv3 (or <STATION>.tenv3): NGL IGS20 daily solutions, PROVISIONAL.
  data/processed/station_values_t034_f020.csv: NISAR pair values and LOS unit vectors (nisar lane).
Outputs (gps/processed/)
  gps_los.csv, gps_fits.csv, residuals.csv, uncertainty.json   (shapes: contracts/gps.md)

Conventions: LOS positive toward the satellite; unit vectors point from the ground to the
satellite, so los = e*dE + n*dN + u*dU. Pair residuals use 7-day median positions (+-3 days)
relative to P304, matching the radar tie. gps_los.csv instead contains daily absolute LOS,
zeroed against the first available NISAR-date 7-day median; its separate los_rel_ref_m
column subtracts P304. The app-cell chart is a different comparison from pair residuals.

Days in EXCLUDE are left out of the fits but kept in the residuals.
Known equipment steps are removed in STEP_FIXES (only steps confirmed in NGL's steps list and
measured here). A station with no entry is used as downloaded: check its steps first.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import math
from pathlib import Path

import numpy as np

REFERENCE = "P304"
WINDOW = (dt.date(2025, 11, 24), dt.date(2026, 10, 14))
CYCLE_M = 0.12098          # half the L-band wavelength (0.24196 m)
UNWRAP_TOL_M = 0.03
# station -> list of (first_date_affected, component, offset_m_to_add)
STEP_FIXES = {"P307": [(dt.date(2025, 11, 13), "n", 0.0129)]}
# station -> (first_date, last_date, reason): days left out of fits only
EXCLUDE = {"P307": (dt.date(2025, 11, 13), dt.date(2025, 12, 31), "post-swap noisy/transient")}
NOTES = {
    "P307": "north +12.9 mm removed from 2025-11-13 (antenna/receiver swap 2025-11-12); east step unresolved; up not significant; 2025-11-13..12-31 left out",
    "P302": "none removed: 2021-11-17 antenna change is <=0.8 mm",
    "P303": "none removed: 2024-04-22 antenna/receiver change is <=1.4 mm",
    "P304": "none needed",
}


def read_tenv3(path: Path) -> dict:
    out = {"date": [], "e": [], "n": [], "u": [], "se": [], "sn": [], "su": []}
    for line in path.read_text().splitlines():
        p = line.split()
        if len(p) < 17 or p[0] == "site":
            continue
        out["date"].append(dt.datetime.strptime(p[1], "%y%b%d").date())
        out["e"].append(float(p[7]) + float(p[8]))
        out["n"].append(float(p[9]) + float(p[10]))
        out["u"].append(float(p[11]) + float(p[12]))
        out["se"].append(float(p[14])); out["sn"].append(float(p[15])); out["su"].append(float(p[16]))
    return {k: (np.array(v) if k != "date" else v) for k, v in out.items()}


def clean(station: str, s: dict) -> dict:
    s = {k: (v.copy() if hasattr(v, "copy") else list(v)) for k, v in s.items()}
    for first, comp, off in STEP_FIXES.get(station, []):
        m = np.array([d >= first for d in s["date"]])
        s[comp][m] += off
    return {k: (np.array(v) if k != "date" else list(v)) for k, v in s.items()}


def excluded(station: str, day: dt.date) -> bool:
    """Days left out of the fits only. Residuals keep them (flagged in gps_cleaned_enu.csv)."""
    if station not in EXCLUDE:
        return False
    a, b, _ = EXCLUDE[station]
    return a <= day <= b


def med7(s: dict, day: dt.date, key: str):
    idx = [i for i, d in enumerate(s["date"]) if abs((d - day).days) <= 3]
    return float(np.median(s[key][idx])) if idx else None


def los_vector(rows: list[dict]):
    v = np.array([[float(r["los_east"]), float(r["los_north"]), float(r["los_up"])] for r in rows])
    return np.median(v, axis=0)


def robust_fit(t, y):
    X = np.c_[np.ones_like(t), t, np.sin(2 * np.pi * t), np.cos(2 * np.pi * t)]
    keep = np.ones(len(y), bool)
    beta = np.zeros(4)
    for _ in range(4):
        beta = np.linalg.lstsq(X[keep], y[keep], rcond=None)[0]
        r = y - X @ beta
        sig = 1.4826 * np.median(np.abs(r[keep] - np.median(r[keep])))
        keep = np.abs(r) < 4 * sig if sig > 0 else keep
    return beta, y - X @ beta, X, keep


def fit_row(station, comp, days, y):
    y = np.asarray(y, dtype=float)
    if len(days) != len(y) or len(y) <= 21 or not np.isfinite(y).all():
        raise ValueError("GPS fits need more than 21 finite observations with matching dates for block uncertainty")
    t = np.array([(d - dt.date(2026, 1, 1)).days / 365.25 for d in days])
    beta, resid, X, keep = robust_fit(t, y)
    amp = math.hypot(beta[2], beta[3])
    peak = int((math.floor(((math.atan2(beta[2], beta[3]) / (2 * math.pi)) % 1) * 12)) + 1)
    # moving-block bootstrap (21-day blocks) on the residuals for 1-sigma
    rng = np.random.default_rng(307)
    n, blk, trends, amps = len(y), 21, [], []
    fitted = X @ beta
    starts = np.arange(0, n - blk + 1)  # include the block ending at the final observation
    for _ in range(400):
        rs = np.concatenate([resid[s:s + blk] for s in rng.choice(starts, n // blk + 1)])[:n]
        b, _, _, _ = robust_fit(t, fitted + rs)
        trends.append(b[1]); amps.append(math.hypot(b[2], b[3]))
    return {"station": station, "window_start": days[0].isoformat(), "window_end": days[-1].isoformat(),
            "component": comp, "trend_m_per_yr": f"{beta[1]:.5f}", "trend_sigma_m_per_yr": f"{np.std(trends):.5f}",
            "amp_m": f"{amp:.5f}", "amp_sigma_m": f"{np.std(amps):.5f}", "peak_month": peak}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--gps-dir", default="gps/raw")
    ap.add_argument("--values", default="data/processed/station_values_t034_f020.csv")
    ap.add_argument("--out", default="gps/processed")
    args = ap.parse_args()
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)

    vals = list(csv.DictReader(open(args.values)))
    gps = {}
    for f in sorted(Path(args.gps_dir).glob("*.tenv3")):
        st = f.name.split("_")[0].split(".")[0]
        gps[st] = clean(st, read_tenv3(f))
    stations = [s for s in gps if any(r["station"] == s for r in vals)]
    assert REFERENCE in stations, "reference station file missing"
    vec = {s: los_vector([r for r in vals if r["station"] == s]) for s in stations}

    def los_series(st, day):  # LOS position (m, arbitrary zero) from 7-day medians
        e, n, u = (med7(gps[st], day, k) for k in "enu")
        return None if None in (e, n, u) else float(vec[st] @ np.array([e, n, u]))

    # ---- gps_los.csv: daily, NISAR window only, relative to the first NISAR date
    nisar_dates = sorted({dt.date.fromisoformat(r[k]) for r in vals for k in ("ref_date", "sec_date")})
    daily, base = {}, {}
    for st in stations:
        days = [d for d in gps[st]["date"] if WINDOW[0] <= d <= WINDOW[1]]
        # baseline = first NISAR date that has GPS (2025-11-24, or 2025-12-06 for stations that start later)
        first_ok = next((d for d in nisar_dates if los_series(st, d) is not None), None)
        base[st] = (first_ok, los_series(st, first_ok))
        s = gps[st]
        for d in days:
            i = s["date"].index(d)
            e, n, u = (s[k][i] - (med7(s, base[st][0], k)) for k in "enu")
            los = float(vec[st] @ np.array([e, n, u]))
            sig = float(math.sqrt(sum((vec[st][j] * s[k][i]) ** 2 for j, k in enumerate(["se", "sn", "su"]))))
            daily[(st, d)] = (los, sig)
    rows = []
    for (st, d), (los, sig) in sorted(daily.items()):
        ref = daily.get((REFERENCE, d))
        rows.append({"station": st, "date": d.isoformat(), "los_m": f"{los:.5f}",
                     "los_rel_ref_m": f"{los - ref[0]:.5f}" if ref else "", "sigma_m": f"{sig:.5f}"})
    with open(out / "gps_los.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["station", "date", "los_m", "los_rel_ref_m", "sigma_m"]); w.writeheader(); w.writerows(rows)

    # ---- residuals.csv (held-out stations; NISAR minus GPS, both relative to P304)
    pairs = sorted({(int(r["pair"]), r["ref_date"], r["sec_date"]) for r in vals})
    res_rows, pair_res, net_res, used, net_names = [], [], [], [], []
    net_start = {}
    for st in [s for s in stations if s != REFERENCE]:
        rows_st, complete, started = [], True, False
        for p, a, b in pairs:
            r = next((x for x in vals if x["station"] == st and int(x["pair"]) == p), None)
            da, db = dt.date.fromisoformat(a), dt.date.fromisoformat(b)
            ga = [los_series(st, da), los_series(REFERENCE, da)]; gb = [los_series(st, db), los_series(REFERENCE, db)]
            ok = r is not None and r["valid"] == "1" and None not in ga + gb
            if not ok:
                if started: complete = False      # a gap after the first compared pair: no net
                continue
            if not started:
                started = True; net_start[st] = a  # stations with no GPS on 2025-11-24 start later
            nis = float(r["los_disp_m"]) - float(r["ref_tie_m"])
            gp = (gb[0] - ga[0]) - (gb[1] - ga[1])
            rows_st.append([p, nis, gp, nis - gp])
        # unwrap flag: pair residual within UNWRAP_TOL_M of a nonzero whole number of cycles AND the
        # running-sum residual is still shifted by that many cycles one pair later (data lane's
        # persistence test: unwrapping error persists, one-date atmosphere reverses). The last
        # pair cannot be tested, so it is flagged if it is near a cycle.
        for i, (p, nis, gp, res) in enumerate(rows_st):
            k = round(res / CYCLE_M)
            near = k != 0 and abs(res - k * CYCLE_M) <= UNWRAP_TOL_M
            persists = near and (i + 1 >= len(rows_st) or abs(res + rows_st[i + 1][3] - k * CYCLE_M) <= UNWRAP_TOL_M)
            flag = int(near and persists)
            res_rows.append({"pair": p, "station": st, "nisar_los_m": f"{nis:.5f}", "gps_los_m": f"{gp:.5f}",
                             "residual_m": f"{res:.5f}", "unwrap_flag": flag})
            if not flag:
                pair_res.append(res)
        if rows_st:
            used.append(st)
        if rows_st and complete:
            n_sum, g_sum = sum(x[1] for x in rows_st), sum(x[2] for x in rows_st)
            res_rows.append({"pair": "net", "station": st, "nisar_los_m": f"{n_sum:.5f}", "gps_los_m": f"{g_sum:.5f}",
                             "residual_m": f"{n_sum - g_sum:.5f}", "unwrap_flag": 0})
            net_res.append(n_sum - g_sum); net_names.append(st)
    with open(out / "residuals.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["pair", "station", "nisar_los_m", "gps_los_m", "residual_m", "unwrap_flag"])
        w.writeheader(); w.writerows(res_rows)
    n_held = len(used)
    rms = lambda a: float(np.sqrt(np.mean(np.square(a)))) if len(a) else None
    unc = {"sigma_pair_m": round(rms(pair_res), 4), "sigma_net_m": round(rms(net_res), 4) if net_res else None,
           "n_stations": n_held, "n_pairs_used": len(pair_res),
           "method": "RMS of held-out residuals in LOS, flagged pairs excluded",
           "note": ("Stations: " + ", ".join(used) + ". Net change runs to 2026-10-14 and starts on 2025-11-24"
                    + ("" if all(net_start.get(x) == "2025-11-24" for x in used) else ", except " + ", ".join(x for x in used if net_start.get(x) != "2025-11-24") + " (no GPS on the first date: from 2025-12-06)")
                    + (". No net for " + ", ".join(sorted(set(used) - set(net_names))) if set(used) - set(net_names) else "")
                    + ". Prototype check, not a valley-wide accuracy claim")}
    (out / "uncertainty.json").write_text(json.dumps(unc, indent=2) + "\n")

    # ---- gps_fits.csv: LOS (relative to P304? no: absolute, as in gps_los.csv) and up
    fits = []
    for st in stations:
        days = sorted(d for (s2, d) in daily if s2 == st and not excluded(st, d))
        t_idx = {d: i for i, d in enumerate(gps[st]["date"])}
        los = np.array([daily[(st, d)][0] for d in days])
        up = np.array([gps[st]["u"][t_idx[d]] for d in days]); up = up - np.median(up[:7])
        fits += [fit_row(st, "los", days, los), fit_row(st, "up", days, up)]
    with open(out / "gps_fits.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(fits[0])); w.writeheader(); w.writerows(fits)

    print("stations", stations, "held out", n_held)
    print(json.dumps(unc, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
