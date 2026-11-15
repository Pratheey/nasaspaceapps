# gps/: owned by Daniel (gps lane)

GPS stations from the Nevada Geodetic Laboratory (NGL, IGS20 frame, daily solutions), used as an
independent check on NISAR. Plan: `docs/PLAN.md`. Output shapes: `contracts/gps.md`.
**Status (2026-11-14): all 14 stations (P304 reference, 13 held out) are in `processed/`; residuals, uncertainty and fits cover all of them.**
Held-out stations are a prototype check, not a valley-wide accuracy claim.

GPS stations from the Nevada Geodetic Laboratory, used as an independent check on NISAR. As of D5: P304 is the reference and 12 stations are held out (P294, P297, P298, P300, P302, P303, P307, P725, CAFP, CAFR, CAHA, CAKC, TRAN); coordinates are in `data/processed/stations_ngl.csv`. See `docs/PLAN.md`.

GPS stations from the Nevada Geodetic Laboratory, used as an independent check on NISAR. As of D5: P304 is the reference and 12 stations are held out (P294, P297, P298, P300, P302, P303, P307, P725, CAFP, CAFR, CAHA, CAKC, TRAN); coordinates are in `data/processed/stations_ngl.csv`. See `docs/PLAN.md`.

## H-1: station coordinates (latest epoch, WGS84; height is ellipsoidal, not elevation)

| Station | lat | lon | height_m | Role (D3, proposed) | Last epoch |
|---|---|---|---|---|---|
| P302 | 36.6347271 | -120.6185799 | 122.637 | held out | 2026-10-31 |
| P303 | 37.0543829 | -120.7053006 | -2.451 | held out | 2026-10-31 |
| P304 | 36.7390040 | -120.3566036 | 16.847 | **reference** | 2026-10-21 |
| P307 | 36.9472697 | -120.0579247 | 48.598 | held out | 2026-10-31 |

Heights fall as the ground sinks (P307: 49.5 m in 2005, 48.6 m now). The east/north columns in the
`.tenv3` files are in a custom projection centred on -120.1 deg, not UTM; do not map them.

## Files

| Path | What it is |
|---|---|
| `processed/stations.csv` | Contract file (H-1): coordinates, role, steps removed |
| `processed/gps_cleaned_enu.csv` | Cleaned daily east/north/up: raw and `*_corr` columns, sigmas, flags. The first four stations from 2021, the other ten from 2025-01-01 (only P307 has a correction). For Steven and Ismail |
| `processed/gps_fits.csv` | Contract file: refit over the NISAR window, `up` component (LOS rows to follow). `gps_fits_enu_extra.csv` has east and north |
| `figures/p307_step_before_after.png` | P307 east/north/up raw vs corrected around 2025-11-12 |
| `processed/gps_enu_at_track034_dates.csv` | Change in mm at the 26 Track 034 dates, 5-day means, relative to 2025-11-24, plus vertical minus P302. East/north/up, **not yet in LOS** |
| `raw/*_IGS20.tenv3`, `raw/ngl_steps_selected.txt` | Original NGL files, unmodified (position = `e0 + east`, etc., metres) |

| `processed/gps_los.csv` | Daily GPS in NISAR line of sight (positive toward satellite), absolute and relative to P304. all 14 stations |
| `processed/residuals.csv`, `uncertainty.json` | H-9: NISAR minus GPS per pair and net, 13 held-out stations |
| `scripts/build_gps_los.py` | Rebuilds the four files above from `raw/*.tenv3` and `data/processed/station_values_t034_f020.csv`. Add a station's `.tenv3` to `raw/` and rerun |

## Cleaning

- **P307, 2025-11-12 antenna and receiver** (confirmed in the NGL steps list). North step about -13 mm
  (models gave -11 to -14); +12.9 mm added to north from 2025-11-13. Up: no significant step (-5 to +7 mm), not corrected.
  **East is unresolved** (8 to 17 mm): the east velocity is about -25 mm/yr before the swap and much slower
  after it, and one year of data cannot separate a step from a velocity change. Not corrected.
- P303 (2024-04-22) at most 1.4 mm and P302 (2021-11-17) at most 0.8 mm: not corrected.
- A scan of the full P307 record (2005-2026) found no other step above about 4 mm.

## Flags to mask

- P307 **2025-11-13 to 2025-12-31**: post-swap spikes and transient. Do not use east or up there.
  This covers the first Track 034 pair (2025-11-24 to 2025-12-06).
- P307 from 2026-01-01: east step unresolved, so treat east as uncertain.
- P304 data ends 2026-10-21 (the NISAR window ends 2026-10-14, so it is covered).

## Refit over the NISAR window (2025-11-24 to 2026-10-14), vertical

Model per `docs/PROPOSAL.md` section 5, fitted to daily GPS: offset + trend + annual sine/cosine, t = (date - 2026-01-01)/365.25 yr.
Sigmas come from a moving-block bootstrap (21-day blocks), which allows for time-correlated noise; plain least squares was about 1.5 to 2 times smaller.
P307's flagged post-swap days (2025-11-24 to 2025-12-31) are left out of its fit.

| Station | Trend (cm/yr) | Seasonal amplitude A (mm) | Peak month | Preliminary 2025 trend (PROPOSAL) |
|---|---|---|---|---|
| P302 | +0.27 +/- 0.28 | 4.0 +/- 0.6 | 10 | -0.26 |
| P303 | -3.55 +/- 0.20 | 4.4 +/- 0.7 | 8 | -3.48 |
| P304 | -1.55 +/- 0.29 | 2.2 +/- 0.9 | 12 | -0.78 |
| P307 | -4.75 +/- 0.89 | 8.5 +/- 2.6 | 3 | -5.96 |

