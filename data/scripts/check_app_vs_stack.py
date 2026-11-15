#!/usr/bin/env python3
"""Independent check: do the numbers in the web app match the data lane's frozen stack?

    data/.venv/Scripts/python data/scripts/check_app_vs_stack.py
    data/.venv/Scripts/python data/scripts/check_app_vs_stack.py --seed 1 --stack data/interim/stack_t034_f020_v3.nc

Nothing is imported from analysis/ or gps/. The analysis lane's code was read ONLY to learn the
definitions, then the calculation was re-implemented here with numpy / pandas:

  A. 3 random cells (seeded): per-date cell position series and net change, from the stack pixels,
     against frontend/public/data/series.json and grid.json.
  B. Every station in stations.json: the `nisar` series (the cell series at the station's cell) and
     the `gps` series (gps/processed/gps_los.csv at the same dates), plus the residual summary.
  C. Daniel's numbers: per-pair and net residuals (NISAR minus GPS, both relative to P304) for the
     13 held-out stations, sigma_pair, sigma_net, against gps/processed/residuals.csv and
     uncertainty.json; and no residual near one L-band cycle.

Definitions used (file:line in the repo):
  cell rule        analysis/run.py:117-121, analysis/regrid.py:88-104, analysis/netchange.py:34-41
                   each pixel's pairs are cumulatively summed (a missing pair makes every later
                   position NaN); per date the cell is the median of valid pixel positions, NaN if
                   fewer than 20% of ALL the cell's pixels are valid; cell pairs = diff of dates; the
                   app series is the cumulative sum of those pairs (so a missing date blanks every
                   later value); `valid == 0` pixels are NaN; anomaly flags are kept (run.py:84-96).
  grid geometry    contracts/app_data.md "Grid", analysis/regrid.py:50-58
  stations.json    `nisar.los_m` = cell series at the station's cell (analysis/stations.py:111);
                   `gps.los_m` = gps_los.csv `los_m` at that exact date (stations.py:100-102)
  NISAR pair value los_disp_m minus ref_tie_m (gps/scripts/build_gps_los.py:179)
  GPS pair value   7-day median (+-3 days) of each ENU component, projected with the station's median
                   LOS vector, differenced between the pair dates and then against P304
                   (build_gps_los.py:78-86, 136-139, 180)

Writes data/processed/check_app_vs_stack.csv. Exit code 1 if any pass/fail comparison fails.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

REPO = Path(__file__).resolve().parents[2]
APP = REPO / "frontend" / "public" / "data"
GPS = REPO / "gps" / "processed"
STATION_VALUES = REPO / "data" / "processed" / "station_values_t034_f020.csv"
OUT_CSV = REPO / "data" / "processed" / "check_app_vs_stack.csv"

MIN_VALID_FRACTION = 0.2          # team decision D5 (analysis/regrid.py:31)
TOL_MM = 0.5
APP_DECIMALS = 4                  # contracts/app_data.md "Size": values rounded to 0.1 mm
HELD_OUT = ["CAFP", "CAFR", "CAHA", "CAKC", "P294", "P297", "P298", "P300", "P302", "P303", "P307", "P725", "TRAN"]
REFERENCE = "P304"
DEMO = ["CAFP", "CAHA", "P300"]

ROWS = []   # comparison rows for the CSV


# ----------------------------------------------------------------------------- helpers
def fmt(v, nd=1, scale=1.0):
    return "-" if v is None or (isinstance(v, float) and not np.isfinite(v)) else f"{v * scale:.{nd}f}"


def table(header, rows):
    rows = [[str(c) for c in r] for r in rows]
    w = [max(len(h), *(len(r[i]) for r in rows)) if rows else len(h) for i, h in enumerate(header)]
    line = "  ".join(h.ljust(w[i]) for i, h in enumerate(header))
    print(line)
    print("-" * len(line))
    for r in rows:
        print("  ".join(c.ljust(w[i]) for i, c in enumerate(r)))
    print()


def add(check, item, quantity, app, rec, tol_mm=TOL_MM, informational=False, count=False):
    """Record one comparison. Values in metres (or a plain count if count=True)."""
    app = None if app is None or not np.isfinite(app) else float(app)
    rec = None if rec is None or not np.isfinite(rec) else float(rec)
    if app is None and rec is None:
        diff, ok = None, True
    elif app is None or rec is None:
        diff, ok = None, False                       # one side has a value, the other does not
    else:
        diff = (rec - app) if count else (rec - app) * 1000.0
        ok = abs(diff) <= tol_mm + 1e-9
    ROWS.append({"check": check, "item": item, "quantity": quantity, "app_value_m": app, "recomputed_m": rec,
                 "diff_mm": diff, "tolerance_mm": tol_mm, "ok": None if informational else ok})
    return ok if not informational else None


def add_maxabs(check, item, quantity, diff_mm, tol_mm=TOL_MM):
    ok = diff_mm is not None and diff_mm <= tol_mm + 1e-9
    ROWS.append({"check": check, "item": item, "quantity": quantity, "app_value_m": None, "recomputed_m": None,
                 "diff_mm": diff_mm, "tolerance_mm": tol_mm, "ok": ok})
    return ok


def write_csv():
    cols = ["check", "item", "quantity", "app_value_m", "recomputed_m", "diff_mm", "tolerance_mm", "ok"]
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(cols)
        for r in ROWS:
            out = []
            for c in cols:
                v = r[c]
                if v is None:
                    out.append("")
                elif c in ("app_value_m", "recomputed_m"):
                    out.append(f"{v:.6f}")
                elif c in ("diff_mm", "tolerance_mm"):
                    out.append(f"{v:.3f}")
                elif c == "ok":
                    out.append("true" if v else "false")
                else:
                    out.append(v)
            w.writerow(out)


# ----------------------------------------------------------------------------- stack / cells
class Stack:
    def __init__(self, path):
        import xarray as xr
        try:
            self.ds = xr.open_dataset(path, engine="h5netcdf")
        except Exception:
            self.ds = xr.open_dataset(path)
        ds = self.ds
        crs = str(ds.attrs.get("crs"))
        crs = f"EPSG:{crs}" if crs.isdigit() else crs
        from pyproj import Transformer
        xx, yy = np.meshgrid(ds["x"].values.astype(float), ds["y"].values.astype(float))
        lon, lat = Transformer.from_crs(crs, "EPSG:4326", always_xy=True).transform(xx, yy)
        self.lat, self.lon = np.asarray(lat), np.asarray(lon)
        self.npair = ds.sizes["pair"]
        self.wavelength = float(ds.attrs["wavelength_m"])
        self.ref = pd.to_datetime(ds["ref_date"].values)
        self.sec = pd.to_datetime(ds["sec_date"].values)
        for k in range(self.npair - 1):
            assert self.sec[k] == self.ref[k + 1], "pairs do not form a chain"
        self.dates = [self.ref[0].date().isoformat()] + [d.date().isoformat() for d in self.sec]

    def cell_rc(self, lat, lon, grid):
        row = int(np.floor((grid["lat_max"] - lat) / grid["step_deg"]))
        col = int(np.floor((lon - grid["lon_min"]) / grid["step_deg"]))
        return row, col

    def cell_series(self, cell, grid):
        """Recompute one cell from the stack pixels. Returns dict."""
        ncols = grid["ncols"]
        row, col = divmod(cell, ncols)
        lat_hi = grid["lat_max"] - row * grid["step_deg"]
        lat_lo = lat_hi - grid["step_deg"]
        lon_lo = grid["lon_min"] + col * grid["step_deg"]
        lon_hi = lon_lo + grid["step_deg"]
        inside = (self.lat <= lat_hi) & (self.lat > lat_lo) & (self.lon >= lon_lo) & (self.lon < lon_hi)
        # same half-open rule as floor((lat_max-lat)/step), floor((lon-lon_min)/step)
        rr, cc = np.nonzero(inside)
        out = {"npix": int(inside.sum())}
        if out["npix"] == 0:
            out.update(pos=np.full(self.npair + 1, np.nan), cum=np.full(self.npair + 1, np.nan),
                       nvalid=np.zeros(self.npair + 1, int), n_valid_dates=0)
            return out
        y0, y1, x0, x1 = rr.min(), rr.max() + 1, cc.min(), cc.max() + 1
        sub_mask = inside[y0:y1, x0:x1]
        disp = self.ds["los_disp_m"].isel(y=slice(y0, y1), x=slice(x0, x1)).values.astype(float)
        valid = self.ds["valid"].isel(y=slice(y0, y1), x=slice(x0, x1)).values
        disp[valid == 0] = np.nan                                  # masked pixels stay missing
        disp = disp[:, sub_mask]                                   # (npair, npix); anomaly flags kept
        # pixel position: cumulative sum of the chain, first date 0 (NaN if no valid pair at all),
        # a missing pair makes every later position NaN (np.cumsum propagates NaN)
        no_data = np.all(~np.isfinite(disp), axis=0)
        pos_px = np.concatenate([np.where(no_data, np.nan, 0.0)[None, :], np.cumsum(disp, axis=0)], axis=0)
        # cell position per date: median of valid pixel positions, needs >= 20% of ALL cell pixels
        nvalid = np.isfinite(pos_px).sum(axis=1)
        with np.errstate(all="ignore"):
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)
                pos = np.nanmedian(pos_px, axis=1)
        pos[nvalid < MIN_VALID_FRACTION * out["npix"]] = np.nan
        # cell pairs = differences between dates; app series = cumulative sum of the cell pairs
        pairs = np.diff(pos)
        first = 0.0 if np.any(np.isfinite(pairs)) else np.nan
        cum = np.concatenate([[first], np.cumsum(pairs)])
        out.update(pos=pos, cum=cum, nvalid=nvalid, n_valid_dates=int(np.isfinite(cum).sum()))
        return out


def series_compare(app_row, rec_cum):
    """Max abs difference (mm) over dates where both are present, and count of null-pattern mismatches."""
    a = np.array([np.nan if v is None else v for v in app_row], dtype=float)
    d = np.abs(a - rec_cum) * 1000.0
    both = np.isfinite(a) & np.isfinite(rec_cum)
    mism = int((np.isfinite(a) != np.isfinite(rec_cum)).sum())
    return (float(d[both].max()) if both.any() else None), mism


def last_finite(x):
    f = np.flatnonzero(np.isfinite(x))
    return float(x[f[-1]]) if len(f) else np.nan


# ----------------------------------------------------------------------------- main
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--stack", default=str(REPO / "data" / "interim" / "stack_t034_f020_v3.nc"))
    ap.add_argument("--seed", type=int, default=20261114)
    args = ap.parse_args(argv)

    meta = json.loads((APP / "meta.json").read_text(encoding="utf-8"))
    grid_json = json.loads((APP / "grid.json").read_text(encoding="utf-8"))
    series = json.loads((APP / "series.json").read_text(encoding="utf-8"))
    st_json = json.loads((APP / "stations.json").read_text(encoding="utf-8"))
    grid = meta["grid"]
    ncells = grid["nrows"] * grid["ncols"]
    dates = meta["dates"]
    tol_round = max(TOL_MM, 10.0 ** -APP_DECIMALS * 1000.0)
    print(f"stack: {args.stack}\napp data: {APP}\nrounding step in app JSON: {10.0 ** -APP_DECIMALS * 1000:.2f} mm, tolerance {tol_round} mm\n")

    stack = Stack(args.stack)
    assert stack.dates == dates, "stack dates differ from meta.json dates"
    fails = []

    # ------------------------------------------------------------------ A
    print("=" * 100)
    print("CHECK A: three random cells (seed %d), series.json + grid.json against the stack" % args.seed)
    print("=" * 100)
    net = grid_json["net_change_m"]
    cand = [i for i in range(ncells) if net[i] is not None and len(series["values_m"][i]) == len(dates)
            and all(v is not None for v in series["values_m"][i])]
    print(f"series.json holds {len(series['values_m'])} of {ncells} cells (all of them); candidates with a net change and "
          f"a full {len(dates)}-date series: {len(cand)}\n")
    rng = np.random.default_rng(args.seed)
    picks = sorted(int(c) for c in rng.choice(cand, size=3, replace=False))
    rowsA = []
    for c in picks:
        r = stack.cell_series(c, grid)
        row, col = divmod(c, grid["ncols"])
        lat = grid["lat_max"] - (row + 0.5) * grid["step_deg"]
        lon = grid["lon_min"] + (col + 0.5) * grid["step_deg"]
        item = f"cell {c} (r{row},c{col}; {lat:.3f},{lon:.3f})"
        rec_net = last_finite(r["cum"])
        ok1 = add("A", item, "net_change_m (grid.json)", net[c], rec_net, tol_round)
        app_last = series["values_m"][c][-1]
        ok2 = add("A", item, "series_last_m (series.json)", app_last, r["cum"][-1], tol_round)
        mx, mism = series_compare(series["values_m"][c], r["cum"])
        ok3 = add_maxabs("A", item, "series_max_abs_diff_over_dates", mx, tol_round)
        ok4 = add("A", item, "series_null_mismatch_count", 0, mism, 0.0, count=True)
        ok5 = add("A", item, "n_valid_dates_count (grid.json)", grid_json["n_valid_dates"][c], r["n_valid_dates"], 0.0, count=True)
        add("A", item, "n_pixels_in_cell_count (info)", None, r["npix"], 0.0, informational=True)
        fails += [not x for x in (ok1, ok2, ok3, ok4, ok5)]
        rowsA.append([c, f"{lat:.3f},{lon:.3f}", r["npix"], fmt(net[c], 3, 1000), fmt(rec_net, 3, 1000),
                      f"{(rec_net - net[c]) * 1000:+.3f}" if np.isfinite(rec_net) else "-",
                      fmt(mx, 3), mism, grid_json["n_valid_dates"][c], r["n_valid_dates"],
                      "ok" if all((ok1, ok2, ok3, ok4, ok5)) else "FAIL"])
    table(["cell", "lat,lon", "npix", "app_net_mm", "recomp_net_mm", "diff_mm", "series_maxdiff_mm", "null_mism",
           "app_n_dates", "rec_n_dates", "result"], rowsA)

    # ------------------------------------------------------------------ B
    print("=" * 100)
    print("CHECK B: stations.json (nisar series = cell series at the station's cell; gps series vs gps_los.csv)")
    print("=" * 100)
    gps_los = pd.read_csv(GPS / "gps_los.csv", dtype={"station": str, "date": str})
    gl = {(r.station, r.date): (r.los_m, r.sigma_m) for r in gps_los.itertuples()}
    sv = pd.read_csv(STATION_VALUES)
    # station-table cumulative (informational: a ~9-pixel point value, not the 1 km cell)
    tbl_net = {}
    for stn, g in sv.groupby("station"):
        g = g.sort_values("pair")
        v = np.where(g["valid"].values == 1, g["los_disp_m"].values, np.nan)
        cs = np.cumsum(v)
        tbl_net[stn] = float(cs[-1]) if np.isfinite(cs[-1]) else np.nan
    rowsB, rowsG = [], []
    stations = st_json["stations"]
    names_in_json = [s["station"] for s in stations]
    print("stations in stations.json:", ", ".join(names_in_json))
    print("demo stations:", ", ".join(DEMO), "| the rest are checked too\n")
    order = sorted(stations, key=lambda s: (s["station"] not in DEMO, s["station"]))
    for s in order:
        name = s["station"]
        idx = s["cell_index"]
        row, col = stack.cell_rc(s["lat"], s["lon"], grid)
        idx_rec = row * grid["ncols"] + col
        ok_idx = add("B_nisar", name, "cell_index_count", idx, idx_rec, 0.0, count=True)
        ok_dt = s["nisar"]["dates"] == dates and s["gps"]["dates"] == dates
        add("B_nisar", name, "dates_equal_meta_count", 1, 1 if ok_dt else 0, 0.0, count=True)
        r = stack.cell_series(idx_rec, grid)
        mx, mism = series_compare(s["nisar"]["los_m"], r["cum"])
        app_net = last_finite(np.array([np.nan if v is None else v for v in s["nisar"]["los_m"]], dtype=float))
        rec_net = last_finite(r["cum"])
        ok1 = add_maxabs("B_nisar", name, "nisar_series_max_abs_diff_over_dates", mx, tol_round)
        ok2 = add("B_nisar", name, "nisar_net_m (last valid value of series)", app_net, rec_net, tol_round)
        ok3 = add("B_nisar", name, "nisar_series_null_mismatch_count", 0, mism, 0.0, count=True)
        add("B_nisar", name, "station_table_point_net_m (info: ~9 px, not the cell)", None, tbl_net.get(name), informational=True)
        # GPS series against gps_los.csv at the same dates
        gmax, gmis, smax = 0.0, 0, 0.0
        for k, d in enumerate(dates):
            av, asig = s["gps"]["los_m"][k], s["gps"]["sigma_m"][k]
            cv = gl.get((name, d))
            if (av is None) != (cv is None):
                gmis += 1
                continue
            if cv is None:
                continue
            gmax = max(gmax, abs(av - cv[0]) * 1000)
            if asig is not None:
                smax = max(smax, abs(asig - cv[1]) * 1000)
        ok4 = add_maxabs("B_gps", name, "gps_los_m_max_abs_diff_over_dates", gmax, tol_round)
        ok5 = add_maxabs("B_gps", name, "gps_sigma_m_max_abs_diff_over_dates", smax, tol_round)
        ok6 = add("B_gps", name, "gps_null_mismatch_count", 0, gmis, 0.0, count=True)
        n_gps = sum(v is not None for v in s["gps"]["los_m"])
        fails += [not x for x in (ok_idx, ok1, ok2, ok3, ok4, ok5, ok6)]
        flag = "ok" if all((ok_idx, ok1, ok2, ok3, ok4, ok5, ok6)) else "FAIL"
        rowsB.append([name, idx, idx_rec, r["npix"], fmt(mx, 3), mism, fmt(app_net, 2, 1000), fmt(rec_net, 2, 1000),
                      fmt(tbl_net.get(name), 1, 1000)])
        rowsG.append([name, n_gps, f"{gmax:.3f}", f"{smax:.3f}", gmis, flag])
    print("B1. NISAR series in stations.json vs cell series recomputed from the stack")
    table(["station", "app_cell", "rec_cell", "npix", "series_maxdiff_mm", "null_mism", "app_net_mm", "rec_net_mm",
           "info:table_pt_net_mm"], rowsB)
    print("B2. GPS series in stations.json vs gps/processed/gps_los.csv at the same dates")
    table(["station", "n_dates_with_gps", "los_maxdiff_mm", "sigma_maxdiff_mm", "null_mism", "result"], rowsG)

    # ------------------------------------------------------------------ C
    print("=" * 100)
    print("CHECK C: Daniel's residuals (NISAR minus GPS, both relative to P304), sigma_pair, sigma_net")
    print("=" * 100)
    enu = pd.read_csv(GPS / "gps_cleaned_enu.csv", dtype={"station": str})
    enu["day"] = pd.to_datetime(enu["date"])
    gp_cache = {}

    def med7(st, day):
        key = (st, day)
        if key not in gp_cache:
            g = enu[enu["station"] == st]
            w = g[(g["day"] - pd.Timestamp(day)).abs() <= pd.Timedelta(days=3)]
            gp_cache[key] = None if len(w) == 0 else np.array(
                [np.median(w["east_m_corr"]), np.median(w["north_m_corr"]), np.median(w["up_m_corr"])])
        return gp_cache[key]

    vec = {s: np.median(sv[sv["station"] == s][["los_east", "los_north", "los_up"]].values, axis=0)
           for s in sv["station"].unique()}

    def gps_pos(st, day):
        m = med7(st, day)
        return None if m is None else float(vec[st] @ m)

    pairs = sv[["pair", "ref_date", "sec_date"]].drop_duplicates().sort_values("pair").values.tolist()
    p304 = sv[sv["station"] == REFERENCE].set_index("pair")
    mine = {}                       # (station, pair) -> (nis, gps, res)
    mine_alt = {}                   # NISAR relative to P304 as 'station row minus P304 row'
    net_mine = {}
    for st in HELD_OUT:
        got = sv[sv["station"] == st].set_index("pair")
        rows_st, rows_alt, complete, started = [], [], True, False
        for p, a, b in pairs:
            da, db = pd.Timestamp(a).date(), pd.Timestamp(b).date()
            ga = [gps_pos(st, da), gps_pos(REFERENCE, da)]
            gb = [gps_pos(st, db), gps_pos(REFERENCE, db)]
            ok = p in got.index and got.loc[p, "valid"] == 1 and None not in ga + gb
            if not ok:
                if started:
                    complete = False
                continue
            started = True
            nis = float(got.loc[p, "los_disp_m"] - got.loc[p, "ref_tie_m"])
            nis_alt = float(got.loc[p, "los_disp_m"] - p304.loc[p, "los_disp_m"])
            gp = (gb[0] - ga[0]) - (gb[1] - ga[1])
            rows_st.append((p, nis, gp, nis - gp))
            rows_alt.append((p, nis_alt, gp, nis_alt - gp))
        for (p, nis, gp, res), (_, na, _, ra) in zip(rows_st, rows_alt):
            mine[(st, p)] = (nis, gp, res)
            mine_alt[(st, p)] = (na, gp, ra)
        if rows_st and complete:
            ns, gs = sum(x[1] for x in rows_st), sum(x[2] for x in rows_st)
            net_mine[st] = (ns, gs, ns - gs, sum(x[1] for x in rows_alt) - gs)
    resid = pd.read_csv(GPS / "residuals.csv", dtype={"pair": str, "station": str})
    unc = json.loads((GPS / "uncertainty.json").read_text(encoding="utf-8"))

    # per-pair rows
    pair_rows = resid[resid["pair"] != "net"]
    file_keys = {(r.station, int(r.pair)) for r in pair_rows.itertuples()}
    only_file, only_mine = sorted(file_keys - set(mine)), sorted(set(mine) - file_keys)
    bad_rows, n_cmp, maxd = [], 0, 0.0
    per_st = {}
    for r in pair_rows.itertuples():
        key = (r.station, int(r.pair))
        if key not in mine:
            continue
        nis, gp, res = mine[key]
        item = f"{r.station} pair {int(r.pair)}"
        for q, fv, mv in (("nisar_los_m", r.nisar_los_m, nis), ("gps_los_m", r.gps_los_m, gp), ("residual_m", r.residual_m, res)):
            ok = add("C_pair", item, q, fv, mv, TOL_MM)
            d = abs(mv - fv) * 1000
            if q == "residual_m":
                n_cmp += 1
                maxd = max(maxd, d)
                ps = per_st.setdefault(r.station, [0, 0.0])
                ps[0] += 1
                ps[1] = max(ps[1], d)
            if not ok:
                bad_rows.append((item, q, fv, mv, d))
                fails.append(True)
        na, _, ra = mine_alt[key]
        add("C_pair_p304row", item, "nisar_los_m (info: station row minus P304 row)", r.nisar_los_m, na, TOL_MM, informational=True)
    for k in only_file + only_mine:
        fails.append(True)
        ROWS.append({"check": "C_pair", "item": f"{k[0]} pair {k[1]}", "quantity": "row_present_in_both_count",
                     "app_value_m": 1.0 if k in file_keys else 0.0, "recomputed_m": 1.0 if k in mine else 0.0,
                     "diff_mm": None, "tolerance_mm": 0.0, "ok": False})
    print(f"C1. per-pair residuals: residuals.csv has {len(pair_rows)} pair rows; recomputed {len(mine)}; compared {n_cmp}; "
          f"max |diff| on residual_m {maxd:.3f} mm")
    print(f"    rows only in residuals.csv: {only_file or 'none'} ; rows only in my recomputation: {only_mine or 'none'}")
    over = [b for b in bad_rows if b[1] == "residual_m"]
    print(f"    residual_m rows more than {TOL_MM} mm apart: {len(over)}")
    for b in bad_rows:
        print(f"      {b[0]:18s} {b[1]:12s} file {b[2]:+.5f}  mine {b[3]:+.5f}  diff {b[4]:.3f} mm")
    print()
    # per station summary + net rows
    net_rows = resid[resid["pair"] == "net"].set_index("station")
    rowsC = []
    for st in HELD_OUT:
        nrow = net_rows.loc[st] if st in net_rows.index else None
        nm = net_mine.get(st)
        if nrow is not None or nm is not None:
            okn = add("C_net", st, "net_residual_m", None if nrow is None else nrow["residual_m"], None if nm is None else nm[2], TOL_MM)
            add("C_net", st, "net_nisar_los_m", None if nrow is None else nrow["nisar_los_m"], None if nm is None else nm[0], TOL_MM)
            add("C_net", st, "net_gps_los_m", None if nrow is None else nrow["gps_los_m"], None if nm is None else nm[1], TOL_MM)
            if nm is not None:
                add("C_net_p304row", st, "net_residual_m (info: station row minus P304 row)", None if nrow is None else nrow["residual_m"],
                    nm[3], TOL_MM, informational=True)
            fails.append(not okn)
        else:
            okn = True
        ps = per_st.get(st, [0, 0.0])
        rowsC.append([st, ps[0], f"{ps[1]:.3f}", fmt(None if nrow is None else nrow["residual_m"], 2, 1000),
                      fmt(None if nm is None else nm[2], 2, 1000), "ok" if okn and ps[1] <= TOL_MM else "FAIL"])
    print("C2. per-station: pairs compared, max |diff| on pair residual, net residual (file vs recomputed)")
    table(["station", "n_pairs_cmp", "max_resid_diff_mm", "net_resid_file_mm", "net_resid_mine_mm", "result"], rowsC)

    # sigmas
    all_res = np.array([v[2] for v in mine.values()])
    net_res = np.array([v[2] for v in net_mine.values()])
    sig_pair, sig_net = float(np.sqrt(np.mean(all_res ** 2))), float(np.sqrt(np.mean(net_res ** 2)))
    cyc = stack.wavelength / 2.0
    dist = np.abs(np.abs(all_res) - cyc)
    near = int((dist <= 0.03).sum())
    unc_ok = [
        add("C_sigma", "sigma_pair_m", "rms_all_pair_residuals", unc["sigma_pair_m"], sig_pair, TOL_MM),
        add("C_sigma", "sigma_net_m", "rms_net_residuals", unc["sigma_net_m"], sig_net, TOL_MM),
        add("C_sigma", "n_pairs_used", "count", unc["n_pairs_used"], len(all_res), 0.0, count=True),
        add("C_sigma", "n_stations", "count", unc["n_stations"], len({k[0] for k in mine}), 0.0, count=True),
        add("C_cycle", "pair_residuals_within_3cm_of_one_cycle", "count", 0, near, 0.0, count=True),
    ]
    flagged = int((pair_rows["unwrap_flag"].astype(int) != 0).sum())
    unc_ok.append(add("C_cycle", "unwrap_flag_nonzero_in_residuals_csv", "count", 0, flagged, 0.0, count=True))
    fails += [not x for x in unc_ok]
    # stations.json residual summary vs my recomputation
    for s in stations:
        name = s["station"]
        res = s["residuals"]
        if name == REFERENCE:
            ok = add("B_resid", name, "residuals_is_null_for_reference_count", 1, 1 if res is None else 0, 0.0, count=True)
            fails.append(not ok)
            continue
        mine_r = np.array([v[2] for k, v in mine.items() if k[0] == name])
        nm = net_mine.get(name)
        oks = [add("B_resid", name, "net_m (stations.json residuals)", None if res is None else res["net_m"],
                   None if nm is None else nm[2], tol_round),
               add("B_resid", name, "pairs_rms_m (stations.json residuals)", None if res is None else res["pairs_rms_m"],
                   float(np.sqrt(np.mean(mine_r ** 2))) if len(mine_r) else None, tol_round),
               add("B_resid", name, "n_pairs_count (stations.json residuals)", None if res is None else res["n_pairs"],
                   len(mine_r), 0.0, count=True)]
        fails += [not x for x in oks]
    print("C3. sigmas and the one-cycle check")
    table(["quantity", "uncertainty.json", "recomputed", "diff_mm", "result"],
          [["sigma_pair_m (RMS of all pair residuals)", f"{unc['sigma_pair_m']:.4f}", f"{sig_pair:.5f}",
            f"{(sig_pair - unc['sigma_pair_m']) * 1000:+.3f}", "ok" if unc_ok[0] else "FAIL"],
           ["sigma_net_m (RMS of net residuals)", f"{unc['sigma_net_m']:.4f}", f"{sig_net:.5f}",
            f"{(sig_net - unc['sigma_net_m']) * 1000:+.3f}", "ok" if unc_ok[1] else "FAIL"],
           ["n_pairs_used", unc["n_pairs_used"], len(all_res), "", "ok" if unc_ok[2] else "FAIL"],
           ["n_stations", unc["n_stations"], len({k[0] for k in mine}), "", "ok" if unc_ok[3] else "FAIL"],
           [f"residuals within 3 cm of +-{cyc * 100:.2f} cm", "0", near, "", "ok" if unc_ok[4] else "FAIL"],
           ["unwrap_flag != 0 in residuals.csv", "0", flagged, "", "ok" if unc_ok[5] else "FAIL"]])
    print(f"    closest pair residual to one cycle: |res| = {np.abs(all_res)[np.argmin(dist)] * 100:.2f} cm "
          f"(distance {dist.min() * 100:.2f} cm); largest |res| = {np.abs(all_res).max() * 100:.2f} cm")
    n_net_files = len(net_rows)
    print(f"    net rows: residuals.csv {n_net_files}, recomputed {len(net_mine)}\n")

    # informational: how much the choice of tie term matters
    d_alt = [abs(mine_alt[k][2] - mine[k][2]) * 1000 for k in mine]
    print(f"INFO: using 'station row minus P304 row' instead of 'los_disp_m - ref_tie_m' for the NISAR side changes the pair "
          f"residuals by up to {max(d_alt):.2f} mm (mean {np.mean(d_alt):.2f} mm); not a pass/fail row (see C_pair_p304row in the CSV).")

    write_csv()
    nfail = sum(1 for f in fails if f)
    per_check = {}
    for r in ROWS:
        if r["ok"] is not None:
            per_check.setdefault(r["check"].split("_")[0], []).append(bool(r["ok"]))
    print("\nSUMMARY (pass/fail rows):")
    for k in sorted(per_check):
        v = per_check[k]
        print(f"  {k}: {sum(v)}/{len(v)} comparisons within tolerance -> {'PASS' if all(v) else 'FAIL'}")
    print(f"wrote {OUT_CSV.relative_to(REPO)} ({len(ROWS)} rows)")
    return 1 if (nfail or any(r['ok'] is False for r in ROWS)) else 0


if __name__ == "__main__":
    sys.exit(main())
