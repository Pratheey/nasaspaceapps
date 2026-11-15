# gps/: owned by Daniel (gps lane)

GPS stations from the Nevada Geodetic Laboratory (NGL, IGS20 frame, daily solutions), used as an
independent check on NISAR. Plan: `docs/PLAN.md`. Output shapes: `contracts/gps.md`.
**Status (2026-11-14): cleaned and checked so far: P302, P303, P304 (reference), P307. The other 10 stations (D5) are listed in
`processed/stations.csv` but their series are not cleaned yet.** Held-out stations are a prototype check, not a valley-wide accuracy claim.

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
| `processed/gps_cleaned_enu.csv` | Cleaned daily east/north/up, 2021 on, all four stations: raw and `*_corr` columns, sigmas, flags. For Steven and Ismail |
| `processed/gps_fits.csv` | Contract file: refit over the NISAR window, `up` component (LOS rows to follow). `gps_fits_enu_extra.csv` has east and north |
| `figures/p307_step_before_after.png` | P307 east/north/up raw vs corrected around 2025-11-12 |
| `processed/gps_enu_at_track034_dates.csv` | Change in mm at the 26 Track 034 dates, 5-day means, relative to 2025-11-24, plus vertical minus P302. East/north/up, **not yet in LOS** |
| `raw/*_IGS20.tenv3`, `raw/ngl_steps_selected.txt` | Original NGL files, unmodified (position = `e0 + east`, etc., metres) |

| `processed/gps_los.csv` | Daily GPS in NISAR line of sight (positive toward satellite), absolute and relative to P304. 4 stations so far |
| `processed/residuals.csv`, `uncertainty.json` | **Preliminary** H-9: NISAR minus GPS per pair and net, 3 held-out stations so far |
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

## H-5 and preliminary H-9 on cleaned GPS (4 stations)

LOS vectors come from `station_values_t034_f020.csv`. Both NISAR and GPS are relative to P304; GPS values are 7-day medians at each date, as in the data lane's tie.

| Held-out station | RMS, single pairs (cm) | Worst pair (cm) | Net residual, NISAR minus GPS (cm) |
|---|---|---|---|
| P302 | 1.6 | 3.9 | -0.0 |
| P303 | 1.8 | 5.3 | -2.3 |
| P307 | 1.8 | 3.3 | +2.0 |

- 75 pairs, none within 3 cm of a 12 cm unwrapping step. Pooled RMS 1.7 cm, close to the data lane's raw-GPS figure (1.1 to 2.9 cm at 13 stations). Cleaning changes any single residual by at most 3.5 mm.
- **The P307 north step does not affect these residuals.** It happened on 2025-11-12, before the first NISAR date, so it cancels in every pair. What the correction protects is the baseline and the fit; the 2025-11-13 to 12-31 transient is left out of the fits only.
- At P303 and P307, net NISAR and GPS differ by about 2 cm, in opposite directions. Both stations move less than 3 cm over the window, so this is about the size of the scatter.
- The P307 east anomaly (below) is about 7 mm of line-of-sight error and cannot explain a 2 cm net residual.
- **This is 3 held-out stations, not 13.** `uncertainty.json` is marked preliminary. It must be rerun with all held-out stations (Pratheek's raw check suggests the pair RMS stays near 2 cm).

**First pair is a gross-error check, not an accuracy test.** Over its 12 days (2025-11-24 to 2025-12-06) the expected motion is only 0.3 to 2.2 mm, and GPS noise on that difference is about 1.5 to 2.5 mm.
A ~1 cm agreement (H-5) can catch a wrong sign, wrong units, a missed ~12 cm unwrapping step or an ionosphere ramp. It cannot confirm millimetre accuracy.
Over the whole Track 034 span, GPS vertical change relative to P302 is P303 -28 mm, P304 -18 mm, P307 -62 mm, 6 to 25 times the GPS noise, so the accuracy test uses the chained pairs.

## Limits

Formal sigmas are not a full error model (no correlated noise, atmosphere or loading). 2026 is incomplete.
Acquisition-date values are 5-day means, not the exact day.

Source: NGL IGS20 tenv3, geodesy.unr.edu. Cite Blewitt, Hammond and Kreemer (2018), https://doi.org/10.1029/2018EO104623, and each station's own DOI.
