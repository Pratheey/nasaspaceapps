# Contract: GPS outputs (gps → analysis, frontend)

Produced by Daniel (`gps/`). Version 1. All files in `gps/processed/` (small, in git).

## `stations.csv` (H-1)
| Column | Meaning |
|---|---|
| `station` | P302, P303, P304, P307 |
| `lat`, `lon` | WGS84 decimal degrees |
| `height_m` | Ellipsoidal height |
| `role` | `reference` (P304) or `held_out` |
| `steps_removed` | Short note, e.g. `2025-11-xx antenna/receiver offset removed` (P307) |

## `gps_los.csv`
Daily GPS projected into NISAR LOS with that station's unit vector from `station_values.csv`,
over the NISAR window only.

| Column | Meaning |
|---|---|
| `station`, `date` | |
| `los_m` | LOS displacement relative to the first NISAR date (2025-11-24), positive toward satellite. **Absolute** (not differenced with P304) |
| `los_rel_ref_m` | Same minus P304's `los_m` on that date: the quantity NISAR measures before tying |
| `sigma_m` | 1σ from the NGL ENU sigmas projected into LOS |

## `gps_fits.csv`
Refit over the NISAR window (not calendar 2025), same model as `docs/PROPOSAL.md` §5.

| Column | Meaning |
|---|---|
| `station` | |
| `window_start`, `window_end` | ISO dates |
| `component` | `los`, `up` |
| `trend_m_per_yr`, `trend_sigma_m_per_yr` | B and 1σ |
| `amp_m`, `amp_sigma_m` | A = √(a²+b²) and 1σ |
| `peak_month` | 1–12, month of the seasonal maximum |

## `residuals.csv` (H-9)
One row per pair per **held-out** station, plus one `pair = net` row per station for the
first-to-last net change.

| Column | Meaning |
|---|---|
| `pair` | Pair number, or `net` |
| `station` | |
| `nisar_los_m`, `gps_los_m` | Over the same dates, both tied to P304 |
| `residual_m` | `nisar_los_m − gps_los_m` |
| `unwrap_flag` | 1 if \|residual\| is within ~3 cm of a multiple of the L-band cycle (~12 cm) |

## `uncertainty.json` (H-9)
```json
{
  "sigma_pair_m": 0.0,
  "sigma_net_m": 0.0,
  "n_stations": 3,
  "n_pairs_used": 0,
  "method": "RMS of held-out residuals in LOS, flagged pairs excluded",
  "note": "4 stations: a prototype check, not a valley-wide accuracy claim"
}
```
Ismail uses `sigma_net_m` for the 2σ test on net change.
