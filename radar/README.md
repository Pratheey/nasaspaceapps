# Steven’s radar work

The Breathing Ground · Corcoran–Mendota, California

## Polarization (H-6)

NASA Harmony finished exporting frequency A HH and HV for 26 provisional GCOV acquisitions
on Track 034, Frame 020 between November 24, 2025 and October 14, 2026. The export is cropped
to the field study area. [NASA export order](https://search.earthdata.nasa.gov/downloads/9629331473).

All 780 field-by-date measurements (30 fields × 26 dates) passed the paired validity check.
Median HV/HH across dates was −6.1 dB for almonds, −7.7 dB for alfalfa, and −7.9 dB for cotton.
These groups use 2025 USDA crop labels.

- [Polarization chart](results/nisar-polarization.png)
- [Per-field HH, HV, and HV/HH](results/nisar-polarization-fields.csv)
- [Crop medians by acquisition](results/nisar-polarization-by-crop.csv)
- [H-6 handoff summary](results/ryan-hour6-summary.txt)

## Coverage (H-10)

All 23 matched pairs were processed at 80 m pixel spacing using the Track 034/020 v2 NISAR
coherence stack and ASF Sentinel-1 GAMMA products. The pairs have equal temporal baselines
(21 pairs at 12 days and two at 24 days), and their start dates are within six days.
A field passed when at least half its pixel centers had valid coherence values and its median
coherence reached 0.30. All 30 fields count in each denominator.

Sentinel-1 passed **558/690 checks (80.9%)** and NISAR passed **542/690 (78.6%)**.
Sentinel-1 led on 13 pairs, NISAR on six, and four tied. Radar wavelength, acquisition timing,
viewing geometry, and product processing all affect the comparison.

- [Coverage chart](results/matched-radar-coverage.png)
- [Counts and dates by pair](results/matched-radar-coverage-by-pair.csv)
- [Coherence and pass flags by field](results/matched-radar-coverage-by-field.csv)
- [H-10 handoff summary](results/ryan-coverage-summary.txt)

## Fixed fields and granule lists

- [Fields](catalog/fields.csv) and [boundaries](catalog/fields.geojson) freeze the same 30
  polygons, 10 per crop. Boundaries come from the USDA 2015–2022 Crop Sequence Boundaries
  dataset. The 2025 Cropland Data Layer supplied the dominant class, which covers at least
  90% of sampled pixels in each polygon. Later planting could differ. [USDA field boundaries](https://www.nass.usda.gov/Research_and_Science/Crop-Sequence-Boundaries/), [2025 crop layer](https://data.nass.usda.gov/Research_and_Science/Cropland/metadata/metadata_CDL25_FGDC-STD-001-1998.htm).
- [GCOV](catalog/gcov.csv), [ascending GUNW](catalog/ascending_gunw.csv) and
  [descending GUNW](catalog/descending_gunw.csv) list the NASA provisional granules.
- [Sentinel-1 date matches](catalog/sentinel_matches.csv) and the [HyP3 job list](catalog/hyp3_jobs.json)
  contain 23 candidate pairs. Each candidate has the same time interval as the corresponding
  NISAR pair and starts within six days of it. All 23 jobs completed and are included in the coverage results above.
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

## Hour 33 · Descending track and two-track motion

Use the processed Track 034 Frame 020 v2 ascending stack and Track 042 Frame 070
descending stack from the team Drive. From the repository root with the shared Python
requirements installed:

```sh
python radar/vertical.py --asc /path/to/stack_t034_f020_v2.nc \
  --desc /path/to/stack_t042_f070.nc --out /path/to/hour_33
```

The NetCDF follows the H-16 analysis request and holds pair increments in metres on
the ascending 80 m projected grid. Positive vertical means up and positive east–west
means east. Both tracks have their P304 GPS tie removed so the inversion measures
motion relative to P304. North motion is assumed zero. Descending pixels are sampled
by nearest neighbour and ascending acquisitions use the nearest distinct descending
acquisition within six days. The 25 matched acquisitions are one day apart. February 4
has no match and is omitted. For longer intervals the script adds observed consecutive
increments on each track and masks pixels missing any of those increments.
The output records the actual input filenames in its source metadata. The signed-off
hour-33 results use v2; using a different input version requires a new check.

Run with `--station-only` and no stack paths to reproduce the preliminary H-13
check from Pratheek's published station samples and Daniel's cleaned GPS series.
This mode does not generate a raster. `--descending-check-only` writes the GPS
LOS residuals for each of the 27 descending pairs. P304 is excluded from residual
statistics. CAHA has no descending coverage. GPS positions are seven-day medians
with at least three cleaned daily solutions. P307's flagged transient is excluded
from GPS east/up and its unresolved east step excludes P307 from the east comparison.

The nearest raster pixels differ from held-out GPS by **2.35 cm RMS vertically**
(12 stations) and **2.92 cm RMS east–west** (11 stations). The two-track solution
is a provisional cross-check.

- [H-13/H-16 handoff](results/hour_33/hour_33_handoff.md)
- [Vertical and east–west map preview](results/hour_33/vertical_east_motion.png)
- [GPS check by station](results/hour_33/vertical_gps_stations.csv)
- [Vertical uncertainty for analysis](results/hour_33/vertical_uncertainty.json)
