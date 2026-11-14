# Contract: NISAR pair stack (nisar → analysis, gps, radar)

Produced by Pratheek (`data/`). Version 1.

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

Subset to the app bbox (lon −120.60 to −119.40, lat 35.95 to 36.95) plus a small margin.

## 2. Values at the stations: `data/processed/station_values.csv` (in git)
One row per pair per station. Read from the pixel nearest each station (or a 3×3 median;
say which in `data/README.md`).

| Column | Type | Meaning |
|---|---|---|
| `pair` | int | Pair number |
| `ref_date`, `sec_date` | ISO date | |
| `station` | str | P302, P303, P304, P307 |
| `los_disp_m` | float | Pair LOS displacement at the station (empty if masked) |
| `coherence` | float | 0–1 |
| `valid` | 0/1 | Same rule as the stack |
| `los_east`, `los_north`, `los_up` | float | LOS unit vector at the station (ground to satellite) |

H-4 is the first row set of this file (pair 1, all four stations).
