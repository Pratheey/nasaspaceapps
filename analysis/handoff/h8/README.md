# H-8 context layers for Daniel (downloaded by Ismail, 2026-11-14 23:06–23:07 PST = 2026-11-15 07:06–07:07 UTC)

## 1. California places (communities)
- File: `places/tl_2025_06_place.zip` (unchanged, 9,885,068 bytes)
- Source: U.S. Census Bureau, TIGER/Line Shapefiles 2025, Places, California (state FIPS 06)
- URL: https://www2.census.gov/geo/tiger/TIGER2025/PLACE/tl_2025_06_place.zip (server Last-Modified 2025-09-22)
- Not clipped: clip to the app bbox (lon -120.60..-119.40, lat 35.95..36.95) on your side.

## 2. DWR periodic groundwater level measurements: Fresno, Kings, Tulare counties
- File: `groundwater_fresno_kings_tulare.zip` with
  `stations_fresno_kings_tulare.csv` (10,036 wells: Fresno 6,218, Kings 1,485, Tulare 2,333),
  `measurements_fresno_kings_tulare.csv` (427,097 rows, 1900-01-02 to 2026-11-13; 12,465 from 2025-11-24 on),
  plus DWR's `DataDictionary_stations.csv`, `DataDictionary_measurements.csv`, `metadata.txt`.
- Source: California DWR, "Periodic Groundwater Level Measurements", CNRA open data portal
  (https://data.cnra.ca.gov/dataset/periodic-groundwater-level-measurements), resource "Bulk Data Download"
  (periodic_gwl_bulkdatadownload.zip, 70,491,730 bytes), dataset release 2026-11-14 (portal metadata_modified 2026-11-14T13:04).
- What was done: stations kept where `county_name` is Fresno, Kings or Tulare; measurements kept for those
  stations' `site_code`. Rows and columns are otherwise unchanged. Not clipped to the bbox.
- Use for context only (mechanism), never validation (PROPOSAL §3).

## Where these go
`context/` is Daniel's folder: he clips both layers to the app bbox, documents them in `context/README.md`
and commits the results there. This hand-off folder is on its own branch, is never merged into `main`
(both files are over the 5 MB per-file limit), and the branch can be deleted once Daniel has the files.
