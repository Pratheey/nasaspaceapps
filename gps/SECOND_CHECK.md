# Second check of other lanes' numbers (H-14 two-person rule), GPS lane

Checked by Daniel's lane (`gps`), 2026-11-15, against the files on `main` (afd0552). Each value was
recomputed from the source file named in `docs/pitch/numbers.md`. Ryan: tick the rows below.

| numbers.md row | Owner | Number as listed | Recomputed | Result |
|---|---|---|---|---|
| 4, 15 | Ismail | 26 passes, 2025-11-24 to 2026-10-14 | `meta.json` → `dates`: 26 | ✓ |
| 16 | Ismail | 8,044 km² of ground measured | 8,116 cells with a net change × (0.01 × 111 km) × (0.01 × 111 × cos 36.45°) km² = 8,043.5 | ✓ (uses 111 km per degree and one latitude, so "about 8,000 km²" is the safe wording) |
| 17 | Ismail | 41% sinking beyond the uncertainty | labels 1 or 3 ÷ cells with a net change: 3,357 ÷ 8,116 = 41.4% | ✓ |
| 18 | Ismail | −16.3 ± 2.0 cm at 36.175 N, 120.045 W | most negative `net_change_m`: −16.3 cm, σ 1.98 cm, cell row 77, col 55 → 36.175 N, 120.045 W | ✓ |
| 19 | Ismail | 22 / 6 / 10 / 62% of 12,000 cells | labels 1 / 3 / 2 / 0: 2,656 / 701 / 1,170 / 7,473 | ✓ |
| 20 | Daniel | σ of net change 1.98 cm | `meta.json` → `sigma_net_m` 0.0198 = `uncertainty.json` = RMS of the 12 net residuals | ✓ |
| 21 | Ismail | CAFP −6.1 ± 2.0 NISAR vs −7.0 GPS; CAHA −3.9 vs −7.4 | `stations.json` first-to-last on both dates from 2025-12-06: CAFP −6.1 / −7.0, CAHA −3.9 / −7.4 | ✓, with a wording note below |
| 22 | Ismail | CAHA 2025-12-06 → 2026-02-04 NISAR +0.7, GPS +0.1; full record −3.9 / −7.4 | same file: +0.7 / +0.1, −3.9 / −7.4 | ✓ |

**Wording note (row 21).** `stations.json` holds absolute line of sight: NISAR tied to P304 and GPS with
P304's own motion added back. In `gps/processed/residuals.csv` the same values are relative to P304, so the
GPS net is about −4.4 cm at CAFP and −4.8 cm at CAHA. The NISAR − GPS difference is the same in both (+0.9 and
+2.6 cm), so the residual and σ are unaffected. Say "absolute line of sight" wherever −7.0 / −7.4 appear, so
nobody compares them with the relative column in `residuals.csv`.

**For Ryan (rows not ticked as correct, no error found)**
- Row 7 still names **P300** as the calm station, but the app and `analysis/NUMBERS.md` use **P298**.
- `analysis/NUMBERS.md` lists the P298 row twice in the demo table (cosmetic).
- D5's "12 held-out" is 13 (its own list has 13 plus P304); D9 and `uncertainty.json` already say 13.
  `PLAN.md` still says 12 in the H-9 and Daniel-lane rows.
- Row 12 and 13 wording: "1.8 cm per pair" and "1.2–2.2 cm per pair" are consistent (13 stations, 1.16 to 2.24 cm).
