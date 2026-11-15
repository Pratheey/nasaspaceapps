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

To export the provisional vertical cross-check, pass the shared H-16 stack and its GPS
uncertainty file:

```bash
python -m analysis.run --component up --stack <path>/vertical_t034_t042.nc \
  --sigma-json radar/results/hour_33/vertical_uncertainty.json --out <vertical-output-folder>
```

The station comparison uses cleaned seven-day GPS Up medians, relative to P304. Curves
are aligned at the first shared observation, including stations whose GPS starts late.
The residuals compare changes at the app grid cell. H-13 reports nearest-pixel residuals
as a separate measurement. Hanford lacks descending coverage.

Pass `--canal context/canals/canals_bbox.geojson` to add profiles to the selected export.
The filenames are listed in `meta.json` under `canal_profiles`.

## Pipeline (`run.py`)

| Step | File | In | Out |
|---|---|---|---|
| 1 | `timebase.py` | ISO dates | years since 2026-01-01 (D3) |
| 2 | `netchange.check_chain` | `ref_date`, `sec_date` | the date list; fails if the pairs are not a chain |
| 3 | `regrid.py` | stack pixels (projected x/y + `crs`, or lat/lon) | each pixel's position series → median position per 0.01° app cell per date (default at least 20% valid pixels) → back to pairs |
| 4 | `fit.py` | pair values per cell | B, a, b, covariance, RSS, RSS of trend-only fit |
| 5 | `seasonal.py` | fit result | F-test p, significant?, A, σA, peak month (A and month hidden where not significant) |
| 6 | `netchange.py` | pair values per cell | cumulative position per date, net change (null if any pair missing) |
| 4b | `guards.py` | fit + which pairs each cell used | trend guard: whole fit hidden where pairs miss a season, < 15 pairs, or σ of trend > 5 cm/yr |
| 7 | `labels.py` | net, σ_net, significant | label 0–3 |
| 8 | `export.py`, `stations.py` | all of the above + Daniel's GPS CSVs | `meta.json`, `grid.json`, `series.json`, `stations.json` per `contracts/app_data.md` |
| 9 | `canal.py` | canal GeoJSON + per-cell results | `canal_profile_<name>.json` (v1.2 screening tool) |

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

## Trend guard (stack v2, 2026-11-14)

With less than a year of data, a cell whose pairs miss a whole season cannot separate the trend
from the yearly wave, and the fit lands on extreme values. On stack v2:

| Cells whose usable pairs cover | Cells | Median σ of trend | Share with \|trend\| > 30 cm/yr |
|---|---|---|---|
| all 4 seasons | 8,960 | 2.2 cm/yr | 0% |
| 3 seasons | 2,125 | 41.5 cm/yr | 62% |
| 2 seasons | 310 | 149.5 cm/yr | 75% |

`guards.py` hides the **whole fit** (trend, amplitude, peak month, fitted curve) unless the cell's
pairs cover all 4 seasons, it has ≥ 15 pairs, and σ of trend ≤ 5 cm/yr. Result: 2,908 of 11,395
fits hidden; largest trend shown drops from 314 to 22 cm/yr; no cell above 30 cm/yr. **Labels are
unchanged** (every hidden cell had already lost pairs, so it had no net change). All GPS station
cells keep their fit. `--no-trend-guard` turns it off for comparison only.

Still open: relative to P304, NISAR trends run less negative than GPS at most stations (same
model, same dates, stack v2: CAFP +0.6 vs GPS −2.2, CAHA +0.3 vs −4.0, P307 +2.1 vs −2.8 cm/yr).
Seasonal amplitudes agree well at the demo stations (CAFP 26.3 vs 26.7 mm, CAHA 14.5 vs 16.6 mm,
both peaking in February). The guard does not address the trend gap; it needs the data and gps lanes.

## Checks: cells vs station values, and label sensitivity (stack v3, σ = 1.98 cm final)

`python -m analysis.checks --stack data/interim/stack_t034_f020_v3.nc --sigma-json gps/processed/uncertainty.json`
reruns both.

