"""Turn the radar lane's result tables into the small app files in frontend/public/radar/.

Reads radar/results/ (polarization and Sentinel-1 coverage, hour 28) and radar/catalog/fields.geojson.
Writes polarization.json, coverage.json and fields.json (GeoJSON) (shape: contracts/radar_app.md).

    python3 radar/app_export.py
"""
import csv, json, statistics as st
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RES, OUT = ROOT / "results", ROOT.parent / "frontend" / "public" / "radar"
THRESHOLD = 0.30
r4 = lambda v: None if v is None else round(v, 4)


def rows(name):
    with open(RES / name, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    fld = rows("nisar-polarization-fields.csv")
    crop_rows = rows("nisar-polarization-by-crop.csv")
    dates = sorted({r["date"] for r in crop_rows})
    crops = sorted({r["crop"] for r in crop_rows})
    by = {(r["crop"], r["date"]): r for r in crop_rows}
    series = {}
    for c in crops:
        g = lambda k: [r4(float(by[(c, d)][k])) if (c, d) in by and by[(c, d)][k] else None for d in dates]
        series[c] = {"hh_db": g("hh_db"), "hv_db": g("hv_db"), "hv_over_hh_db": g("hv_over_hh_db"),
                     "fields_measured": [int(by[(c, d)]["fields_measured"]) if (c, d) in by else 0 for d in dates]}
    summary = {c: r4(st.median([v for v in series[c]["hv_over_hh_db"] if v is not None])) for c in crops}
    pol = {
        "is_synthetic": False, "product": "NISAR L2 GCOV", "product_maturity": "provisional",
        "track": 34, "direction": "ascending", "frame": 20,
        "fields": len({r["field_id"] for r in fld}), "measurements": len(fld),
        "crop_labels": "USDA Cropland Data Layer 2025, field boundaries USDA Crop Sequence Boundaries",
        "dates": dates, "crops": crops, "series": series, "median_hv_over_hh_db": summary,
        "caveat": "Differences in the radar echo can reflect crop structure, moisture and field management.",
    }

    pairs = rows("matched-radar-coverage-by-pair.csv")
    out_pairs = {}
    for r in pairs:
        p = out_pairs.setdefault(r["nisar_start"], {
            "nisar_start": r["nisar_start"], "nisar_end": r["nisar_end"],
            "s1_start": r["s1_start"], "s1_end": r["s1_end"], "fields": int(r["fields_total"])})
        key = "nisar" if r["sensor"] == "NISAR" else "s1"
        p[f"{key}_usable"] = int(r["fields_usable"])
        p[f"{key}_measured"] = int(r["fields_measured"])
    pairs_l = sorted(out_pairs.values(), key=lambda p: p["nisar_start"])
    byf = rows("matched-radar-coverage-by-field.csv")
    tot = lambda s: (sum(r["usable"] == "True" for r in byf if r["sensor"] == s), sum(r["sensor"] == s for r in byf))
    cov = {
        "is_synthetic": False, "threshold_median_coherence": THRESHOLD, "fields": 30,
        "nisar_product": "NISAR L2 GUNW, provisional, track 34 ascending, frame 20",
        "s1_product": "Sentinel-1 interferograms processed with ASF HyP3",
        "matching": "Same interval as the NISAR pair, start date at most six days apart",
        "totals": {"nisar": dict(zip(["usable", "checks"], tot("NISAR"))), "s1": dict(zip(["usable", "checks"], tot("Sentinel-1")))},
        "pairs": pairs_l,
        "caveat": "Compares the available products over these fields and dates. Radar wavelength, imaging geometry, processing and the date offsets can affect coherence.",
    }

    # per-field stats on the field outlines
    rat = defaultdict(list); ser = defaultdict(dict); pas = defaultdict(lambda: {"NISAR": [0, 0], "Sentinel-1": [0, 0]})
    for r in fld:
        if r["hv_over_hh_db"]:
            rat[r["field_id"]].append(float(r["hv_over_hh_db"])); ser[r["field_id"]][r["date"]] = round(float(r["hv_over_hh_db"]), 2)
    for r in byf:
        c = pas[r["field_id"]][r["sensor"]]; c[1] += 1; c[0] += r["usable"] == "True"
    gj = json.load(open(ROOT / "catalog" / "fields.geojson", encoding="utf-8"))
    rnd = lambda x: [rnd(v) for v in x] if isinstance(x[0], list) else [round(x[0], 5), round(x[1], 5)]
    feats = []
    for f in gj["features"]:
        fid = f["properties"]["field_id"]
        geom = f["geometry"]; geom = {"type": geom["type"], "coordinates": rnd(geom["coordinates"])}
        feats.append({"type": "Feature", "geometry": geom, "properties": {
            "field_id": fid, "crop": f["properties"]["crop"], "acres": f["properties"]["acres"],
            "lon": f["properties"]["interior_lon"], "lat": f["properties"]["interior_lat"],
            "hv_over_hh_db_median": r4(st.median(rat[fid])) if rat[fid] else None,
            "nisar_usable": pas[fid]["NISAR"][0], "s1_usable": pas[fid]["Sentinel-1"][0], "pairs": pas[fid]["NISAR"][1],
            "hv_over_hh_db": [ser[fid].get(d) for d in dates]}})
    for name, obj in [("polarization.json", pol), ("coverage.json", cov), ("fields.json", {"type": "FeatureCollection", "features": feats})]:
        (OUT / name).write_text(json.dumps(obj, separators=(",", ":")), encoding="utf-8")
        print(name, (OUT / name).stat().st_size, "bytes")
    print("NISAR", cov["totals"]["nisar"], "S1", cov["totals"]["s1"], "medians", summary)


if __name__ == "__main__":
    main()
