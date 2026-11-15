"""Build the provisional H-16 stack and check H-13 against held-out GPS."""
from __future__ import annotations

import argparse
from pathlib import Path

import h5netcdf
import h5py
import numpy as np
import pandas as pd
from pyproj import CRS, Transformer

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = "P304"
GPS_COLUMNS = ["east_m_corr", "north_m_corr", "up_m_corr"]
LOOK_COLUMNS = ["los_east", "los_north", "los_up"]
STRING = h5py.string_dtype(encoding="utf-8")
NOTES = (
    "H-13/H-16, provisional cross-check (D7). Native ascending grid; descending sampled "
    "with nearest neighbour. Ascending acquisition matched to nearest unique descending "
    "acquisition within 6 days; no temporal interpolation. Each output interval sums the "
    "original increments on each track between the two matched epochs, requiring all "
    "constituent pixels to be valid. Subtracted both inputs' P304 GPS LOS tie before "
    "inversion; displacement is relative to P304. North motion assumed zero. Geometry "
    "condition number capped at 10. Positive up and east, metres."
)


def gps_at(enu, station, date):
    """Seven-day median of cleaned daily positions with at least three finite samples."""
    series = enu.loc[station]
    day = pd.Timestamp(date)
    radius = pd.Timedelta(days=3)
    samples = series.loc[day - radius:day + radius]
    positions = samples[GPS_COLUMNS].copy()
    transient = samples.flag.str.contains("post-swap noisy", na=False)
    positions.loc[transient, [GPS_COLUMNS[0], GPS_COLUMNS[2]]] = np.nan
    if day in samples.index and transient.loc[day]:
        positions.loc[:, [GPS_COLUMNS[0], GPS_COLUMNS[2]]] = np.nan
    return positions.median().where(positions.count() >= 3).to_numpy()


def gps_positions(enu, dates, names):
    return {
        name: np.array([gps_at(enu, name, date) for date in dates])
        for name in names
    }


def descending_gps_check(gps, stations, out):
    sample = pd.read_csv(ROOT / "data/processed/station_values_t042_f070.csv")
    sample = sample.sort_values(["pair", "station"]).reset_index(drop=True)
    pairs = sample[["ref_date", "sec_date"]].drop_duplicates()
    dates = np.array([pairs.ref_date.iloc[0], *pairs.sec_date])
    delta = {name: np.diff(position, axis=0)
             for name, position in gps_positions(gps, dates, stations.station).items()}
    ref_look = sample[sample.station == REFERENCE][LOOK_COLUMNS].to_numpy()
    gps_los = []
    for r in sample.itertuples():
        i = r.pair - 1
        look = [r.los_east, r.los_north, r.los_up]
        gps_los.append(delta[r.station][i] @ look - delta[REFERENCE][i] @ ref_look[i])
    sample["radar_los_relative_m"] = (sample.los_disp_m - sample.ref_tie_m).where(sample.valid == 1)
    sample["gps_los_relative_m"] = gps_los
    sample = sample.merge(stations[["station", "role"]], on="station")
    sample.loc[sample.role == "held_out", "los_residual_m"] = (
        sample.radar_los_relative_m - sample.gps_los_relative_m
    )
    sample["status"] = "compared"
    sample.loc[sample.gps_los_relative_m.isna(), "status"] = "GPS unavailable or flagged"
    sample.loc[sample.valid == 0, "status"] = "descending radar unavailable"
    sample.loc[sample.role == "reference", "status"] = "reference"
    sample[["pair", "ref_date", "sec_date", "station", "role", "valid", "n_valid_px",
            "radar_los_relative_m", "gps_los_relative_m", "los_residual_m", "status"]].to_csv(
        out / "descending_los_gps.csv", index=False, float_format="%.6f"
    )


def chain_dates(first, last):
    if not (np.all(first[1:] == last[:-1]) and np.all(first < last)):
        raise ValueError("Input dates must be a chronological sequential pair chain")
    return np.array([first[0], *last], dtype="datetime64[D]")


def stack_dates(stack):
    return chain_dates(stack["ref_date"].asstr()[:], stack["sec_date"].asstr()[:])


def align_dates(asc, desc):
    offsets = (desc[None, :] - asc[:, None]).astype(int)
    nearest = np.abs(offsets).argmin(axis=1)
    closest_offset = offsets[np.arange(len(asc)), nearest]
    keep = np.abs(closest_offset) <= 6
    matched = nearest[keep]
    if len(matched) < 2 or np.any(np.diff(matched) <= 0):
        raise ValueError("Date matches must include at least two distinct chronological epochs")
    return pd.DataFrame({
        "asc_date": asc.astype(str),
        "nearest_desc_date": desc[nearest].astype(str),
        "desc_minus_asc_days": closest_offset,
        "matched": keep,
        "asc_epoch_index": np.arange(len(asc)),
        "desc_epoch_index": nearest,
    })


