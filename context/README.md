# context/: owned by Daniel (gps lane)

Screening and context layers: canals and aqueducts, communities, groundwater levels, and OPERA DISP-S1 / DWR-TRE historical subsidence. **Context only, never validation.** See `docs/PLAN.md` (H-8).
Clip everything to the app bounding box (lon -120.60 to -119.40, lat 35.95 to 36.95) and keep each file under ~5 MB.

## Included now

### `dwr/` DWR / TRE Altamira vertical displacement samples
- `dwr_history_2025_2026.csv`: 80 numeric samples = 16 monthly rasters (2025-01 to 2026-04) at 5 sites (P302, P303, P304, P307, Corcoran). Columns include `vertical_displacement_cm_since_20150613` (native feet x 30.48) and the source URL per row.
- `dwr_sample_metadata.json`: service metadata for the rasters.
- **What it is:** Sentinel-1-derived (TRE Altamira for DWR), about 100 m resolution. Every value is relative to **2015-06-13**, not to the first row.
- **What it is not:** ground measurement, and not an independent check. DWR products may already use GPS calibration, so DWR-vs-GPS agreement must not be counted as validation.
- Sanity check (not validation): change from 2025-01-01 to 2026-04-01, DWR vs GPS vertical (cm): P302 -0.7 vs -0.4; P303 -4.5 vs -4.3; P304 -0.6 vs -0.8; P307 -7.5 vs -7.2. Corcoran (no GPS): DWR -6.8.

## Candidate sources, NOT downloaded yet
My sandbox cannot reach these hosts, so each needs to be downloaded and clipped from a normal connection. Record the release or download date in this file when you do.

| Layer | Candidate | Where | Check before use |
|---|---|---|---|
| Canals and aqueducts | DWR GIS Atlas "i12 Canals and Aqueducts local" (shapefile / GeoJSON) | CNRA open data: `https://gis.data.cnra.ca.gov/api/download/v1/items/b43dc55d1e1448f2b384ebb8efac9042/geojson?layers=0` | Whether it includes the Delta-Mendota Canal, California Aqueduct / San Luis Canal and Friant-Kern |
| Canals and aqueducts | "State Water Project Centerline" (DWR / CNRA) | data.cnra.ca.gov | State canals only, not federal |
| Communities | Census TIGER/Line places, California | `https://www2.census.gov/geo/tiger/TIGER2025/PLACE/tl_2025_06_place.zip` | Pick Mendota, Corcoran and neighbours; clip to bbox |
| Groundwater levels | DWR Periodic Groundwater Level Measurements | `https://data.cnra.ca.gov/dataset/periodic-groundwater-level-measurements` (also Water Data Library and SGMA Data Viewer) | Pick wells inside the bbox; note each well's date range. The "continuous" dataset lists no Fresno or Kings wells, so use the periodic one |
| Historical subsidence | DWR / TRE Altamira rasters (the samples above came from these) and OPERA DISP-S1, **unfiltered** layer | DWR service directory in `sources.json` of the feasibility zip; OPERA via Earthdata | Record the release. The OPERA portal's filtered layer can create false uplift around subsidence bowls |
| Historical benchmark | Zenodo 2015-2017 Sentinel-1 / GPS displacement archive (2.7 GB) | `https://zenodo.org/records/3968903` | Method benchmark only; do not commit |

Context from the DWR 2025 San Joaquin Valley conveyance study: subsidence is continuing to reduce capacity in the San Luis Canal, California Aqueduct, Delta-Mendota Canal and Friant-Kern Canal.
