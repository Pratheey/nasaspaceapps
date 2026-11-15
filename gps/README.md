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
| `processed/gps_enu_at_track034_dates.csv` | Change in mm at the 26 Track 034 dates, 5-day means, relative to 2025-11-24, plus vertical minus P302. East/north/up, **not yet in LOS** |
| `raw/*_IGS20.tenv3`, `raw/ngl_steps_selected.txt` | Original NGL files, unmodified (position = `e0 + east`, etc., metres) |

Not yet written (need Pratheek's LOS geometry, H-4): `gps_los.csv`, `gps_fits.csv`, `residuals.csv`, `uncertainty.json`.

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

## Early numbers (to be replaced by the refit over the NISAR window)

Vertical rate 2022 to 2025-10 (mm/yr): P302 -2, P303 -44, P304 -10, P307 -66.
GPS vertical change over the whole Track 034 span (2025-11-24 to 2026-10-14), minus P302:
P303 -28 mm, P304 -18 mm, P307 -62 mm.

**First pair is a gross-error check, not an accuracy test.** Over its 12 days the expected motion is only
0.3 to 2.2 mm, and GPS noise on that difference is about 1.5 to 2.5 mm. A ~1 cm agreement (H-5) can catch a
wrong sign, wrong units, a missed ~12 cm unwrapping step or an ionosphere ramp. It cannot confirm millimetre accuracy.
The accuracy test uses the chained pairs, where the signal is 6 to 25 times the GPS noise.

## Limits

Formal sigmas are not a full error model (no correlated noise, atmosphere or loading). 2026 is incomplete.
Acquisition-date values are 5-day means, not the exact day.

Source: NGL IGS20 tenv3, geodesy.unr.edu. Cite Blewitt, Hammond and Kreemer (2018), https://doi.org/10.1029/2018EO104623, and each station's own DOI.
