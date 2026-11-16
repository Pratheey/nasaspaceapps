#!/usr/bin/env python3
"""Assemble the per-pair files into the contract stack and the station table.

    python data/scripts/build_stack.py --track 34 --frame 20

Reads  data/interim/tTTT_fFFF/pair_NN.nc             (process_pairs.py)
Writes data/interim/stack_tTTT_fFFF.nc                (contracts/stack.md section 1; goes
                                                      to the shared Drive, not to git)
       data/processed/station_values_tTTT_fFFF.csv    (contracts/stack.md section 2)
       data/processed/station_values.csv              (same file, only for Track 034 /
                                                      Frame 020, the name the contract uses)

The tie: each pair is zero at the reference station (P304) when it leaves process_pairs.py.
Here the reference station's own GPS motion over the pair's dates, projected on the line of
sight, is added to every pixel, so the stack is "tied to P304 GPS" as decision D3 asks.
Tie source, first one that exists:
  1. gps/processed/gps_los.csv   (cleaned Track 034 / Frame 020 projection, that track only)
  2. gps/processed/gps_cleaned_enu.csv (cleaned positions projected on this track's LOS)
  3. data/raw/ngl/P304.tenv3     (raw NGL daily solutions, downloaded if missing; PROVISIONAL)
`--no-tie` writes the stack relative to the reference station instead.
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys
import urllib.request
from pathlib import Path

import numpy as np
import xarray as xr

import common
import nisar_gunw as ng

NGL_TENV3_URL = "https://geodesy.unr.edu/gps_timeseries/IGS20/tenv3/IGS20/{station}.tenv3"

STATION_COLUMNS = [
    # contract columns
    "pair", "ref_date", "sec_date", "station", "los_disp_m", "coherence", "valid",
    "los_east", "los_north", "los_up",
    # extras (additive): how the value was made
    "n_valid_px", "los_disp_iono_only_m", "ref_tie_m", "anomaly",
]


def ngl_tenv3(station: str) -> Path:
    """Path of the raw NGL series for `station`, downloading it into data/raw/ngl/ if needed."""
    path = common.RAW / "ngl" / f"{station}.tenv3"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(NGL_TENV3_URL.format(station=station), timeout=120) as resp:
            path.write_bytes(resp.read())
    return path


def tie_from_gps_los_csv(path: Path, station: str, pairs: list[tuple[str, str]], half_window_days: int = 3):
    """Per-pair LOS change of `station` from Daniel's gps_los.csv (weekly median at each date)."""
    rows = [r for r in common.read_csv(path) if r["station"] == station and r["los_m"] != ""]
    dates = np.array([dt.date.fromisoformat(r["date"]) for r in rows])
    los = np.array([float(r["los_m"]) for r in rows])

    def at(day: str):
        d = dt.date.fromisoformat(day)
        sel = np.abs(np.array([(x - d).days for x in dates])) <= half_window_days
        return float(np.median(los[sel])) if sel.any() else None

    return [_diff(at(a), at(b)) for a, b in pairs]


def tie_from_tenv3(path: Path, los_enu, pairs: list[tuple[str, str]]):
    series = ng.read_tenv3(path)

    def at(day: str):
        return ng.gps_los_at(series, los_enu, dt.date.fromisoformat(day))[0]

    return [_diff(at(a), at(b)) for a, b in pairs]


def tie_from_cleaned_enu_csv(path: Path, station: str, los_enu, pairs: list[tuple[str, str]]):
    """Project cleaned GPS positions into the requested track's viewing direction."""
    rows = [r for r in common.read_csv(path) if r["station"] == station]
    series = {"dates": [], "east_m": [], "north_m": [], "up_m": []}
    for row in rows:
        components = [float(row[f"{c}_m_corr"]) if row[f"{c}_m_corr"] else np.nan
                      for c in ("east", "north", "up")]
        if not np.isfinite(components).all():
            continue
        series["dates"].append(dt.date.fromisoformat(row["date"]))
        for name, value in zip(("east_m", "north_m", "up_m"), components):
            series[name].append(value)
    for name in ("east_m", "north_m", "up_m"):
        series[name] = np.asarray(series[name])

    def at(day):
        return ng.gps_los_at(series, los_enu, dt.date.fromisoformat(day))[0]

    return [_diff(at(a), at(b)) for a, b in pairs]


def reference_tie(track: int, frame: int, los_enu, pairs: list[tuple[str, str]]):
    """Choose a GPS source without reusing an ascending projection for another track."""
    gps_dir = common.REPO_ROOT / "gps" / "processed"
    gps_csv = gps_dir / "gps_los.csv"
    enu_csv = gps_dir / "gps_cleaned_enu.csv"
    if (track, frame) == (34, 20) and gps_csv.exists():
        return (tie_from_gps_los_csv(gps_csv, common.REFERENCE_STATION, pairs),
                "gps/processed/gps_los.csv, 7-day median at each date")
    if enu_csv.exists():
        return (tie_from_cleaned_enu_csv(enu_csv, common.REFERENCE_STATION, los_enu, pairs),
                "gps/processed/gps_cleaned_enu.csv, projected on this track's LOS, 7-day median at each date")
    return (tie_from_tenv3(ngl_tenv3(common.REFERENCE_STATION), los_enu, pairs),
            "PROVISIONAL: raw NGL IGS20 tenv3 for the reference station, 7-day median "
            "at each date, projected on the LOS; replace with cleaned GPS positions")


