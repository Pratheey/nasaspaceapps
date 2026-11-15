"""Summarize GCOV backscatter over fixed fields."""

import argparse
import json
from contextlib import ExitStack
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import rasterio
from rasterio.features import geometry_mask, geometry_window
from rasterio.warp import transform_geom

MIN_VALID_FRACTION = 0.5


def window_values(raster, geometry):
    projected = transform_geom("EPSG:4326", raster.crs, geometry)
    window = geometry_window(raster, [projected], boundless=True)
    domain = geometry_mask([projected], (int(window.height), int(window.width)),
                           raster.window_transform(window), invert=True)
    values = raster.read(1, window=window, boundless=True, masked=True)
    valid = domain & ~np.ma.getmaskarray(values) & np.isfinite(values.data)
    return values.data, valid, int(domain.sum())


def read_fields(path):
    fields = json.loads(path.read_text())["features"]
    ids = [field["properties"]["field_id"] for field in fields]
    if len(ids) != 30 or len(set(ids)) != 30:
        raise ValueError("The panel must contain 30 distinct field IDs.")
    return fields


def measured_path(manifest, path):
    # Raster paths in the manifest are relative to the manifest directory.
    return manifest.parent / path


def polarization(manifest, fields, out):
    records = pd.read_csv(manifest, dtype=str, keep_default_na=False)
    if records.empty or records["date"].duplicated().any():
        raise ValueError("Provide one GCOV scene per date from one track and frequency.")
    rows = []
    for scene in records.sort_values("date").itertuples(index=False):
        with ExitStack() as stack:
            hh, hv = [stack.enter_context(rasterio.open(measured_path(manifest, path)))
                      for path in (scene.hh_tif, scene.hv_tif)]
            if (hh.crs, hh.transform, hh.shape) != (hv.crs, hv.transform, hv.shape):
                raise ValueError(f"HH and HV grids differ for {scene.granule_id}.")
            for field in fields:
                info, geometry = field["properties"], field["geometry"]
                hh_values, hh_valid, n = window_values(hh, geometry)
                hv_values, hv_valid, _ = window_values(hv, geometry)
                valid = hh_valid & hv_valid & (hh_values > 0) & (hv_values > 0)
                fraction = int(valid.sum()) / n if n else 0
                hh_db = hv_db = ratio_db = np.nan
                if fraction >= MIN_VALID_FRACTION:
                    hh_db = 10 * np.log10(np.mean(hh_values[valid], dtype=np.float64))
                    hv_db = 10 * np.log10(np.mean(hv_values[valid], dtype=np.float64))
                    ratio_db = hv_db - hh_db
                rows.append(dict(date=scene.date, granule_id=scene.granule_id,
                                 field_id=info["field_id"], crop=info["crop"],
                                 polygon_pixels=n, valid_fraction=fraction,
                                 hh_db=hh_db, hv_db=hv_db, hv_over_hh_db=ratio_db))
    table = pd.DataFrame(rows)
    table.to_csv(out / "polarization_fields.csv", index=False)
    if table["hh_db"].isna().all():
        raise ValueError("No field has enough valid HH/HV pixels for a polarization result.")
    summary = table.groupby(["crop", "date"], as_index=False).agg(
        fields_measured=("hv_over_hh_db", "count"), hh_db=("hh_db", "median"),
        hv_db=("hv_db", "median"), hv_over_hh_db=("hv_over_hh_db", "median"),
    )
    summary.to_csv(out / "polarization_by_crop.csv", index=False)
    fig, (channels, ratio) = plt.subplots(2, 1, figsize=(10, 6.8), sharex=True,
                                         layout="constrained")
    for index, (crop, group) in enumerate(summary.groupby("crop")):
        dates = pd.to_datetime(group["date"])
        color = f"C{index}"
        channels.plot(dates, group["hh_db"], "o-", color=color, label=f"{crop} HH")
        channels.plot(dates, group["hv_db"], "x--", color=color, label=f"{crop} HV")
        ratio.plot(dates, group["hv_over_hh_db"], "o-", color=color, label=crop)
    channels.legend(ncols=3, fontsize=8)
    channels.set(ylabel="Backscatter (dB)", title="NISAR polarization by 2025 CDL crop class")
    ratio.set(ylabel="HV / HH (dB)", xlabel="NISAR acquisition date")
    for ax in (channels, ratio):
        ax.grid(alpha=0.25)
    fig.savefig(out / "polarization.png", dpi=165)
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--fields", type=Path, default=Path(__file__).parent / "catalog/fields.geojson")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    polarization(args.manifest, read_fields(args.fields), args.output)


if __name__ == "__main__":
    main()
