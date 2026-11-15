# Contract: app data files (analysis → frontend)

Produced by Ismail into `frontend/public/data/`. Read by Avi's app. Version 1.2 (D10: adds `demo_stations` to `meta.json`, the canal profile file (section 5) and the vertical cross-check folder (section 6); the four core files keep their shape).
Samples in exactly this shape: `contracts/samples/`. Four files, all JSON.

## Grid
Row-major, **north to south, then west to east**. Cell `(row, col)` has centre
`lat = lat_max − (row + 0.5)·step`, `lon = lon_min + (col + 0.5)·step`. Index
`i = row·ncols + col`. All per-cell arrays have length `nrows·ncols`, `null` = no value.

**How a cell gets its value (D5).** Each pixel's pairs are summed into a position series
(relative to the first date). For each date, a cell is the median of the valid pixel
positions inside it, and the cell's pairs are the differences between consecutive dates.
Not a median of pair values per pair: that picks different pixels for neighbouring pairs,
so each date's noise stops cancelling and the cell's series drifts. A cell with too few
valid pixels at a date is missing for that date and for every later cumulative value.

## 1. `meta.json`
```json
{
  "contract_version": 1.2,
  "is_synthetic": false,
  "created_utc": "2026-11-14T20:00:00Z",
  "product": "NISAR L2 GUNW",
  "product_maturity": "provisional",
  "track": 34, "direction": "ascending", "frame": 20,
  "sign_convention": "positive toward satellite (≈ uplift); negative ≈ sinking",
  "units": "m",
  "reference_station": "P304",
  "held_out_stations": ["P294", "P297", "P298", "P300", "P307", "CAFP", "CAFR", "CAHA", "CAKC", "TRAN"],
  "demo_stations": {"sinking": ["CAFP", "CAHA"], "calm": "P300"},
  "grid": {"lat_max": 36.95, "lon_min": -120.60, "step_deg": 0.01, "nrows": 100, "ncols": 120},
  "dates": ["2025-11-24", "..."],
  "pairs": [{"pair": 1, "ref_date": "2025-11-24", "sec_date": "2025-12-06",
             "granule_id": "…", "iono_applied": true, "used_in_fit": true}],
  "fit": {"t0": "2026-01-01", "period_yr": 1.0,
          "model": "u(t)=c+B*t+a*sin(2πt)+b*cos(2πt), t in years since t0, fitted on pairwise differences"},
  "sigma_net_m": 0.0,
  "sigma_source": "gps/processed/uncertainty.json",
  "significance": "joint F-test on (a,b), p < 0.05",
  "labels": {
    "0": "Insufficient evidence",
    "1": "Seasonal movement with persistent sinking",
    "2": "Seasonal movement, no resolved trend",
    "3": "Persistent sinking, seasonal component uncertain"
  },
  "notes": ["free text: anything a judge or teammate must know"]
}
```

## 2. `grid.json`
```json
{
  "is_synthetic": false,
  "net_change_m": [...],          // first to last date; null if masked at either end
  "net_change_sigma_m": [...],
  "label": [...],                 // int code from meta.labels; 0 where masked
  "seasonal_significant": [...],  // true/false/null
  "amp_m": [...],                 // null where seasonal_significant is not true
  "amp_sigma_m": [...],
  "peak_month": [...],            // 1–12; null where not significant
  "trend_m_per_yr": [...],        // B; never the headline
  "trend_sigma_m_per_yr": [...],
  "fit_c_m": [...], "fit_a_m": [...], "fit_b_m": [...],   // to draw the fitted curve
  "n_valid_dates": [...]          // int
}
```
Label rules (from `docs/PROPOSAL.md` §5): 1 = seasonal significant and net change
< −2σ; 2 = seasonal significant and |net| ≤ 2σ; 3 = net < −2σ and seasonal not
significant; 0 = everything else, including masked cells. Net change > +2σ with no
significant seasonal term is also 0 (we have no label for it; add one by contract change).

