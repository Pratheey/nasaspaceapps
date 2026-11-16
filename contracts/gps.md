# Contract: GPS outputs (gps → analysis, frontend)

Produced by Daniel (`gps/`). Version 1.1 (D5: more stations). All files in `gps/processed/` (small, in git).

## `stations.csv` (H-1)
| Column | Meaning |
|---|---|
| `station` | The 14 stations in `data/processed/stations_ngl.csv` (D5) |
| `lat`, `lon` | WGS84 decimal degrees |
| `height_m` | Ellipsoidal height |
| `role` | `reference` (P304) or `held_out` (every other station) |
| `steps_removed` | Short note, e.g. `2025-11-xx antenna/receiver offset removed` (P307) |

## `gps_los.csv`
Daily GPS projected into NISAR LOS with that station's unit vector from `station_values.csv`,
over the NISAR window only.

| Column | Meaning |
|---|---|
| `station`, `date` | |
| `los_m` | Daily LOS displacement relative to the seven-day median at the first NISAR date with available GPS (2025-11-24, or 2025-12-06 for late-starting stations), positive toward satellite. **Absolute** (not differenced with P304) |
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

These residuals use native radar station samples and seven-day GPS medians, with both
changes relative to P304. They are not residuals of the 1 km app-cell chart and its daily
GPS samples. The app calculates that comparison separately over shared dates. Missing
final samples give no app-cell net comparison. Keep these scopes distinct when quoting
agreement; the published overall uncertainty still comes from this native-pixel check.

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
  "n_stations": 12,
  "n_pairs_used": 0,
  "method": "RMS of held-out residuals in LOS, flagged pairs excluded",
  "note": "12 held-out stations in one frame: a prototype check, not a valley-wide accuracy claim"
}
```
Ismail uses `sigma_net_m` for the 2σ test on net change.