def grid(stack):
    x, y = stack["x"][:], stack["y"][:]
    dx, dy = x[1] - x[0], y[1] - y[0]
    if not (np.allclose(np.diff(x), dx) and np.allclose(np.diff(y), dy)):
        raise ValueError("The source raster grid is irregular")
    return x, y, CRS.from_user_input(stack.attrs["crs"].decode())


def regrid_to(source, target):
    src_x, src_y, src_crs = source
    x, y, dst_crs = target
    if src_crs == dst_crs and np.array_equal(src_x, x) and np.array_equal(src_y, y):
        return lambda values: values

    transform = Transformer.from_crs(dst_crs, src_crs, always_xy=True)
    sx, sy = transform.transform(*np.meshgrid(x, y))
    ix = np.floor((sx - src_x[0]) / (src_x[1] - src_x[0]) + 0.5).astype(int)
    iy = np.floor((sy - src_y[0]) / (src_y[1] - src_y[0]) + 0.5).astype(int)
    inside = (ix >= 0) & (ix < len(src_x)) & (iy >= 0) & (iy < len(src_y))
    source_indices = (iy[inside], ix[inside])

    def warp(values):
        destination = np.full((len(y), len(x)), np.nan, dtype=np.float32)
        destination[inside] = values[source_indices]
        return destination

    return warp


def interval_los(stack, start, stop):
    ties = stack["ref_tie_m"][start:stop]
    if not np.isfinite(ties).all():
        raise ValueError("Missing P304 LOS tie")
    result = np.zeros(stack["los_disp_m"].shape[1:], dtype=np.float32)
    for index, tie in enumerate(ties, start=start):
        displacement = stack["los_disp_m"][index]
        displacement[stack["valid"][index] != 1] = np.nan
        result += displacement - tie
    return result


def solve_geometry(asc_e, asc_u, desc_e, desc_u):
    det = asc_e * desc_u - desc_e * asc_u
    frob_sq = asc_e**2 + asc_u**2 + desc_e**2 + desc_u**2
    discriminant = np.maximum(frob_sq**2 - 4 * det**2, 0)
    # For a 2x2 matrix, cond = largest singular value squared / abs(det).
    with np.errstate(divide="ignore", invalid="ignore"):
        condition = (frob_sq + np.sqrt(discriminant)) / (2 * np.abs(det))
    return det, np.isfinite(condition) & (condition <= 10)


def station_intervals(table, names, indices):
    """Sum consecutive LOS increments from the data lane's station samples."""
    shape = (len(indices) - 1, len(names))
    los, east, up = (np.full(shape, np.nan) for _ in range(3))
    for i, (start, end) in enumerate(zip(indices, indices[1:])):
        subset = table[table.pair.between(start + 1, end)]
        for j, name in enumerate(names):
            station = subset[subset.station == name]
            if len(station) != end - start or not (station.valid == 1).all():
                continue
            relative = station.los_disp_m - station.ref_tie_m
            if relative.notna().all():
                los[i, j] = relative.sum()
                east[i, j] = station.los_east.mean()
                up[i, j] = station.los_up.mean()
    return los, east, up


def station_only(gps, stations, out):
    processed = ROOT / "data/processed"
    asc = pd.read_csv(processed / "station_values.csv")
    desc = pd.read_csv(processed / "station_values_t042_f070.csv")
    chains = []
    for table in (asc, desc):
        pairs = table.sort_values("pair")[["ref_date", "sec_date"]].drop_duplicates()
        chains.append(chain_dates(pairs.ref_date.to_numpy(), pairs.sec_date.to_numpy()))
    dates = align_dates(*chains)
    dates.to_csv(out / "vertical_date_matches.csv", index=False)
    matches = dates.loc[dates.matched]
    a, ae, au = station_intervals(asc, stations.station, matches.asc_epoch_index.to_numpy())
    d, de, du = station_intervals(desc, stations.station, matches.desc_epoch_index.to_numpy())
    determinant, valid = solve_geometry(ae, au, de, du)
    up = np.divide(ae * d - de * a, determinant, out=np.full_like(a, np.nan), where=valid)
    east = np.divide(du * a - au * d, determinant, out=np.full_like(a, np.nan), where=valid)
    vertical_gps_check(up, east, gps, stations, matches, out)