## 3. `series.json`
Cumulative LOS displacement per cell at each date in `meta.dates`, relative to the first
date (first value is always 0 or null).
```json
{"is_synthetic": false, "values_m": [[0.0, -0.004, null, ...], ...]}
```
`values_m[i]` is cell `i`; length of each row = `meta.dates.length`. Pick Two Dates uses
`values_m[i][k2] − values_m[i][k1]`.

## 4. `stations.json`
```json
{
  "is_synthetic": false,
  "stations": [{
    "station": "CAHA", "lat": 0.0, "lon": 0.0, "role": "held_out", "cell_index": 0,
    "gps": {"dates": ["2025-11-24", "..."], "los_m": [...], "sigma_m": [...]},
    "nisar": {"dates": ["..."], "los_m": [...]},
    "gps_fit":   {"trend_m_per_yr": 0.0, "trend_sigma_m_per_yr": 0.0, "amp_m": 0.0, "amp_sigma_m": 0.0, "peak_month": 1},
    "nisar_fit": {"trend_m_per_yr": 0.0, "trend_sigma_m_per_yr": 0.0, "amp_m": null, "amp_sigma_m": null,
                  "seasonal_significant": false, "c_m": 0.0, "a_m": 0.0, "b_m": 0.0},
    "residuals": {"net_m": 0.0, "pairs_rms_m": 0.0, "n_pairs": 0, "unwrap_flagged_pairs": []}
  }]
}
```
GPS `los_m` is absolute LOS (tied to P304, like NISAR), daily, decimated to the NISAR dates
or weekly to keep the file small. The reference station's residuals are `null` (it is not a check).
`stations.json` lists only stations inside the app bbox; P302, P303 and P725 are held out
too but lie outside it, so they appear only in `gps/processed/residuals.csv`.

## 5. `canal_profile_<slug>.json` (optional, v1.2)
Written by `analysis/canal.py` (`run.py --canal <geojson>`) next to the four core files, one file
per canal line in `context/canals/`. `<slug>` is the canal name in lower case with `_` for spaces
(`canal_profile_california_aqueduct.json`). **Screening only:** where to look closer, never damage
or capacity. Points every `spacing_m` along the line; all arrays have one value per point.
```json
{
  "is_synthetic": false,
  "name": "California Aqueduct",
  "geometry_source": "DWR i17_StateWaterProject_Centerline …",
  "spacing_m": 500.0,
  "gradient_baseline_km": 2.0,
  "distance_km": [0.0, 0.5, ...],          // along the line, in flow order
  "lat": [...], "lon": [...],
  "cell_index": [...],                     // app grid cell, null outside the grid
  "net_change_m": [...], "net_change_sigma_m": [...],
  "trend_m_per_yr": [...], "trend_sigma_m_per_yr": [...],
  "label": [...],                          // as grid.json; 0 outside the grid
  "net_change_gradient_m_per_km": [...],   // change in net change per km over the baseline, centred
  "net_change_gradient_sigma_m_per_km": [...],
  "note": "Screening tool: where to look closer along the canal. Not a measure of damage or capacity."
}
```
The app lists the profiles in `meta.json` → `canal_profiles` (array of file names), so it never
guesses file names. Missing key = no profiles.

## 6. `vertical/` (optional, v1.2): vertical cross-check
`frontend/public/data/vertical/` holds the same four files (sections 1–4) from
`python -m analysis.run --component up --var up_disp_m --out frontend/public/data/vertical`
on Steven's two-track stack. Differences from the LOS files:
- `meta.json` → `sign_convention`: `"positive up"`; `component`: `"up"`; a note that says
  **cross-check only** (D7, D9) and that Hanford (CAHA) has no descending coverage.
- `stations.json` compares with GPS **up**, not LOS.
- The app labels every vertical view "cross-check" and never uses it for the headline map.

## Size
Keep every file under 5 MB. At 0.01° the grid is 12,000 cells; round values to 4 decimals
(0.1 mm).