def _diff(a, b):
    return None if a is None or b is None else b - a


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--track", type=int, required=True)
    ap.add_argument("--frame", type=int, required=True)
    ap.add_argument("--no-tie", action="store_true", help="leave the stack relative to the reference station")
    ap.add_argument("--iono-only", action="store_true",
                    help="use the ionosphere-only displacement (no troposphere / tide screens)")
    ap.add_argument("--stations-only", action="store_true",
                    help="rewrite only the station table (after the station list changed); leave the stack file alone")
    ap.add_argument("--suffix", default="",
                    help="appended to the stack file name, e.g. _v2 -> stack_tTTT_fFFF_v2.nc, so a "
                         "new version does not overwrite the one teammates already have")
    ap.add_argument("--notes", default="", help="free text stored in the stack's `notes` attribute")
    args = ap.parse_args()

    import netCDF4

    tag = common.tag(args.track, args.frame)
    files = sorted(common.pair_dir(args.track, args.frame).glob("pair_*.nc"))
    if not files:
        print("No pair files. Run process_pairs.py first.", file=sys.stderr)
        return 1
    granules = common.read_csv(common.granule_csv(args.track, args.frame))

    first = xr.open_dataset(files[0])
    x, y = first.x.values, first.y.values
    station_list = common.load_stations()
    stations = [s["station"] for s in station_list]
    ref_sample = common.sample_stations(first, station_list)[stations.index(common.REFERENCE_STATION)]
    ref_enu = tuple(ref_sample[f"los_{c}"] for c in ("east", "north", "up"))
    los_vec = {c: first[f"los_{c}"].values for c in ("east", "north", "up")}
    epsg, coh_thr = int(first.attrs["epsg"]), float(first.attrs["coherence_threshold"])
    first.close()

    metas = []
    for path in files:
        with xr.open_dataset(path) as ds:
            if not (np.array_equal(ds.x.values, x) and np.array_equal(ds.y.values, y)):
                print(f"{path.name}: grid differs from {files[0].name}; cannot stack.", file=sys.stderr)
                return 1
            metas.append(dict(ds.attrs))
    missing = sorted(set(range(1, len(granules) + 1)) - {int(m["pair"]) for m in metas})
    pair_dates = [(m["ref_date"], m["sec_date"]) for m in metas]

    # --- tie to the reference station's GPS motion ---
    if args.no_tie:
        tie, tie_source = [0.0] * len(files), "none (stack is relative to the reference station)"
    else:
        tie, tie_source = reference_tie(args.track, args.frame, ref_enu, pair_dates)
    untied = [int(m["pair"]) for m, t in zip(metas, tie) if t is None]
    if untied:
        print(f"No GPS solution near the dates of pairs {untied}; cannot tie them.", file=sys.stderr)
        return 1

    disp_name = "los_disp_iono_only_ref_m" if args.iono_only else "los_disp_ref_m"

    # --- stack file ---
    write_stack = not args.stations_only
    if write_stack:
        out = common.INTERIM / f"stack_{tag}{args.suffix}.nc"
        tmp = out.with_name(out.stem + ".partial")
        nc = netCDF4.Dataset(tmp, "w", format="NETCDF4")
        nc.createDimension("pair", len(files))
        nc.createDimension("y", y.size)
        nc.createDimension("x", x.size)
        comp = dict(zlib=True, complevel=4, chunksizes=(1, min(512, y.size), min(512, x.size)))
        v_disp = nc.createVariable("los_disp_m", "f4", ("pair", "y", "x"), fill_value=np.nan, **comp)
        v_coh = nc.createVariable("coherence", "f4", ("pair", "y", "x"), fill_value=np.nan, **comp)
        v_valid = nc.createVariable("valid", "u1", ("pair", "y", "x"), **comp)
        v_disp.units, v_disp.long_name = "m", "LOS displacement of the pair, positive toward the satellite"
        v_coh.units, v_valid.units = "1", "1"
        v_anom = nc.createVariable("anomaly", "u1", ("pair", "y", "x"), **comp)
        v_anom.long_name = ("1 = the product flags an input-data anomaly in either image of the pair "
                            "(qFSP-H1 sample slip); such pixels are kept in `valid` unless anomalies_masked = 1")
        v_valid.long_name = "1 = passed coherence and product masks and is in the reference connected component"
        for c in ("east", "north", "up"):
            v = nc.createVariable(f"los_{c}", "f4", ("y", "x"), zlib=True, complevel=4)
            v[:] = los_vec[c]
            v.long_name = f"{c} component of the unit vector from the ground to the satellite"
        nc.createVariable("x", "f8", ("x",))[:] = x
        nc.createVariable("y", "f8", ("y",))[:] = y
        nc["x"].units = nc["y"].units = "m"
        nc.createVariable("pair", "i4", ("pair",))[:] = [int(m["pair"]) for m in metas]
        for name, key in [("ref_date", "ref_date"), ("sec_date", "sec_date"),
                          ("granule_id", "granule_id"), ("cmr_concept_id", "cmr_concept_id")]:
            v = nc.createVariable(name, str, ("pair",))
            for i, m in enumerate(metas):
                v[i] = str(m[key])
        for name in ("iono_applied", "tropo_applied", "set_applied", "anomalies_masked"):
            # Flags describe the selected displacement, not the unused fully corrected layer.
            applied = [0 if args.iono_only and name in ("tropo_applied", "set_applied")
                       else int(m[name]) for m in metas]
            nc.createVariable(name, "u1", ("pair",))[:] = applied
        v_tie = nc.createVariable("ref_tie_m", "f8", ("pair",))
        v_tie[:] = tie
        v_tie.long_name = "LOS motion of the reference station over the pair, added to every pixel"
        nc.createVariable("valid_fraction", "f4", ("pair",))[:] = [float(m["valid_fraction"]) for m in metas]

    station_rows = []
    for i, (path, m, t) in enumerate(zip(files, metas, tie)):
        with xr.open_dataset(path) as ds:
            if write_stack:
                v_disp[i] = ds[disp_name].values + np.float32(t)
                v_coh[i] = ds.coherence.values
                v_valid[i] = ds.valid.values
                v_anom[i] = ds.anomaly.values
            for name, smp in zip(stations, common.sample_stations(ds, station_list)):
                if smp is None:  # station outside the window
                    continue

                def tied(key):
                    return None if smp[key] is None else round(smp[key] + t, 5)

                station_rows.append({
                    "pair": int(m["pair"]), "ref_date": m["ref_date"], "sec_date": m["sec_date"],
                    "station": name,
                    "los_disp_m": tied(disp_name),
                    "coherence": None if smp["coherence"] is None else round(smp["coherence"], 5),
                    "valid": smp["valid"],
                    "los_east": round(smp["los_east"], 5), "los_north": round(smp["los_north"], 5),
                    "los_up": round(smp["los_up"], 5),
                    "n_valid_px": smp["n_valid_px"],
                    "los_disp_iono_only_m": tied("los_disp_iono_only_ref_m"),
                    "ref_tie_m": round(t, 5),
                    "anomaly": smp["anomaly"],
                })

    table = common.PROCESSED / f"station_values_{tag}.csv"
    common.write_csv(table, station_rows, STATION_COLUMNS)
    if (args.track, args.frame) == (34, 20):
        common.write_csv(common.PROCESSED / "station_values.csv", station_rows, STATION_COLUMNS)

    notes = [args.notes] if args.notes else []
    if missing:
        notes.append(f"pairs missing from the stack: {missing}")
    notes.append(f"tie source: {tie_source}")
    notes.append("corrections: " + ("ionosphere only" if args.iono_only else
                 "ionosphere, troposphere (wet + hydrostatic) and solid Earth tide screens from the GUNW"))
    terrain = sorted({int(m.get("terrain_heights_used", 0)) for m in metas})
    notes.append("troposphere/tide/LOS cubes read at: " + (
        "terrain height (Copernicus GLO-90)" if terrain == [1] else
        "a constant height" if terrain == [0] else "MIXED terrain and constant heights across pairs"))
    notes.append("no pair has been corrected for unwrapping errors")
    if write_stack:
        nc.setncatts({
            "crs": f"EPSG:{epsg}",
            "coherence_threshold": coh_thr,
            "reference_station": common.REFERENCE_STATION,
            "sign_convention": "positive toward satellite",
            "product_maturity": "provisional",
            "product": "NISAR L2 GUNW",
            "track": args.track,
            "frame": args.frame,
            "polarization": str(metas[0]["polarization"]),
            "wavelength_m": float(metas[0]["wavelength_m"]),
            "geometry_height_m": float(metas[0]["geometry_height_m"]),
            "created_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "notes": " | ".join(notes),
        })
        nc.close()
        tmp.replace(out)

    print(f"{len(files)} pairs" + (f"; MISSING pairs {missing}" if missing else ""))
    print("tie:", tie_source)
    if write_stack:
        print("wrote", out.relative_to(common.REPO_ROOT).as_posix(), f"({out.stat().st_size / 1e6:.0f} MB)")
    else:
        print("stack file left untouched (--stations-only)")
    print("wrote", table.relative_to(common.REPO_ROOT).as_posix())
    return 0


if __name__ == "__main__":
    sys.exit(main())
