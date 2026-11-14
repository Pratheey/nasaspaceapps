# analysis/: owned by Ismail (analysis lane)

Net-change map, pairwise seasonal + trend fit, significance tests, map labels, and export of the files the website reads. See `docs/PLAN.md` and `docs/PROPOSAL.md` sections 5 and 7.

## Run it

From the repo root:

```bash
python -m pytest analysis/tests -q          # all tests (synthetic data only)
python -m analysis.run --synthetic          # whole pipeline on a fake stack -> analysis/_synthetic_out/ (git-ignored)
python -m analysis.run --stack <path>/stack_t034_f020.nc --sigma-json gps/processed/uncertainty.json
                                            # real run -> frontend/public/data/ (needs H-7 and H-9)
```

Add `--exclude-pairs 7 12` to drop pairs flagged as unwrapping errors from the fit.

## Pipeline (`run.py`)

| Step | File | In | Out |
|---|---|---|---|
| 1 | `timebase.py` | ISO dates | years since 2026-01-01 (D3) |
| 2 | `netchange.check_chain` | `ref_date`, `sec_date` | the date list; fails if the pairs are not a chain |
| 3 | `regrid.py` | stack pixels (projected x/y + `crs`) | per-pair median per 0.01° app cell (cell kept only if ≥ 50% of its pixels are valid) |
| 4 | `fit.py` | pair values per cell | B, a, b, covariance, RSS, RSS of trend-only fit |
| 5 | `seasonal.py` | fit result | F-test p, significant?, A, σA, peak month (A and month hidden where not significant) |
| 6 | `netchange.py` | pair values per cell | cumulative position per date, net change (null if any pair missing) |
| 7 | `labels.py` | net, σ_net, significant | label 0–3 |
| 8 | `export.py` | all of the above | `meta.json`, `grid.json`, `series.json` per `contracts/app_data.md` |

`synthetic.py` makes fake stacks with a known answer for the tests. Its output is always marked `is_synthetic`.

## Method notes (for Ryan / the limits panel)

- **Weighting.** The pairwise equation is exactly the one in the proposal. Pairs are fitted with generalised least squares using the noise covariance of a pair network (C = M Mᵀ, where M has −1 at each pair's ref date and +1 at its sec date), because most noise belongs to a date, and neighbouring pairs share a date. Plain least squares detected a clear 7 mm wave only ~20% of the time in tests. With the weighting: the F-test false-positive rate on pure noise is ~5% (as designed), and the reported σ of B matches the actual scatter within ~10%. For a gap-free chain this equals fitting the cumulative series (tested).
- **Order: regrid, then fit.** Fitting app cells (medians of many pixels) is faster and less noisy than fitting each radar pixel. The app only shows cells.
- **`fit_c_m`** is chosen so the fitted curve is 0 on the first date, matching `series.json`. The pairwise fit cannot determine c.
- **`net_change_sigma_m`** is Daniel's single `sigma_net_m` copied to every cell with a net change. A per-cell σ is not defined yet. Settle this with Ryan.
- **Uplift beyond 2σ** gets label 0, because v1 has no uplift label (contract).

## Not done yet

- `stations.json`: needs Daniel's `gps/processed/gps_los.csv`, `gps_fits.csv` and `residuals.csv`.
- Synthetic dates follow the brief (26 dates, 12-day repeat, two gaps) until Pratheek confirms the real list.
- Not yet run on real data.