# Contract: app data files (analysis → frontend)

Produced by Ismail into `frontend/public/data/`. Read by Avi's app. Version 1.
Samples in exactly this shape: `contracts/samples/`. Four files, all JSON.

## Grid
Row-major, **north to south, then west to east**. Cell `(row, col)` has centre
`lat = lat_max − (row + 0.5)·step`, `lon = lon_min + (col + 0.5)·step`. Index
`i = row·ncols + col`. All per-cell arrays have length `nrows·ncols`, `null` = no value.

## 1. `meta.json`
```json
{
  "contract_version": 1,
  "is_synthetic": false,
  "created_utc": "2026-11-14T20:00:00Z",
  "product": "NISAR L2 GUNW",
  "product_maturity": "provisional",
  "track": 34, "direction": "ascending", "frame": 20,
  "sign_convention": "positive toward satellite (≈ uplift); negative ≈ sinking",
  "units": "m",
  "reference_station": "P304",
  "held_out_stations": ["P302", "P303", "P307"],
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
    "station": "P307", "lat": 0.0, "lon": 0.0, "role": "held_out", "cell_index": 0,
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

## Size
Keep every file under 5 MB. At 0.01° the grid is 12,000 cells; round values to 4 decimals
(0.1 mm).
