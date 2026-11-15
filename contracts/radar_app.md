# Contract: radar app files (radar → frontend)

Version 1 (D8). Written by `radar/app_export.py` from Steven's tables in `radar/results/` and
`radar/catalog/fields.geojson`. Read by the story ("The fields") and the live map's Fields layer.
Real NISAR and Sentinel-1 results, so `"is_synthetic": false`. Rerun the script when the tables change.

## `polarization.json`
NISAR L2 GCOV, provisional, track 34 ascending, frame 20. Backscatter in dB, field medians per crop.
```json
{"is_synthetic": false, "product": "NISAR L2 GCOV", "product_maturity": "provisional",
 "track": 34, "direction": "ascending", "frame": 20,
 "fields": 30, "measurements": 780, "crop_labels": "…",
 "dates": ["2025-11-24", "…"], "crops": ["Alfalfa", "Almonds", "Cotton"],
 "series": {"Alfalfa": {"hh_db": [...], "hv_db": [...], "hv_over_hh_db": [...], "fields_measured": [...]}},
 "median_hv_over_hh_db": {"Alfalfa": -7.7, "…": 0},
 "caveat": "…"}
```
`series` arrays have one value per `dates` entry; `null` = no value.

## `coverage.json`
Field checks: a field is usable in a pair when its median coherence ≥ `threshold_median_coherence`.
```json
{"is_synthetic": false, "threshold_median_coherence": 0.3, "fields": 30,
 "nisar_product": "…", "s1_product": "…", "matching": "…",
 "totals": {"nisar": {"usable": 542, "checks": 690}, "s1": {"usable": 558, "checks": 690}},
 "pairs": [{"nisar_start": "2025-11-24", "nisar_end": "2025-12-06", "s1_start": "…", "s1_end": "…",
            "fields": 30, "nisar_usable": 28, "nisar_measured": 30, "s1_usable": 30, "s1_measured": 30}],
 "caveat": "…"}
```

## `fields.geojson`
The 30 field polygons (lon/lat, 5 decimals). Properties: `field_id`, `crop`, `acres`, `lon`, `lat`,
`hv_over_hh_db_median`, `hv_over_hh_db` (one value per `polarization.json` date, 2 decimals),
`nisar_usable`, `s1_usable`, `pairs`.

## Claims (from `radar/results/*summary.txt`)
- Polarization: differences can reflect crop structure, moisture and field management. No crop-type claims
  beyond what the USDA labels confirm.
- Coverage: compares the available products over these fields and dates. Wavelength, imaging geometry,
  processing and the date offsets can all affect coherence. Reported whatever the result (NISAR 78.6%,
  Sentinel-1 80.9%).
