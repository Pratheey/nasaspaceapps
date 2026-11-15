# Steven’s radar work

The Breathing Ground · Corcoran–Mendota, California

## Polarization (H-6)

NASA Harmony finished exporting frequency A HH and HV for 26 provisional GCOV acquisitions
on Track 034, Frame 020 between November 24, 2025 and October 14, 2026. The export is cropped
to the field study area. [NASA export order](https://search.earthdata.nasa.gov/downloads/9629331473).

[Real HH preview for November 24](results/nisar-hh-nov24.png) and [field table](results/nisar-hh-nov24.csv).
All 30 fields had valid HH pixels for this scene. Group medians were −3.4 dB for almond fields,
−11.0 dB for alfalfa, and −11.7 dB for cotton. This describes the HH return on a single date.
The complete HH/HV comparison awaits authenticated downloads of the paired GeoTIFFs.

## Fixed fields and granule lists

- [Fields](catalog/fields.csv) and [boundaries](catalog/fields.geojson) freeze the same 30
  polygons, 10 per crop. Boundaries come from the USDA 2015–2022 Crop Sequence Boundaries
  dataset. The 2025 Cropland Data Layer supplied the dominant class, which covers at least
  90% of sampled pixels in each polygon. Later planting could differ. [USDA field boundaries](https://www.nass.usda.gov/Research_and_Science/Crop-Sequence-Boundaries/), [2025 crop layer](https://data.nass.usda.gov/Research_and_Science/Cropland/metadata/metadata_CDL25_FGDC-STD-001-1998.htm).
- [GCOV](catalog/gcov.csv), [ascending GUNW](catalog/ascending_gunw.csv) and
  [descending GUNW](catalog/descending_gunw.csv) list the NASA provisional granules.
- [Sentinel-1 date matches](catalog/sentinel_matches.csv) and the [HyP3 job list](catalog/hyp3_jobs.json)
  contain 23 candidate pairs. Each candidate has the same time interval as the corresponding
  NISAR pair and starts within six days of it. ASF accepted five jobs at the last verified
  submission. The job list includes submitted candidates and can be used to check for duplicates
  against ASF Submitted Products.
- `catalog.py` regenerates the catalog from CMR exports `gcov.json` and `gunw.json`, ASF
  GeoJSON `sentinel.json`, USDA 2022 boundaries `csb_candidates.geojson` and USDA CDL_WM
  raster 40 `cdl_2025.tif`. The field query used −119.76°, 35.96°, −119.40°, 36.25° and
  40–500 acres. The crop raster was subset using nearest-neighbor resampling in EPSG:5070.
  [USDA boundaries service](https://pdi.scinet.usda.gov/hosting/rest/services/Hosted/Crop_Sequence_Boundary_2022/FeatureServer/0), [USDA crop raster service](https://pdi.scinet.usda.gov/image/rest/services/CDL_WM/ImageServer).

## Run the polarization analysis

Install dependencies with `python3 -m pip install -r radar/requirements.txt`. Create a CSV with
one row per acquisition and columns `date,granule_id,hh_tif,hv_tif`. Use the acquisition date
from the catalog and paths to the frequency A HHHH and HVHV GeoTIFFs. Relative paths are
resolved from the manifest’s directory.

```sh
python3 radar/polarization.py /path/to/gcov_inputs.csv /path/to/results
```

The script averages positive linear backscatter over pixels valid in both channels and
requires at least half of a field's pixel centers to be valid. It converts each field mean to
dB and calculates HV/HH in dB as HV dB minus HH dB. The results include field values,
crop-group medians per date, and a chart. Crop structure, moisture and field management
can all affect radar backscatter.
