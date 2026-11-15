"""The whole analysis pipeline, top to bottom.

Real data (once Pratheek's stack and Daniel's GPS files exist):
    python -m analysis.run --stack <path>/stack_t034_f020.nc --sigma-json gps/processed/uncertainty.json
        [--gps-dir gps/processed] [--canal context/<canal>.geojson] [--exclude-pairs 7 12]

Vertical (Steven's ascending + descending combination, in the same stack shape):
    python -m analysis.run --component up --var up_disp_m --stack <vertical.nc> --sigma-json <...> --out <folder>

Synthetic end-to-end test (writes to analysis/_synthetic_out/, which git ignores):
    python -m analysis.run --synthetic
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from . import canal, export, fit, guards, labels, netchange, regrid, seasonal, stations, timebase

REPO = Path(__file__).resolve().parent.parent

COMPONENTS = {
    "los": {"var": "los_disp_m",
            "sign": "positive toward satellite (≈ uplift); negative ≈ sinking",
            "product": None},
    "up": {"var": "up_disp_m",
           "sign": "positive up",
           "product": "NISAR L2 GUNW, vertical from ascending (T034 F020) + descending (T042 F070)"},
}


def load_stack(path):
    import xarray as xr

    return xr.open_dataset(path, engine="h5netcdf")


def load_sigma(path) -> tuple[float, str]:
    """sigma_net_m from Daniel's gps/processed/uncertainty.json (contracts/gps.md)."""
    info = json.loads(Path(path).read_text(encoding="utf-8"))
    return float(info["sigma_net_m"]), str(Path(path).as_posix())


def pixel_latlon(ds, spatial_dims):
    if "lat" in ds and "lon" in ds:
        import xarray as xr

        lat, lon = xr.broadcast(ds["lat"], ds["lon"])
        return lat.transpose(*spatial_dims).values, lon.transpose(*spatial_dims).values
    crs = ds.attrs.get("crs")
    if not crs:
        raise ValueError("stack has no lat/lon variables and no 'crs' attribute")
    crs = f"EPSG:{crs}" if str(crs).isdigit() else str(crs)
    return regrid.pixel_latlon(ds["x"].values, ds["y"].values, crs)