def stack_outputs(asc, desc, dates, stations, out):
    asc_grid = grid(asc)
    x, y, crs = asc_grid
    to_asc = regrid_to(grid(desc), asc_grid)
    ae, au = asc["los_east"][:], asc["los_up"][:]
    de, du = to_asc(desc["los_east"][:]), to_asc(desc["los_up"][:])
    determinant, geometry_valid = solve_geometry(ae, au, de, du)
    transform = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    sites = []
    for row in stations.itertuples():
        sx, sy = transform.transform(row.lon, row.lat)
        ix, iy = np.abs(x - sx).argmin(), np.abs(y - sy).argmin()
        inside = (abs(x[ix] - sx) <= abs(x[1] - x[0]) / 2
                  and abs(y[iy] - sy) <= abs(y[1] - y[0]) / 2)
        sites.append((iy, ix, inside))

    n = len(dates) - 1
    up_at_station = np.full((n, len(stations)), np.nan)
    east_at_station = np.full_like(up_at_station, np.nan)
    coverage = []
    complete = geometry_valid.copy()
    tmp = out / "vertical_t034_t042.tmp"
    with h5netcdf.File(tmp, "w") as f:
        f.dimensions = {"pair": n, "y": len(y), "x": len(x)}
        f.attrs.update(
            crs=crs.to_string(), reference_station=REFERENCE, sign_convention="positive up",
            product_maturity="provisional", notes=NOTES, ascending_source="stack_t034_f020_v2.nc",
            descending_source="stack_t042_f070.nc",
        )
        for dim, coord in (("pair", np.arange(1, n + 1, dtype="int32")), ("y", y), ("x", x)):
            f.create_variable(dim, (dim,), data=coord)
        for prefix, slc in (("ref", slice(None, -1)), ("sec", slice(1, None))):
            f.create_variable(f"{prefix}_date", ("pair",), dtype=STRING)[:] = dates.asc_date.to_numpy()[slc]
            f.create_variable(f"desc_{prefix}_date", ("pair",), dtype=STRING)[:] = dates.nearest_desc_date.to_numpy()[slc]
            f.create_variable(f"desc_{prefix}_offset_days", ("pair",),
                              data=dates.desc_minus_asc_days.to_numpy(dtype="int16")[slc])
        chunks = (1, min(256, len(y)), min(256, len(x)))
        variables = {}
        for name in ("up_disp_m", "east_disp_m", "valid"):
            variables[name] = f.create_variable(
                name, ("pair", "y", "x"), dtype="u1" if name == "valid" else "f4",
                chunks=chunks, compression="gzip", compression_opts=2, shuffle=True,
                fillvalue=None if name == "valid" else np.nan,
            )
        variables["up_disp_m"].attrs.update(units="m", positive="up")
        variables["east_disp_m"].attrs.update(units="m", positive="east")
        for i, (start, end) in enumerate(zip(dates.iloc[:-1].itertuples(), dates.iloc[1:].itertuples())):
            a = interval_los(asc, start.asc_epoch_index, end.asc_epoch_index)
            d = to_asc(interval_los(desc, start.desc_epoch_index, end.desc_epoch_index))
            valid = geometry_valid & np.isfinite(a) & np.isfinite(d)
            up = np.full_like(a, np.nan)
            east = np.full_like(a, np.nan)
            np.divide(ae * d - de * a, determinant, out=up, where=valid)
            np.divide(du * a - au * d, determinant, out=east, where=valid)
            variables["up_disp_m"][i] = up
            variables["east_disp_m"][i] = east
            variables["valid"][i] = valid
            complete &= valid
            for j, (iy, ix, inside) in enumerate(sites):
                if inside:
                    up_at_station[i, j] = up[iy, ix]
                    east_at_station[i, j] = east[iy, ix]
            coverage.append({
                "pair": i + 1, "ref_date": start.asc_date, "sec_date": end.asc_date,
                "desc_ref_date": start.nearest_desc_date, "desc_sec_date": end.nearest_desc_date,
                "asc_input_pairs": end.asc_epoch_index - start.asc_epoch_index,
                "desc_input_pairs": end.desc_epoch_index - start.desc_epoch_index,
                "valid_pixels": int(valid.sum()), "valid_fraction_of_asc_grid": valid.mean(),
            })
        f.attrs["n_pixels_valid_all_pairs"] = int(complete.sum())
        f.attrs["n_pixels_valid_geometry"] = int(geometry_valid.sum())
    tmp.replace(out / "vertical_t034_t042.nc")
    pd.DataFrame(coverage).to_csv(out / "vertical_pair_coverage.csv", index=False, float_format="%.6f")
    return up_at_station, east_at_station


def rms(values):
    if len(values):
        return float(np.sqrt(np.mean(np.square(values))))
    return np.nan


