# gps/: owned by Daniel (gps lane)

GPS stations P302, P303, P304, P307 from the Nevada Geodetic Laboratory (NGL, IGS20 frame,
daily solutions), used as an independent check on NISAR. Plan: `docs/PLAN.md`. Output shapes: `contracts/gps.md`.
Four stations are a prototype check, not a valley-wide accuracy claim.

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
| `processed/gps_cleaned_enu.csv` | Cleaned daily east/north/up, 2021 on, all four stations: raw and `*_corr` columns, sigmas, flags. For Steven and Ismail |
| `processed/gps_fits.csv` | Contract file: refit over the NISAR window, `up` component (LOS rows to follow). `gps_fits_enu_extra.csv` has east and north |
| `figures/p307_step_before_after.png` | P307 east/north/up raw vs corrected around 2025-11-12 |
| `processed/gps_enu_at_track034_dates.csv` | Change in mm at the 26 Track 034 dates, 5-day means, relative to 2025-11-24, plus vertical minus P302. East/north/up, **not yet in LOS** |
| `raw/*_IGS20.tenv3`, `raw/ngl_steps_selected.txt` | Original NGL files, unmodified (position = `e0 + east`, etc., metres) |

Not yet written (need Pratheek's LOS geometry, H-4): `gps_los.csv`, the `los` rows of `gps_fits.csv`, `residuals.csv`, `uncertainty.json`.

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

**First pair is a gross-error check, not an accuracy test.** Over its 12 days (2025-11-24 to 2025-12-06) the expected motion is only 0.3 to 2.2 mm, and GPS noise on that difference is about 1.5 to 2.5 mm.
A ~1 cm agreement (H-5) can catch a wrong sign, wrong units, a missed ~12 cm unwrapping step or an ionosphere ramp. It cannot confirm millimetre accuracy.
Over the whole Track 034 span, GPS vertical change relative to P302 is P303 -28 mm, P304 -18 mm, P307 -62 mm, 6 to 25 times the GPS noise, so the accuracy test uses the chained pairs.

## Limits

Formal sigmas are not a full error model (no correlated noise, atmosphere or loading). 2026 is incomplete.
Acquisition-date values are 5-day means, not the exact day.

Source: NGL IGS20 tenv3, geodesy.unr.edu. Cite Blewitt, Hammond and Kreemer (2018), https://doi.org/10.1029/2018EO104623, and each station's own DOI.
