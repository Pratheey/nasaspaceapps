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

### `communities/` places (H-8)
- `communities/places_bbox.geojson`: the 65 Census places (cities and census-designated places) whose outline touches the app bbox (lon −120.60 to −119.40, lat 35.95 to 36.95). Polygons are whole places, **not** cut at the bbox edge. Properties: `name`, `geoid`, `type` (e.g. "city", "CDP"), `lsad`, `land_km2`, `source`, `download_date`, `datum`.
- Source: U.S. Census Bureau, TIGER/Line Shapefiles 2025, Places, California (`tl_2025_06_place.zip`, server date 2025-09-22), downloaded 2026-11-14 by Ismail. Datum NAD83, treated as WGS84 (differences are about a metre).
- **Five Points is not a Census place in this file**, so there is no outline for the CAFP demo station's town. Corcoran, Hanford, Mendota, Huron and Lemoore are there.
- Screening context only. Not used for any measurement.

### `groundwater/` DWR periodic groundwater levels (H-8)
- Source: California DWR, "Periodic Groundwater Level Measurements", CNRA open data portal (`https://data.cnra.ca.gov/dataset/periodic-groundwater-level-measurements`), bulk download, dataset release 2026-11-14, downloaded by Ismail 2026-11-14. Fresno, Kings and Tulare counties only, then cut here.
- `groundwater/wells_bbox.csv`: 481 wells inside the bbox that have at least one water level since 2024-01-01 (426 of them have a level inside the NISAR window). Columns: `site_code`, `swn`, `lat`, `lon`, `county_name`, `basin_name`, `well_depth_ft`, `well_depth_m`, `well_use`, `well_type`, `monitoring_program`, `first_date`, `last_date`, `n_levels`, `n_levels_in_nisar_window`.
- `groundwater/levels_since_2024_bbox.csv`: 24,580 water levels at those wells, 2024-01-01 to 2026-11-13. `gwe_ft`/`gwe_m` is groundwater elevation above sea level (NAVD88), `depth_to_water_ft`/`_m` is depth below ground, `quality` is DWR's flag (Good, Provisional, Questionable; 880 Questionable rows are kept so the app can hide them), `source` is DWR_DISCRETE or DWR_CONTINUOUS. Feet are DWR's values; metres are feet × 0.3048.
- `groundwater/wells_near_stations.csv`: wells within 15 km of each GPS station that have a level in the NISAR window, nearest first. Nearest well per station: TRAN 0.1 km, CAKC 0.6, P304 2.1, CAHA 2.8, CAFR 3.2, P302 4.3, P300 4.4, CAFP 4.6, P294 7.3, P298 9.8. **P297, P303, P307 and P725 have none within 15 km.**
- Context only (mechanism), never validation (PROPOSAL §3). Well depths and screened intervals differ, so water levels from different wells are not comparable to each other, only to themselves over time.
- Rebuild: `scripts/clip_places_and_wells.py` (needs the two source files unzipped under `/tmp/h8/`; paths are at the top of the script).

### `opera/` OPERA DISP-S1 history, chained and referenced to P304 (H-20)
**Not NISAR. Sentinel-1, C-band (5.55 cm), 2016 to spring 2026. Context only; never mix with the NISAR stack or GPS validation.**
- `opera/opera_disp_s1_f11116_chained_rel_p304.csv` (descending, track 42, 2016-07-05 to 2026-04-26; 7 stations, 25 canal points) and `opera/opera_disp_s1_f36542_chained_rel_p304.csv` (ascending, track 137, 2016-07-24 to 2026-03-28; 13 stations, 28 canal points). Columns: `frame_id`, `version`, `point_type`, `point_id`, `lat`, `lon`, `canal_distance_km`, `date`, `los_rel_p304_m`, `chain_id`, `segment_ref_date`.
- **Source:** Pratheek's `data/processed/opera_disp_s1_f11116.csv` and `_f36542.csv` (OPERA L3 DISP-S1 v1.0, collection `C3294057315-ASF`, unfiltered `displacement` layer, read 2026-11-15; details in `data/README.md`). Frame F09155 covers no point and is not used.
- **What I did to it (`scripts/chain_opera.py`):** each value is first differenced against P304 **in the same granule**, because OPERA's spatial reference point changes from file to file. Segments are then chained at the reference-date joins (the last date of each segment equals the next segment's reference date; the script checks this). Pixels OPERA marks `recommended_mask` = 0 are dropped.
- **Units and sign:** metres, line of sight, positive toward the satellite, so sinking shows as negative. Relative to P304 (which itself moves, so "rising" relative to P304 can still be sinking).
- **Read `chain_id`.** If a point's link value is missing at a join (masked pixel), the series restarts from zero with a new `chain_id`. Values with different `chain_id` are not comparable. In F11116, P300 and 4 canal points have a second chain; in F36542, P302 (chain 1 ends 2021-10-08) and 1 canal point. CAKC, P303 and P307 have no F11116 data, and are in F36542 only.
- **Checks run:** at CAFP, the two frames, which look from opposite sides, give a similar 9.8-year trend relative to P304 (descending -4.3 cm/yr, ascending -4.1 cm/yr in LOS). P294, P297, P298 and P302 also agree between frames (+1.4 to +2.2 cm/yr). The step between consecutive dates is 9.5 mm within a segment and 15.3 mm across the joins in F11116 (14.3 and 13.5 mm in F36542); the largest join step is 58 mm in F11116 and 71 mm in F36542, so single joins can carry errors of that size.
- **Not done:** no conversion to vertical (that needs both geometries and the DISP-S1-STATIC LOS vectors), no ionosphere or tide correction, no tie to GPS. LOS values from this layer are not comparable with NISAR's LOS because the incidence angles differ.

## Candidate sources, NOT downloaded yet
My sandbox cannot reach these hosts, so each needs to be downloaded and clipped from a normal connection. Record the release or download date in this file when you do.

| Layer | Candidate | Where | Check before use |
|---|---|---|---|
| Federal canals (Delta-Mendota, Friant-Kern) | USBR "Reclamation Conveyance Lines" or DWR i12 Federal service | `https://data.usbr.gov/catalog/6406/item/72731` | Open: see `canals/` above. Not downloaded |
| Historical subsidence | DWR / TRE Altamira rasters (the samples above came from these) | DWR service directory in `sources.json` of the feasibility zip | Record the release. OPERA DISP-S1 is done: see `opera/` |
| Historical benchmark | Zenodo 2015-2017 Sentinel-1 / GPS displacement archive (2.7 GB) | `https://zenodo.org/records/3968903` | Method benchmark only; do not commit |

Context from the DWR 2025 San Joaquin Valley conveyance study: subsidence is continuing to reduce capacity in the San Luis Canal, California Aqueduct, Delta-Mendota Canal and Friant-Kern Canal.
