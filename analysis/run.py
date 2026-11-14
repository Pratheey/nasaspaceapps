"""The whole analysis pipeline, top to bottom.

Real data (once Pratheek's stack and Daniel's uncertainty exist):
    python -m analysis.run --stack <path>/stack_t034_f020.nc --sigma-json gps/processed/uncertainty.json

Synthetic end-to-end test (writes to analysis/_synthetic_out/, which git ignores):
    python -m analysis.run --synthetic
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from . import export, fit, labels, netchange, regrid, seasonal, timebase

REPO = Path(__file__).resolve().parent.parent


def load_stack(path):
    import xarray as xr

    return xr.open_dataset(path, engine="h5netcdf")


def load_sigma(path) -> tuple[float, str]:
    """sigma_net_m from Daniel's gps/processed/uncertainty.json (contracts/gps.md)."""
    info = json.loads(Path(path).read_text(encoding="utf-8"))
    return float(info["sigma_net_m"]), str(Path(path).as_posix())


def pixel_latlon(ds):
    if "lat" in ds and "lon" in ds:
        return np.asarray(ds["lat"]), np.asarray(ds["lon"])
    crs = ds.attrs.get("crs")
    if not crs:
        raise ValueError("stack has no lat/lon variables and no 'crs' attribute")
    crs = f"EPSG:{crs}" if str(crs).isdigit() else str(crs)
    return regrid.pixel_latlon(ds["x"].values, ds["y"].values, crs)


def run(ds, sigma_net_m: float, sigma_source: str, out_dir, *, grid=regrid.AppGrid(),
        is_synthetic: bool = False, exclude_pairs=(), alpha: float = seasonal.ALPHA,
        min_valid_fraction: float = 0.5, notes=()) -> dict:
    # 1. dates: check the chain and convert to years
    dates = netchange.check_chain(ds["ref_date"].values, ds["sec_date"].values)
    t_ref = timebase.to_years(ds["ref_date"].values)
    t_sec = timebase.to_years(ds["sec_date"].values)

    # 2. masked pixels stay missing
    disp = np.asarray(ds["los_disp_m"].values, dtype=float)
    disp[np.asarray(ds["valid"].values) == 0] = np.nan
    npair = disp.shape[0]

    # 3. radar pixels -> app cells (median per cell, per pair)
    lat, lon = pixel_latlon(ds)
    idx = regrid.cell_index(lat.ravel(), lon.ravel(), grid)
    cells, _ = regrid.aggregate(disp.reshape(npair, -1), idx, grid.ncells, min_valid_fraction)

    # 4. fit B, a, b per cell on the pairs
    exclude = np.zeros(npair, dtype=bool)
    for p in exclude_pairs:
        exclude[int(p) - 1] = True
    f = fit.fit_stack(cells, t_ref, t_sec, exclude_pairs=exclude)

    # 5. is the wave real? amplitude + peak month only where it is
    s = seasonal.evaluate(f, alpha)

    # 6. model-free motion
    cum = netchange.cumulative(cells)            # (n_dates, ncells)
    net = cum[-1]

    # 7. labels
    lab = labels.label(net, sigma_net_m, s.significant)

    # 8. export
    c = fit.offset_for_first_date(timebase.to_years([dates[0]])[0], f.B, f.a, f.b)
    granules = ds["granule_id"].values if "granule_id" in ds else [None] * npair
    iono = ds["iono_applied"].values if "iono_applied" in ds else [None] * npair
    pairs = [{"pair": k + 1, "ref_date": dates[k].isoformat(), "sec_date": dates[k + 1].isoformat(),
              "granule_id": None if granules[k] is None else str(granules[k]),
              "iono_applied": None if iono[k] is None else bool(iono[k]),
              "used_in_fit": not bool(exclude[k])} for k in range(npair)]
    meta = export.build_meta(is_synthetic=is_synthetic, grid_meta=grid.as_meta(), dates=dates, pairs=pairs,
                             sigma_net_m=sigma_net_m, sigma_source=sigma_source, alpha=alpha, notes=notes)
    grid_json = export.build_grid(is_synthetic=is_synthetic, net=net,
                                  net_sigma=np.where(np.isfinite(net), sigma_net_m, np.nan),
                                  label=lab, seasonal=s, fit=f, c=c,
                                  n_valid_dates=netchange.n_valid_dates(cum))
    series = export.build_series(is_synthetic=is_synthetic, cumulative_cells=cum)
    sizes = export.write_all(out_dir, meta, grid_json, series)

    counts = np.bincount(lab, minlength=4).tolist()
    return {"label_counts": counts, "n_fitted": int(f.fitted.sum()), "n_significant": int(s.significant.sum()),
            "n_net": int(np.isfinite(net).sum()), "sizes": sizes, "fit": f, "seasonal": s, "net": net,
            "labels": lab, "cumulative": cum}


def run_synthetic(out_dir=REPO / "analysis" / "_synthetic_out", seed: int = 0) -> dict:
    """Fake stack -> full pipeline. sigma_net is measured like the real one will be:
    from the misfit against an independent 'truth' (here the synthetic truth)."""
    from . import synthetic

    ds, _ = synthetic.make_stack(seed=seed)
    grid = regrid.AppGrid()
    lat_c, lon_c = grid.centres()
    B, a, b = synthetic.truth_fields(lat_c, lon_c)
    t = timebase.to_years(synthetic.nisar_like_dates())
    true_net = synthetic.series_from_params(t, B, a, b)[:, -1]

    # first pass with a placeholder sigma just to get net change per cell
    probe = run(ds, 1.0, "probe", out_dir, grid=grid, is_synthetic=True)
    ok = np.isfinite(probe["net"])
    sigma = float(np.sqrt(np.mean((probe["net"][ok] - true_net[ok]) ** 2)))
    return run(ds, sigma, "synthetic: RMS of net change vs synthetic truth", out_dir, grid=grid,
               is_synthetic=True, notes=["SYNTHETIC DATA for testing the analysis pipeline. Not NASA data."])


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description="Breathing Ground analysis pipeline")
    ap.add_argument("--synthetic", action="store_true", help="run on a fake stack with a known answer")
    ap.add_argument("--stack", help="path to stack_t034_f020.nc (contracts/stack.md)")
    ap.add_argument("--sigma-json", help="path to gps/processed/uncertainty.json (contracts/gps.md)")
    ap.add_argument("--out", help="output folder (default: frontend/public/data, or analysis/_synthetic_out)")
    ap.add_argument("--exclude-pairs", type=int, nargs="*", default=[], help="pair numbers to drop from the fit")
    args = ap.parse_args(argv)

    if args.synthetic:
        res = run_synthetic(Path(args.out) if args.out else REPO / "analysis" / "_synthetic_out")
    else:
        if not (args.stack and args.sigma_json):
            ap.error("real runs need --stack and --sigma-json (or use --synthetic)")
        sigma, source = load_sigma(args.sigma_json)
        out = Path(args.out) if args.out else REPO / "frontend" / "public" / "data"
        res = run(load_stack(args.stack), sigma, source, out, exclude_pairs=args.exclude_pairs)

    print("labels 0..3:", res["label_counts"], "| fitted cells:", res["n_fitted"],
          "| seasonal significant:", res["n_significant"], "| cells with net change:", res["n_net"])
    print("files:", {k: f"{v / 1e6:.2f} MB" for k, v in res["sizes"].items()})


if __name__ == "__main__":
    main()