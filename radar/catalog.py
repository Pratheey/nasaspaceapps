"""Build the radar catalog and fixed field panel from public catalog exports."""

import argparse
import csv
import json
from collections import Counter
from datetime import date
from itertools import combinations
from pathlib import Path

import numpy as np
import rasterio
from rasterio.mask import mask
from rasterio.warp import transform_geom
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

CROPS = {2: "Cotton", 36: "Alfalfa", 75: "Almonds"}
ASCENDING = "034_A_020"
DESCENDING = "042_D_070"
FIELD_BOUNDS = box(-119.76, 35.96, -119.40, 36.25)


def catalog_entries(path, track):
    entries = json.loads(path.read_text())["feed"]["entry"]
    return sorted(
        (entry for entry in entries if f"_{track}_" in entry["title"]),
        key=lambda entry: entry["time_start"],
    )


def footprint(entry):
    polygons = []
    for group in entry["polygons"]:
        for ring in group:
            lat_lon = list(map(float, ring.split()))
            polygons.append(Polygon(zip(lat_lon[1::2], lat_lon[::2])))
    return unary_union(polygons)


def write_csv(path, rows):
    with path.open("w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def granule_row(entry):
    return dict(
        granule_id=entry["title"],
        cmr_id=entry["id"],
        start_date=entry["time_start"][:10],
        end_date=entry["time_end"][:10],
        data_url=next(link["href"] for link in entry["links"]
                      if link["href"].startswith("https://") and link["href"].endswith(".h5")),
    )


def pick_fields(candidates, cdl_path, common_footprint):
    candidates = json.loads(candidates.read_text())
    if candidates.get("properties", {}).get("exceededTransferLimit"):
        raise ValueError("Export the full field query before selecting the panel.")
    selected = []
    counts = Counter()
    ordered = sorted(candidates["features"], key=lambda f: (
        -f["properties"]["csbacres"], f["properties"]["csbid"],
    ))
    with rasterio.open(cdl_path) as cdl:
        for feature in ordered:
            if sum(counts.values()) == 30:
                break
            polygon = shape(feature["geometry"])
            if not polygon.is_valid or not common_footprint.covers(polygon):
                continue
            projected = transform_geom("EPSG:4326", cdl.crs, feature["geometry"])
            field_extent = rasterio.coords.BoundingBox(*shape(projected).bounds)
            if not (cdl.bounds.left <= field_extent.left <= field_extent.right <= cdl.bounds.right
                    and cdl.bounds.bottom <= field_extent.bottom <= field_extent.top <= cdl.bounds.top):
                continue
            values = mask(cdl, [projected], indexes=1, crop=True, filled=False)[0].compressed()
            if not len(values):
                continue
            code, count = Counter(values.tolist()).most_common(1)[0]
            purity = count / len(values)
            if code not in CROPS or purity < 0.9 or counts[code] == 10:
                continue
            counts[code] += 1
            point = polygon.representative_point()
            feature["properties"] = dict(
                field_id=feature["properties"]["csbid"], crop=CROPS[code], cdl_code=code,
                cdl_year=2025, cdl_fraction=round(purity, 4), boundary_end_year=2022,
                centroid_lon=round(polygon.centroid.x, 7),
                centroid_lat=round(polygon.centroid.y, 7),
                interior_lon=round(point.x, 7), interior_lat=round(point.y, 7),
                acres=round(feature["properties"]["csbacres"], 2),
            )
            selected.append(feature)
    if len(selected) != 30:
        raise ValueError(f"Need 10 fields of each crop. Found {dict(counts)}.")
    return sorted(selected, key=lambda f: (f["properties"]["crop"], f["properties"]["field_id"]))


def sentinel_matches(ascending, sentinel_path, fields):
    panel = unary_union([shape(f["geometry"]) for f in fields])
    scenes = json.loads(sentinel_path.read_text())["features"]
    scenes = sorted(
        (f["properties"] for f in scenes if shape(f["geometry"]).covers(panel)),
        key=lambda props: (props["startTime"], props["sceneName"]),
    )
    usable_pairs = []
    for first, second in combinations(scenes, 2):
        if first["pathNumber"] != second["pathNumber"] or first["platform"] != second["platform"]:
            continue
        start, end = (date.fromisoformat(scene["startTime"][:10]) for scene in (first, second))
        if (end - start).days in (12, 24):
            usable_pairs.append((start, end, first, second))

    for entry in ascending:
        row = granule_row(entry)
        start, end = (date.fromisoformat(row[key]) for key in ("start_date", "end_date"))
        length = (end - start).days
        match = min(
            (pair for pair in usable_pairs if (pair[1] - pair[0]).days == length
             and abs((pair[0] - start).days) <= 6 and abs((pair[1] - end).days) <= 6),
            key=lambda pair: (
                abs((pair[0] - start).days),
                pair[2]["frameNumber"] != pair[3]["frameNumber"],
                pair[0], pair[2]["sceneName"], pair[3]["sceneName"],
            ),
            default=None,
        )
        result = dict(
            nisar_granule_id=row["granule_id"], nisar_start=row["start_date"],
            nisar_end=row["end_date"], baseline_days=length,
            s1_start="", s1_end="", s1_offset_days="", s1_path="", s1_platform="",
            s1_reference="", s1_secondary="", status="no_match_within_6_days",
        )
        if match:
            s1_start, s1_end, first, second = match
            result.update(
                s1_start=s1_start.isoformat(), s1_end=s1_end.isoformat(),
                s1_offset_days=(s1_start - start).days, s1_path=first["pathNumber"],
                s1_platform=first["platform"], s1_reference=first["sceneName"],
                s1_secondary=second["sceneName"], status="candidate",
            )
        yield result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inputs", type=Path, help="Folder of CMR, ASF and USDA exports")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    gcov = catalog_entries(args.inputs / "gcov.json", ASCENDING)
    ascending = catalog_entries(args.inputs / "gunw.json", ASCENDING)
    descending = catalog_entries(args.inputs / "gunw.json", DESCENDING)
    if not all((gcov, ascending, descending)):
        raise ValueError("One or more NISAR catalog selections are empty.")
    common = FIELD_BOUNDS.intersection(footprint(gcov[0]))
    for entry in gcov[1:] + ascending:
        common = common.intersection(footprint(entry))
    fields = pick_fields(args.inputs / "csb_candidates.geojson",
                         args.inputs / "cdl_2025.tif", common)
    matches = list(sentinel_matches(ascending, args.inputs / "sentinel.json", fields))
    args.output.mkdir(parents=True, exist_ok=True)
    for name, entries in (("gcov", gcov), ("ascending_gunw", ascending),
                          ("descending_gunw", descending)):
        write_csv(args.output / f"{name}.csv", [granule_row(entry) for entry in entries])
    write_csv(args.output / "fields.csv", [field["properties"] for field in fields])
    write_csv(args.output / "sentinel_matches.csv", matches)
    (args.output / "fields.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": fields}, separators=(",", ":"))
        + "\n"
    )


if __name__ == "__main__":
    main()