The window is under one year, so trend and seasonal terms trade off and these are descriptive, not a decomposition.
How much they trade off: a straight-line fit with no seasonal term gives P302 +0.57, P303 -2.51, P304 -1.98 and P307 -7.40 cm/yr, so the trend moves by 0.3 to 2.7 cm/yr depending on whether a seasonal term is included. Quote any trend with that caveat; the net change between dates (no model) is the safer number.
P302 is consistent with zero trend. P307 has the largest amplitude and uncertainty and a peak month that is not physically obvious: treat its amplitude as unconfirmed.
East and north fits are in `processed/gps_fits_enu_extra.csv` (contract file `gps_fits.csv` has the `up` rows only until LOS exists).

**P307 east motion looks wrong after the swap.** East velocity in the window is -1.7 mm/yr at P307 against -17.5 (P302), -20.5 (P303) and -17.9 (P304) mm/yr at the other three, and P307 itself ran about -25 mm/yr before the swap.
That gap (about 16 mm/yr) projects to roughly 8 mm/yr of line-of-sight error at P307, about 7 mm over the window, against a P307 net signal near 60 mm. Referencing to P304 cancels common regional motion but not this anomaly.
Options for LOS projection: use the three-station mean east velocity for P307, or add the anomaly to its LOS uncertainty. To be decided with Pratheek.

## H-5 and H-9: held-out residuals, 13 stations (2026-11-14)

LOS vectors come from `station_values_t034_f020.csv` (stack v2). Both NISAR and GPS are relative to P304; GPS values are 7-day medians at each date, as in the data lane's tie. Rebuild with `scripts/build_gps_los.py`.

| Held-out station | Pairs | RMS, single pairs (cm) | Worst pair (cm) | Net residual, NISAR minus GPS (cm) |
|---|---|---|---|---|
| CAFP | 24 | 1.9 | 4.0 | +1.0 |
| CAHA | 24 | 2.1 | 3.8 | +2.7 |
| P300 | 25 | 2.1 | 4.3 | +1.3 |
| CAFR | 24 | 1.9 | 4.7 | +4.7 |
| CAKC | 24 | 2.2 | 4.8 | -0.5 |
| TRAN | 24 | 1.2 | 2.8 | -0.4 |
| P294 | 25 | 1.6 | 3.0 | +1.8 |
| P297 | 18 | 1.8 | 3.4 | none (18 valid pairs) |
| P298 | 25 | 2.1 | 4.2 | +0.8 |
| P302 | 25 | 1.6 | 3.8 | +0.6 |
| P303 | 25 | 1.8 | 5.3 | -2.4 |
| P307 | 25 | 1.8 | 3.2 | +2.2 |
| P725 | 25 | 1.7 | 4.5 | +0.5 |

`uncertainty.json`: `sigma_pair_m` = 0.0184 and `sigma_net_m` = 0.0198 (13 held-out stations, 313 pairs, no pair flagged).

- **No pair is flagged.** `unwrap_flag` is 1 only when a pair's residual is within 3 cm of a whole number of L-band cycles (12.1 cm, not zero) **and** the shift is still there one pair later (the pair's residual plus the next pair's is still within 3 cm of that cycle): the data lane's persistence test, since an unwrapping error stays and one-date atmosphere reverses. The last pair cannot be tested, so it is flagged if it is near a cycle.
- **Stations with no GPS on 2025-11-24** (CAFP, CAFR, CAHA, CAKC, TRAN): their net row is 2025-12-06 to 2026-10-14 (24 pairs) and their `los_m` is relative to 2025-12-06. `sigma_net_m` therefore mixes 24- and 25-pair nets. P297 has 18 valid NISAR pairs, so it has no net row.
- **Steps at the 10 new stations were not checked against NGL's steps list.** A scan of 2025-10-25 to 2026-10-31 found no 14-day median jump above 5 mm horizontally or 15 mm vertically at any of them, so nothing was removed. The 15 mm figure at CAFP (early May 2026) is steady sinking, not a step: 7-, 14-, 28- and 56-day medians before and after that date differ by 4, 15, 22 and 39 mm, growing with the window.
- **The P307 north step does not affect these residuals.** It happened on 2025-11-12, before the first NISAR date, so it cancels in every pair. The 2025-11-13 to 12-31 transient is left out of the fits only.
- **Largest net disagreements:** CAFR (+4.7 cm) and CAHA (+2.7 cm). NISAR shows about half of the sinking GPS sees at CAHA.
- **D5 says 12 held-out stations; its own list has 13.** With P304 that is 14 stations.
- Four to thirteen stations in one frame are a prototype check, not a valley-wide accuracy claim.

**First pair is a gross-error check, not an accuracy test.** Over its 12 days (2025-11-24 to 2025-12-06) the expected motion is only 0.3 to 2.2 mm, and GPS noise on that difference is about 1.5 to 2.5 mm.
A ~1 cm agreement (H-5) can catch a wrong sign, wrong units, a missed ~12 cm unwrapping step or an ionosphere ramp. It cannot confirm millimetre accuracy.
Over the whole Track 034 span, GPS vertical change relative to P302 is P303 -28 mm, P304 -18 mm, P307 -62 mm, 6 to 25 times the GPS noise, so the accuracy test uses the chained pairs.

## Limits

Formal sigmas are not a full error model (no correlated noise, atmosphere or loading). 2026 is incomplete.
Acquisition-date values are 5-day means, not the exact day.

Source: NGL IGS20 tenv3, geodesy.unr.edu. Cite Blewitt, Hammond and Kreemer (2018), https://doi.org/10.1029/2018EO104623, and each station's own DOI.
