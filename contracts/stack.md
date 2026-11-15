# Contract: NISAR pair stack (nisar → analysis, gps, radar)

Produced by Pratheek (`data/`). Version 1.1 (additive, D5).

## 1. Pair stack: `stack_t034_f020.nc` (shared Drive, `data/interim/`)
NetCDF4 readable with `xarray.open_dataset`. One pair per entry, sequential chain
(date i → date i+1).

| Name | Dims | Type | Meaning |
|---|---|---|---|
| `los_disp_m` | (pair, y, x) | float32 | LOS displacement of the pair, **ionosphere-corrected**, referenced to P304 and tied to P304 GPS, positive toward satellite. `NaN` where masked |
| `coherence` | (pair, y, x) | float32 | 0–1, from the GUNW |
| `valid` | (pair, y, x) | uint8 | 1 = passed coherence mask **and** in the connected component linked to the reference; 0 otherwise |
| `los_east`, `los_north`, `los_up` | (y, x) | float32 | Unit vector from ground **to satellite** (east, north, up components) |
| `pair` | (pair) | int | 1..N |
| `ref_date`, `sec_date` | (pair) | str | ISO dates of the earlier and later acquisition |
| `granule_id` | (pair) | str | ASF granule ID of the GUNW used |
| `iono_applied` | (pair) | uint8 | 1 if the ionospheric phase screen was applied |
| `x`, `y` | (x), (y) | float64 | Projected coordinates of the native GUNW grid |

Global attributes: `crs` (EPSG code), `coherence_threshold`, `reference_station = "P304"`,
`sign_convention = "positive toward satellite"`, `product_maturity = "provisional"`,
`created_utc`, `notes` (any pair corrected for unwrapping, by how many cycles).

Extra variables (additive): `anomaly` (pair, y, x; 1 = the product flags an input-data
anomaly; such pixels stay in `valid`), `cmr_concept_id`, `tropo_applied`, `set_applied`,
`anomalies_masked`, `ref_tie_m`, `valid_fraction` (all per pair). `los_disp_m` is also
corrected with the product's troposphere and solid Earth tide screens when `tropo_applied`
and `set_applied` are 1.

Window: lon −120.80 to −119.40, lat 35.95 to 37.12. That is the app bbox widened west and
north so that P302, P303 and P725 are covered.

## 2. Values at the stations: `data/processed/station_values.csv` (in git)
One row per pair per station. Read from the pixel nearest each station (or a 3×3 median;
say which in `data/README.md`).

| Column | Type | Meaning |
|---|---|---|
| `pair` | int | Pair number |
| `ref_date`, `sec_date` | ISO date | |
| `station` | str | Every station in `data/processed/stations_ngl.csv` (14 as of D5) |
| `los_disp_m` | float | Pair LOS displacement at the station (empty if masked) |
| `coherence` | float | 0–1 |
| `valid` | 0/1 | Same rule as the stack |
| `los_east`, `los_north`, `los_up` | float | LOS unit vector at the station (ground to satellite) |
| `n_valid_px` | int | Valid pixels in the 3 × 3 block (0–9) |
| `los_disp_iono_only_m` | float | Same as `los_disp_m` with only the ionosphere corrected |
| `ref_tie_m` | float | P304's GPS LOS motion over the pair, already added to `los_disp_m` |
| `anomaly` | 0/1 | 1 if any pixel of the block is anomaly-flagged |

H-4 is the first row set of this file (pair 1, all stations).
