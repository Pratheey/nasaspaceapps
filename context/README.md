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

### `canals/` canal centre lines for the profile (H-15)
- `canals/canals_bbox.geojson`: canal centre lines clipped to the app bbox, one LineString per canal, vertex order = flow order. Properties: `name`, `source_layer`, `source_url`, `download_date`, `operator`, `flow_direction`, `length_km_in_bbox`, `clipped_to`, `note`.
- **Made by Ismail's side (analysis lane), committed here because `context/` is the gps lane.** Checked here only for shape: one feature, 4,629 vertices, 113.6 km, latitude never increases along the line (north to south), inside the bbox.

| Canal | Source layer | Downloaded | In bbox |
|---|---|---|---|
| California Aqueduct | DWR `i17_StateWaterProject_Centerline` (CNRA open data item 0c1e0a5ca1ba488ea740fa0d654df4c8), features with Conveyance = "California Aqueduct", Conv_Type = "canal" | 2026-11-14 | 114.0 km, north to south; one 138 m join where a short pipeline section replaces the open canal |

Not included, and why:
- **Delta-Mendota Canal** (and Friant-Kern, if any of it is inside the bbox): the DWR `i12_Canals_and_Aqueducts_Federal` service returned HTTP 404 on 2026-11-14 from Ismail's side. Open. Fallbacks: USBR "Reclamation Conveyance Lines" (`https://data.usbr.gov/catalog/6406/item/72731`) or USGS NHD canal flowlines. Its metadata says it is "intended mainly for uses internal to Reclamation"; record that if it is used.
- **DWR `i12_Canals_and_Aqueducts_local`** (CNRA item b43dc55d1e1448f2b384ebb8efac9042): local canals only. Its "San Luis Canal" inside the bbox is a Kings River Water Association canal, **not** the California Aqueduct's San Luis reach.
- **Corcoran levee**: DWR `i17_LeveeCenterlineClass_2012` (CNRA item 7d791817d1dc4c33b43d9b727d6c2e3b) has no levee inside the bbox. No source yet; if none is found the levee profile is dropped.

Screening use only: a profile shows where to look closer, not damage or capacity.

## Candidate sources, NOT downloaded yet
My sandbox cannot reach these hosts, so each needs to be downloaded and clipped from a normal connection. Record the release or download date in this file when you do.

| Layer | Candidate | Where | Check before use |
|---|---|---|---|
| Federal canals (Delta-Mendota, Friant-Kern) | USBR "Reclamation Conveyance Lines" or DWR i12 Federal service | `https://data.usbr.gov/catalog/6406/item/72731` | Open: see `canals/` above. Not downloaded |
| Communities | Census TIGER/Line places, California | `https://www2.census.gov/geo/tiger/TIGER2025/PLACE/tl_2025_06_place.zip` | Pick Mendota, Corcoran and neighbours; clip to bbox |
| Groundwater levels | DWR Periodic Groundwater Level Measurements | `https://data.cnra.ca.gov/dataset/periodic-groundwater-level-measurements` (also Water Data Library and SGMA Data Viewer) | Pick wells inside the bbox; note each well's date range. The "continuous" dataset lists no Fresno or Kings wells, so use the periodic one |
| Historical subsidence | DWR / TRE Altamira rasters (the samples above came from these) and OPERA DISP-S1, **unfiltered** layer | DWR service directory in `sources.json` of the feasibility zip; OPERA via Earthdata | Record the release. The OPERA portal's filtered layer can create false uplift around subsidence bowls |
| Historical benchmark | Zenodo 2015-2017 Sentinel-1 / GPS displacement archive (2.7 GB) | `https://zenodo.org/records/3968903` | Method benchmark only; do not commit |

Context from the DWR 2025 San Joaquin Valley conveyance study: subsidence is continuing to reduce capacity in the San Luis Canal, California Aqueduct, Delta-Mendota Canal and Friant-Kern Canal.
