# numbers.md: every number shown in the app or pitch (H-14)

Each lane adds its rows by hour 19. Ryan checks each against its source and ticks it.
No number goes on screen or in the video unless it is here.

| # | Number as shown | Where it appears | Source (file + field, or citation) | Owner | Checked |
|---|---|---|---|---|---|
| 1 | Levee 195 ft (1983) → 188 ft (2017) → 192 ft → 188 ft (2023) | Pitch beat 1 | SJV Water 2023; Grist | Ryan | [ ] |
| 2 | Friant-Kern up to 60% capacity loss | Pitch beat 1 | Maven's Notebook 2026; Ag Alert 2025 | Ryan | [ ] |
| 3 | ~14 km³ valley volume loss 2006–2022, >30 cm/yr locally | Project page | [citation from proposal §2] | Ryan | [ ] |
| 4 | Number of NISAR dates used | App legend | `meta.json` → `dates` | Ismail | [ ] |
| 5 | Held-out residual (net), per station | GPS reveal | `gps/processed/residuals.csv` | Daniel | [ ] |
| 6 | σ used for 2σ test | Limits / legend | `gps/processed/uncertainty.json` → `sigma_net_m` | Daniel | [ ] |
| 7 | CAFP / CAHA (and P300) net change, winter rise and trend | Demo, video | `stations.json` | Ismail | [ ] |
| 8 | Granule IDs and versions | Evidence receipts | `data/README.md` | Pratheek | [ ] |
| 9 | Polarization result (HH/HV by crop type) | Brief answers, project page | `radar/` (H-6) | Steven | [ ] |
| 10 | % of fields usable, NISAR vs Sentinel-1, and threshold used | Project page | `radar/` (H-10) | Steven | [ ] |
| 11 | Vertical vs east–west net change at held-out stations (**cross-check only, never a headline**; no data at CAHA; D7) | Project page (if done) | `radar/` (H-13) | Steven | [ ] |
| 12 | NISAR vs GPS agreement: 1.7 cm RMS per pair, with n held-out stations | Limits panel, pitch | `gps/processed/uncertainty.json` → `sigma_pair_m`, `n_stations` | Daniel | [ ] |
| 13 | Self-check range 1.2–2.2 cm per pair at 13 stations | Limits panel | `data/processed/qa_summary_t034_f020.csv` → `rms_pair_residual_m` | Pratheek | [ ] |
| 14 | Descending track ~3 cm RMS per pair | Limits panel | `data/processed/qa_summary_t042_f070.csv` → `rms_pair_residual_m` | Pratheek | [ ] |