**Cells vs Pratheek's station values** (1 km cell median vs his 3 × 3-pixel median at the station):
correlation +0.95 to +1.00 at all 11 stations in the bbox; RMS difference 0.1–0.7 cm except TRAN
(1.5 cm). The cell median does not distort the station series. P300's cell has only 7 valid dates.

**Label sensitivity** (cells per label 0 / 1 / 2 / 3):

| Seasonal threshold | σ = 1.2 cm | σ = 1.98 cm (used) | σ = 2.2 cm | σ = 3.0 cm |
|---|---|---|---|---|
| Both control boxes, 18.5 mm (used; 4,095 seasonal cells) | 7172 / 3226 / 580 / 1022 | 7473 / 2656 / 1170 / 701 | 7565 / 2521 / 1305 / 609 | 7892 / 2002 / 1824 / 282 |
| South-west box only = F-test only (5,405 seasonal cells) | 6172 / 3436 / 1580 / 812 | 6318 / 2788 / 2325 / 569 | 6394 / 2639 / 2476 / 491 | 6669 / 2068 / 3047 / 216 |

## Decisions taken at the analysis freeze (hour ~14)

- **Calm demo station: P298** (`analysis/export.py` → `DEMO_STATIONS`). P300's cell has 7 valid radar
  dates and no net change. P298 has all 26, GPS −0.7 cm over the window, and NISAR within 0.9 cm of GPS.
  P294 is also complete but disagrees by 2.4 cm. Ryan can swap it in one line.
- **Seasonal threshold: both control boxes kept — confirmed by D11.** The north-east box is stable
  ground (Sierra foothills, 98% valid, no farmland). Its apparent motion (+2.2 cm net, 15 mm "seasonal")
  is broad atmospheric error that the valley floor next to it shares date by date (correlation 0.90), so
  the box measures the error at the far side of the map (data/README.md, answers of 2026-11-15). The
  18.5 mm bar stays; cells near P304 are held to a stricter bar than they need. Dropping the box would add
  about 1,300 "seasonal" cells partly made of that error.

## Stack v3 = data-lane freeze (2026-11-14, hour ~12)

v3 is v2 re-tied to P304 with Daniel's cleaned GPS (`gps/processed/gps_los.csv`) instead of raw NGL
(data/README.md). Same pairs and valid pixels; pair values differ by 0.06 cm RMS. **The app data
(`frontend/public/data/`) and `NUMBERS.md` now come from v3.**

Effect: one uniform shift, as expected from a change of tie. Every station's trend moves +0.27 cm/yr
and every net change +0.33 cm. The reference P304's own cell now matches its GPS (trend −2.21 vs GPS
−2.25 cm/yr; v2 gave −2.48). Labels 0/1/2/3: 7,473 / 2,656 / 1,170 / 701 (v2: 7,366 / 2,760 / 1,074 / 800).
Seasonal threshold 18.5 mm.

**The NISAR-vs-GPS trend gap is not the tie.** At the held-out stations NISAR trends stay +1.3 to
+5.6 cm/yr above GPS (median about +2), slightly more than on v2. Still open for the data and gps
lanes; trends stay off the headline.

## H-14 numbers

`python -m analysis.numbers` writes `analysis/NUMBERS.md`: every number the app or pitch shows that
comes from this lane, recomputed from `frontend/public/data/` the way the app computes it, with its
source. Rerun after any change to the app data.

The optional vertical and canal outputs follow v1.2 of `contracts/app_data.md`.

## Not done yet

- **Vertical cross-check in the app** (contracts v1.2 section 6): optional; needs Steven's two-track stack
  from the Drive and GPS up.
- **Second canal (Delta-Mendota):** needs a working source (gps lane).

**Explained, not corrected (D11):** NISAR net change sits about 1 cm above GPS on average, from a shared
date-by-date wobble at the reference P304 and a tilt of about 0.34 mm per km toward the east (2–3 cm across
the map). Toward the east edge, sinking is understated, not overstated. Correcting it would use the
held-out stations for calibration, so it stays as measured and the limits panel says so. No NISAR-only
trend is quoted anywhere.

What each other lane needs to send is in `REQUESTS.md`. Numbers shown in the app: `NUMBERS.md`.
Other lanes' numbers checked by this lane: `SECOND_CHECK.md`.