def run(ds, sigma_net_m: float, sigma_source: str, out_dir, *, grid=regrid.AppGrid(),
        is_synthetic: bool = False, exclude_pairs=(), alpha: float = seasonal.ALPHA,
        min_valid_fraction: float = regrid.MIN_VALID_FRACTION, notes=(), gps_dir=None, canals=(), component: str = "los",
        var: str | None = None, placeholder_station_coords: bool = False, calibrate: bool = True,
        control_boxes=seasonal.STABLE_CONTROL_BOXES, mask_anomaly: bool = False,
        trend_guard: bool = True) -> dict:
    comp = COMPONENTS[component]
    var = var or comp["var"]
    out_dir = Path(out_dir)
    if not np.isfinite(sigma_net_m) or sigma_net_m < 0:
        raise ValueError("Net uncertainty must be finite and nonnegative")
    if not 0 <= min_valid_fraction <= 1:
        raise ValueError("Minimum valid fraction must be between 0 and 1")

    # 1. dates: check the chain and convert to years
    dates = netchange.check_chain(ds["ref_date"].values, ds["sec_date"].values)
    t_ref = timebase.to_years(ds["ref_date"].values)
    t_sec = timebase.to_years(ds["sec_date"].values)
    npair = len(t_ref)
    exclude = np.zeros(npair, dtype=bool)
    for pair in exclude_pairs:
        if not 1 <= pair <= npair or int(pair) != pair:
            raise ValueError(f"Excluded pair {pair} is outside the integer range 1–{npair}")
        exclude[int(pair) - 1] = True

    # 2. masked pixels stay missing
    disp = np.array(ds[var].values, dtype=float, copy=True)
    if "valid" in ds:
        disp[np.asarray(ds["valid"].values) != 1] = np.nan
    disp[~np.isfinite(disp)] = np.nan
    # `valid` does NOT exclude the stack's `anomaly` flags (Pratheek). They cover pairs 1, 2, 3, 7,
    # 8, 11 and 12 in a diagonal stripe (19% of the window), and their measured effect is ~2 mm.
    # Dropping them would blank net change across that stripe (one missing pair blanks every later
    # date), so by default they are kept, like the data lane does. --mask-anomaly drops them.
    if mask_anomaly and "anomaly" in ds:
        disp[np.asarray(ds["anomaly"].values) == 1] = np.nan
    # 3. radar pixels -> app cells. Median of each cell's pixel POSITIONS per date, then back
    #    to pairs. (A median of pair values per pair would break the date-noise cancellation
    #    between neighbouring pairs and make the cell series drift; see regrid.py.)
    lat, lon = pixel_latlon(ds, ds[var].dims[1:])
    idx = regrid.cell_index(lat.ravel(), lon.ravel(), grid)
    pixel_positions = netchange.cumulative(disp.reshape(npair, -1))          # (n_dates, n_pixels)
    cell_positions, _ = regrid.aggregate(pixel_positions, idx, grid.ncells, min_valid_fraction)
    cells = np.diff(cell_positions, axis=0)                                   # (n_pairs, ncells)

    # 4. fit B, a, b per cell on the pairs
    f = fit.fit_stack(cells, t_ref, t_sec, exclude_pairs=exclude)

    # 4b. trend guard: hide whole fits that cannot be trusted (missing a season, too few pairs,
    #     sigma of trend too large). Net change is untouched. See guards.py.
    guard = None
    if trend_guard:
        guard = guards.trend_guard(f, np.isfinite(cells) & ~exclude[:, None], t_ref, t_sec)
        f = guards.apply(f, guard.ok)

    # 5. is the wave real? F-test AND an amplitude threshold calibrated on stable ground (D5);
    #    amplitude + peak month only where both pass
    notes = list(notes)
    notes.append(guard.describe() if guard else "Trend guard OFF (--no-trend-guard): unreliable fits are shown.")
    notes.append(f"Cells: median of pixel positions per date; a date needs >= {min_valid_fraction:.0%} of the cell's pixels valid.")
    if "anomaly" in ds:
        notes.append("Anomaly-flagged pixels " + ("EXCLUDED (--mask-anomaly)." if mask_anomaly else
                     "kept (data lane: measured effect ~2 mm; excluding them blanks a 19% stripe)."))
    calib, significance_text = None, None
    if calibrate:
        lat_c, lon_c = grid.centres()
        calib = seasonal.calibrate_amplitude_threshold(f, seasonal.control_mask(lat_c, lon_c, control_boxes), alpha)
        if calib.amp_threshold_m is None:
            significance_text = (
                f"Seasonal labels unavailable: {calib.n_control} usable stable control cells "
                f"(need {seasonal.MIN_CONTROL_CELLS})"
            )
            notes.append(significance_text)
        else:
            significance_text = (
                f"joint F-test on (a,b), p < {alpha}, AND amplitude > {calib.amp_threshold_m * 1000:.1f} mm; "
                f"threshold calibrated so {calib.pass_rate:.0%} of {calib.n_control} stable control cells pass "
                f"(F-test alone: {calib.raw_pass_rate:.0%})")
            notes.append("Stable control areas: " + "; ".join(
                f"{b.name} (lat {b.lat_min}..{b.lat_max}, lon {b.lon_min}..{b.lon_max})" for b in control_boxes))
    calibration_failed = calib is not None and calib.amp_threshold_m is None
    threshold = np.inf if calibration_failed else (calib.amp_threshold_m if calib else None)
    s = seasonal.evaluate(f, alpha, threshold)
    if calibration_failed:
        s.fitted = np.zeros_like(s.fitted)

    # 6. model-free motion
    cum = netchange.cumulative(cells)            # (n_dates, ncells)
    net = cum[-1]
    net_sigma = np.where(np.isfinite(net), sigma_net_m, np.nan)

    # 7. labels
    lab = labels.label(net, sigma_net_m, s.significant)

    # 8. export the contract files
    reference_station = ds.attrs.get("reference_station", "P304")
    if isinstance(reference_station, bytes):
        reference_station = reference_station.decode("utf-8")
    if component == "up":
        notes.append(
            f"Vertical cross-check only (D7, D9). Relative to {reference_station}. "
            "Hanford (CAHA) has no descending coverage. North motion is assumed zero."
        )
    c = fit.offset_for_first_date(timebase.to_years([dates[0]])[0], f.B, f.a, f.b)
    granules = ds["granule_id"].values if "granule_id" in ds else [None] * npair
    iono = ds["iono_applied"].values if "iono_applied" in ds else [None] * npair
    pairs = [{"pair": k + 1, "ref_date": dates[k].isoformat(), "sec_date": dates[k + 1].isoformat(),
              "granule_id": None if granules[k] is None else str(granules[k]),
              "iono_applied": None if iono[k] is None else bool(iono[k]),
              "used_in_fit": not bool(exclude[k])} for k in range(npair)]
    stations_json = None
    if stations.gps_files_present(gps_dir, component):
        if component == "up":
            gps = stations.load_vertical_gps(gps_dir, dates, reference_station)
            notes.append(
                "Vertical station comparisons use the app cell and seven-day GPS Up medians. "
                "Curves are aligned at the first shared observation. Residuals compare changes."
            )
        else:
            gps = stations.load_gps(gps_dir)
        stations_json = stations.build_stations(
            gps, dates=dates, grid=grid, cumulative=cum, fit=f, seasonal=s, c=c,
            is_synthetic=is_synthetic, placeholder_coords=placeholder_station_coords,
            component=component, alpha=alpha)
    else:
        notes.append("stations.json not written: GPS files missing.")

    # Optional profiles are named before metadata is built (contract v1.2).
    profiles = {}
    for path in canals:
        for name, line in canal.read_lines(path):
            fname = f"canal_profile_{canal.slug(name)}.json"
            if fname in profiles:
                raise ValueError(f"Multiple canal profiles use the same file name: {fname}")
            profiles[fname] = canal.profile(
                name, line, grid, net=net, net_sigma=net_sigma, trend=f.B,
                trend_sigma=f.sigma_B, label=lab, is_synthetic=is_synthetic, source=Path(path).name)
    held_out = [s["station"] for s in stations_json["stations"] if s["role"] == "held_out"] if stations_json else []
    meta = export.build_meta(is_synthetic=is_synthetic, grid_meta=grid.as_meta(), dates=dates, pairs=pairs,
                             sigma_net_m=sigma_net_m, sigma_source=sigma_source, alpha=alpha, notes=notes,
                             sign_convention=comp["sign"], product=comp["product"] if not is_synthetic else None,
                             significance=significance_text, reference_station=reference_station,
                             held_out=held_out, canal_profiles=sorted(profiles))
    if component == "up":
        meta["component"] = component
    grid_json = export.build_grid(is_synthetic=is_synthetic, net=net, net_sigma=net_sigma, label=lab,
                                  seasonal=s, fit=f, c=c, n_valid_dates=netchange.n_valid_dates(cum))
    series = export.build_series(is_synthetic=is_synthetic, cumulative_cells=cum)
    out_dir.mkdir(parents=True, exist_ok=True)
    sizes = {fname: export.write_json(out_dir / fname, prof) for fname, prof in profiles.items()}
    sizes.update(export.write_all(out_dir, meta, grid_json, series, stations_json))

    counts = np.bincount(lab, minlength=4).tolist()
    return {"label_counts": counts, "n_fitted": int(f.fitted.sum()), "n_significant": int(s.significant.sum()),
            "n_net": int(np.isfinite(net).sum()), "sizes": sizes, "fit": f, "seasonal": s, "net": net,
            "labels": lab, "cumulative": cum, "stations": stations_json, "calibration": calib,
            "guard": guard}


