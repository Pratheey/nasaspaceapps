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
| 3 | `regrid.py` | stack pixels (projected x/y + `crs`) | each pixel's position series → median position per 0.01° app cell per date (kept only if ≥ 50% of its pixels are valid) → back to pairs |
| 4 | `fit.py` | pair values per cell | B, a, b, covariance, RSS, RSS of trend-only fit |
| 5 | `seasonal.py` | fit result | F-test p, significant?, A, σA, peak month (A and month hidden where not significant) |
| 6 | `netchange.py` | pair values per cell | cumulative position per date, net change (null if any pair missing) |
| 7 | `labels.py` | net, σ_net, significant | label 0–3 |
| 8 | `export.py`, `stations.py` | all of the above + Daniel's GPS CSVs | `meta.json`, `grid.json`, `series.json`, `stations.json` per `contracts/app_data.md` |
| 9 | `canal.py` | canal GeoJSON + per-cell results | `canal_profile_<name>.json` (screening tool; **not in contracts v1**) |

`synthetic.py` makes fake stacks with a known answer for the tests. Its output is always marked `is_synthetic`.

## Method notes (for Ryan / the limits panel)

- **Weighting.** The pairwise equation is exactly the one in the proposal. Pairs are fitted with generalised least squares using the noise covariance of a pair network (C = M Mᵀ, where M has −1 at each pair's ref date and +1 at its sec date), because most noise belongs to a date, and neighbouring pairs share a date. Plain least squares detected a clear 7 mm wave only ~20% of the time in tests. With the weighting: the F-test false-positive rate on pure noise is ~5% (as designed), and the reported σ of B matches the actual scatter within ~10%. For a gap-free chain this equals fitting the cumulative series (tested).
- **Order: regrid, then fit.** Fitting app cells (medians of many pixels) is faster and less noisy than fitting each radar pixel. The app only shows cells.
- **`fit_c_m`** is chosen so the fitted curve is 0 on the first date, matching `series.json`. The pairwise fit cannot determine c.
- **`net_change_sigma_m`** is Daniel's single `sigma_net_m` copied to every cell with a net change. A per-cell σ is not defined yet. Settle this with Ryan.
- **Uplift beyond 2σ** gets label 0, because v1 has no uplift label (contract).

- **Cells use the median of pixel positions, not of pair values.** A per-pair median broke the cancellation of date noise between neighbouring pairs and made cell series drift (13 mm at a 3-pixel cell in tests).
- **Vertical:** `--component up --var up_disp_m` runs the same pipeline on Steven's vertical stack (positive up). It needs `--out`, so it never overwrites the line-of-sight app files.
- **Stations:** any number of stations; roles come from `gps/processed/stations.csv`.

## First real run (DRAFT, 2026-11-14, hour ~8)

Real stack `data/interim/stack_t034_f020.nc` (25 pairs, 1674 × 1620 px at 80 m, EPSG:32611, tied to
P304; from the Drive, never in git). Runs in about 7 s. **Draft:** sigma is provisional and the
real-data gate (PLAN) is not passed until Daniel's residual table exists.

```bash
python -m analysis.run --stack data/interim/stack_t034_f020.nc --sigma-net-m 0.0182 \
  --sigma-source "<where it comes from>" --out analysis/_real_draft
```

| | |
|---|---|
| Provisional σ of net change | **1.82 cm**: RMS of first-to-last NISAR − GPS at 13 held-out stations (raw GPS, single points; `data/processed/qa_summary_t034_f020.csv`) |
| Cells with a net change | 8,116 of 12,000 (68%) |
| Labels 0 / 1 / 2 / 3 | 6,811 / 2,975 / 1,256 / 958 |
| Seasonal threshold | **A > 17.1 mm** (F-test alone passes 26.5% of 200 stable control cells; with the threshold, 5.0%) |

Real-data gate:
- **Sign: passes.** At the moving held-out stations, the cell series correlates positively with
  GPS: CAFP +0.81, CAFR +0.83, TRAN +0.60, CAHA +0.56. P307 does not track (−0.35), as the data lane found.
- **Calibration: passes** (5.0% of stable cells).
- **Residual table: not yet** (waits for H-9).

Findings for the team:
- **Cell coverage.** Only 49% of pixels stay valid through all 25 pairs. At a 50% valid-pixel rule,
  only 44% of cells had a net change and CAFP had none; at 20% (default now), 68% do, CAFP tracks
  GPS (net within 0.7 cm), and agreement at every other station is unchanged.
- **P300 is a poor "calm" demo station:** its cell has only 6 valid dates. P294 and P298 are
  calm and track GPS (correlation +0.74, +0.73).
- **The seasonal bar is high.** On stable hills, noise alone makes fitted amplitudes up to ~17 mm,
  so only cells with a bigger yearly wave count as seasonal. GPS seasonal motion at the stations
  is about 1 cm, so **the seasonal labels mark only the strongest seasonal areas**; most stations'
  breathing is below what single cells can resolve. Say so in the limits panel.
- Anomaly-flagged pixels are kept (data lane: ~2 mm effect); `--mask-anomaly` drops them.

## Not done yet

- **Significance threshold calibrated on stable ground** (Pratheek's real-data test: the standard F-test over-fires on bedrock). Needs a decision on control areas; see `REQUESTS.md`.
- Real-data run (waits for the stack, GPS files and uncertainty).
- Vertical: waits for Steven's stack. Canal profile: waits for Daniel's canal lines. Both need a contract change before the app shows them.
- Synthetic dates follow the brief (26 dates, 12-day repeat, two gaps) until Pratheek confirms the real list.

What each other lane needs to send is in `REQUESTS.md`.