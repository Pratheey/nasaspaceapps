# Second check of other lanes' numbers (H-14 two-person rule)

Checked by the analysis lane (Ismail), 2026-11-14, against the files on `main`. Each value was recomputed
independently from the source file named in `docs/pitch/numbers.md`. Ryan: tick the rows below.

| numbers.md row | Owner | Number as listed | Recomputed | Result |
|---|---|---|---|---|
| 5 | Daniel | Held-out net residual per station (GPS reveal) | `frontend/public/data/stations.json` → `residuals.net_m` equals `gps/processed/residuals.csv` (`pair = net`) at all 10 held-out stations in the app | ✓ |
| 6 | Daniel | σ for the 2σ test = `sigma_net_m` | 1.98 cm = RMS of the 12 net residuals in `residuals.csv` (P297 has no net) | ✓ |
| 12 | Daniel | 1.8 cm RMS per pair, 13 held-out stations | 1.84 cm = RMS of 313 unflagged pair residuals over 13 stations in `residuals.csv` | ✓ |
| 13 | Pratheek | Self-check 1.2–2.2 cm per pair, 13 stations | `qa_summary_t034_f020.csv` → `rms_pair_residual_m`: 1.15–2.24 cm, 13 stations (stack v3). "About 1.2–2.2 cm" is fair; strict rounding gives 1.1–2.2 | ✓ (wording note) |
| 14 | Pratheek | Descending ~3 cm RMS per pair | `qa_summary_t042_f070.csv`: median 2.78 cm, range 1.28–5.35 cm, 12 stations | ✓ |

Not checked here: row 8 (granule IDs and versions) is a list, not a number; it needs a read against `data/README.md`.

**2026-11-15 local follow-up:** Row 5 above verifies the historical native-pixel residual export.
The website now computes the disagreement of its actual 1 km cell and daily GPS curve instead;
the scopes are different. See `ACCURACY_REVIEW.md`. The original two-person check remains
a historical record, and this automated review is not a new team sign-off.