def run_synthetic(out_dir=REPO / "analysis" / "_synthetic_out", seed: int = 0) -> dict:
    """Fake stack + fake GPS + fake canal -> full pipeline. sigma_net is measured like the
    real one will be: from the misfit against an independent 'truth' (here the synthetic truth)."""
    from . import synthetic

    out_dir = Path(out_dir)
    ds, _ = synthetic.make_stack(seed=seed)
    gps_dir = out_dir / "_gps"
    synthetic.make_gps_files(gps_dir, ds)
    canal_path = out_dir / "_context" / "synthetic_canal.geojson"
    synthetic.make_canal_geojson(canal_path)

    grid = regrid.AppGrid()
    lat_c, lon_c = grid.centres()
    B, a, b = synthetic.truth_fields(lat_c, lon_c)
    t = timebase.to_years(synthetic.nisar_like_dates())
    true_net = synthetic.series_from_params(t, B, a, b)[:, -1]

    probe = run(ds, 1.0, "probe", out_dir, grid=grid, is_synthetic=True)   # net change only
    ok = np.isfinite(probe["net"])
    sigma = float(np.sqrt(np.mean((probe["net"][ok] - true_net[ok]) ** 2)))
    return run(ds, sigma, "synthetic: RMS of net change vs synthetic truth", out_dir, grid=grid,
               is_synthetic=True, gps_dir=gps_dir, canals=[canal_path], placeholder_station_coords=True,
               notes=["SYNTHETIC DATA for testing the analysis pipeline. Not NASA data."])


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description="Breathing Ground analysis pipeline")
    ap.add_argument("--synthetic", action="store_true", help="run on a fake stack with a known answer")
    ap.add_argument("--stack", help="path to the pair stack (contracts/stack.md)")
    ap.add_argument("--sigma-json", help="path to gps/processed/uncertainty.json (contracts/gps.md)")
    ap.add_argument("--sigma-net-m", type=float, help="PROVISIONAL sigma of net change (m) when uncertainty.json "
                    "does not exist yet; needs --sigma-source and is recorded as provisional")
    ap.add_argument("--sigma-source", help="where --sigma-net-m comes from (written into meta.json)")
    ap.add_argument("--mask-anomaly", action="store_true", help="drop the stack's anomaly-flagged pixels")
    ap.add_argument("--min-valid-fraction", type=float, default=None,
                    help=f"share of a cell's pixels that must be valid up to a date (default {regrid.MIN_VALID_FRACTION})")
    ap.add_argument("--note", action="append", default=[], help="extra note for meta.json (repeatable)")
    ap.add_argument("--gps-dir", default=str(REPO / "gps" / "processed"), help="folder with Daniel's GPS CSVs")
    ap.add_argument("--canal", action="append", default=[], help="GeoJSON canal centre line (repeatable)")
    ap.add_argument("--component", choices=sorted(COMPONENTS), default="los", help="los (default) or up")
    ap.add_argument("--var", help="displacement variable in the stack (default: los_disp_m / up_disp_m)")
    ap.add_argument("--out", help="output folder (default: frontend/public/data for los)")
    ap.add_argument("--no-trend-guard", action="store_true", help="show every fit, even unreliable ones (comparison only)")
    ap.add_argument("--no-calibration", action="store_true", help="F-test only (not recommended, see D5)")
    ap.add_argument("--exclude-pairs", type=int, nargs="*", default=[], help="pair numbers to drop from the fit")
    args = ap.parse_args(argv)

    if args.synthetic:
        res = run_synthetic(Path(args.out) if args.out else REPO / "analysis" / "_synthetic_out")
    else:
        if not args.stack or not (args.sigma_json or args.sigma_net_m is not None):
            ap.error("real runs need --stack and --sigma-json (or a provisional --sigma-net-m), or use --synthetic")
        if args.component != "los" and not args.out:
            ap.error("--component up needs --out, so it never overwrites the LOS app files")
        if args.sigma_json:
            sigma, source = load_sigma(args.sigma_json)
        else:
            if not args.sigma_source:
                ap.error("--sigma-net-m needs --sigma-source")
            sigma, source = args.sigma_net_m, "PROVISIONAL: " + args.sigma_source
        out = Path(args.out) if args.out else REPO / "frontend" / "public" / "data"
        with load_stack(args.stack) as ds:
            res = run(ds, sigma, source, out, exclude_pairs=args.exclude_pairs,
                      gps_dir=args.gps_dir, canals=args.canal, component=args.component, var=args.var,
                      calibrate=not args.no_calibration, mask_anomaly=args.mask_anomaly, notes=args.note,
                      min_valid_fraction=(regrid.MIN_VALID_FRACTION if args.min_valid_fraction is None
                                          else args.min_valid_fraction), trend_guard=not args.no_trend_guard)

    print("labels 0..3:", res["label_counts"], "| fitted cells:", res["n_fitted"],
          "| seasonal significant:", res["n_significant"], "| cells with net change:", res["n_net"])
    print("files:", {k: f"{v / 1e6:.2f} MB" for k, v in res["sizes"].items()})
    if res.get("guard") is not None:
        print(res["guard"].describe())
    c = res["calibration"]
    if c is not None:
        thr = "not calibrated" if c.amp_threshold_m is None else f"{c.amp_threshold_m * 1000:.1f} mm"
        print(f"seasonal threshold: {thr} | stable control cells: {c.n_control} | pass rate F-test alone "
              f"{c.raw_pass_rate:.1%} -> with threshold {c.pass_rate:.1%}")
    if res["stations"] is None:
        print("WARNING: no stations.json (GPS files missing); the app cannot load this dataset.")


if __name__ == "__main__":
    main()