def longest_comparison(radar, gps):
    """Longest shared span with GPS at both ends and every radar increment observed."""
    edges = np.r_[0, np.flatnonzero(~np.isfinite(radar)) + 1, len(radar) + 1]
    best = None
    for start, stop in zip(edges, edges[1:]):
        epochs = np.flatnonzero(np.isfinite(gps[start:stop])) + start
        if len(epochs) >= 2:
            first, last = epochs[0], epochs[-1]
            if best is None or last - first > best[1] - best[0]:
                best = first, last
    return best


def vertical_gps_check(up, east, gps, stations, dates, out):
    positions = gps_positions(gps, dates.asc_date, stations.station)
    rows, summary = [], []
    for j, row in enumerate(stations.itertuples()):
        relative = positions[row.station] - positions[REFERENCE]
        if row.role != "held_out":
            relative[:] = np.nan
        # The post-swap P307 east offset remains unresolved in the cleaned GPS series.
        if row.station == "P307":
            relative[:, 0] = np.nan
        gps_east, _, gps_up = np.diff(relative, axis=0).T
        residual_up = up[:, j] - gps_up
        residual_east = east[:, j] - gps_east
        valid_up = np.isfinite(residual_up)
        valid_east = np.isfinite(residual_east)
        for i, (start, end) in enumerate(zip(dates.asc_date, dates.asc_date.iloc[1:])):
            rows.append({
                "pair": i + 1, "ref_date": start, "sec_date": end, "station": row.station,
                "role": row.role, "radar_up_m": up[i, j], "gps_up_m": gps_up[i],
                "up_residual_m": residual_up[i], "radar_east_m": east[i, j],
                "gps_east_m": gps_east[i], "east_residual_m": residual_east[i],
            })
        result = {
            "station": row.station, "role": row.role,
            "n_radar_pairs": int(np.isfinite(up[:, j]).sum()),
            "n_up_pairs_compared": int(valid_up.sum()), "up_pair_rms_m": rms(residual_up[valid_up]),
            "n_east_pairs_compared": int(valid_east.sum()), "east_pair_rms_m": rms(residual_east[valid_east]),
        }
        for name, radar, position in (
            ("up", up[:, j], relative[:, 2]), ("east", east[:, j], relative[:, 0]),
        ):
            result[f"radar_{name}_net_m"] = radar.sum() if np.isfinite(radar).all() else np.nan
            result[f"gps_{name}_net_m"] = position[-1] - position[0]
            result[f"{name}_net_residual_m"] = result[f"radar_{name}_net_m"] - result[f"gps_{name}_net_m"]
            span = longest_comparison(radar, position)
            if span is not None:
                first, last = span
                result[f"{name}_shared_start"] = dates.asc_date.iloc[first]
                result[f"{name}_shared_end"] = dates.asc_date.iloc[last]
                result[f"radar_{name}_shared_m"] = radar[first:last].sum()
                result[f"gps_{name}_shared_m"] = position[last] - position[first]
        summary.append(result)
    pd.DataFrame(rows).to_csv(out / "vertical_gps_pairs.csv", index=False, float_format="%.6f")
    pd.DataFrame(summary).to_csv(out / "vertical_gps_stations.csv", index=False, float_format="%.6f")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asc", type=Path)
    parser.add_argument("--desc", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--descending-check-only", action="store_true")
    mode.add_argument("--station-only", action="store_true")
    args = parser.parse_args()
    if not (args.descending_check_only or args.station_only) and (args.asc is None or args.desc is None):
        parser.error("--asc and --desc are required to generate the vertical stack")
    args.out.mkdir(parents=True, exist_ok=True)
    gps_dir = ROOT / "gps/processed"
    gps = pd.read_csv(gps_dir / "gps_cleaned_enu.csv", parse_dates=["date"]).set_index(
        ["station", "date"]
    ).sort_index()
    stations = pd.read_csv(gps_dir / "stations.csv")
    descending_gps_check(gps, stations, args.out)
    if args.descending_check_only:
        return
    if args.station_only:
        station_only(gps, stations, args.out)
        return
    with h5py.File(args.asc) as asc, h5py.File(args.desc) as desc:
        for stack, track, frame in ((asc, 34, 20), (desc, 42, 70)):
            if (stack.attrs["reference_station"] != b"P304" or stack.attrs["product_maturity"] != b"provisional"
                    or stack.attrs["sign_convention"] != b"positive toward satellite"
                    or np.asarray(stack.attrs["track"]).item() != track
                    or np.asarray(stack.attrs["frame"]).item() != frame):
                raise ValueError("Unexpected input stack metadata")
        dates = align_dates(stack_dates(asc), stack_dates(desc))
        dates.to_csv(args.out / "vertical_date_matches.csv", index=False)
        matches = dates.loc[dates.matched]
        up, east = stack_outputs(asc, desc, matches, stations, args.out)
    vertical_gps_check(up, east, gps, stations, matches, args.out)


if __name__ == "__main__":
    main()
