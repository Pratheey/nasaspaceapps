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
| 9 | Median HV/HH −6.1 dB almonds, −7.7 dB alfalfa, −7.9 dB cotton. 780 paired observations across 30 fields and 26 dates. | Brief answers, project page, app ("The fields") | Median over the 26 `hv_over_hh_db` values per group in `radar/results/nisar-polarization-by-crop.csv`; count of paired HH and HV in `radar/results/nisar-polarization-fields.csv` | Steven | [x] Ryan, recomputed 2026-11-14 |
| 10 | NISAR 542/690 (78.6%), Sentinel-1 558/690 (80.9%). Median coherence ≥ 0.30 and valid coherence at ≥ 50% of field pixel centers. Same 30 fields, 23 matched pairs. | Project page, app ("The fields", Fields layer) | Sum `fields_usable` and `fields_total` by sensor in `radar/results/matched-radar-coverage-by-pair.csv`; thresholds in `min_median_coherence`, `min_valid_pixel_fraction` | Steven | [x] Ryan, recomputed 2026-11-14 |
| 11 | Provisional two-track cross-check relative to P304 (**cross-check only, never a headline**, D7). Full-window GPS differences 2.49 cm RMS vertically and 2.52 cm RMS east–west, four held-out sites each. Five Points shared window (2025-12-06 to 2026-10-14): 2.5 cm down (radar), 5.7 cm down (GPS). Hanford has no descending coverage. | Project page, optional cross-check | `radar/results/hour_33/vertical_gps_stations.csv`: `up_net_residual_m`, `east_net_residual_m`, CAFP `radar_up_shared_m` and `gps_up_shared_m`, CAHA `n_radar_pairs`; RMS over the non-empty held-out residuals | Steven | [x] Ryan, recomputed 2026-11-14 |
| 12 | NISAR vs GPS agreement: 1.8 cm RMS per pair, 13 held-out stations (final, D9; was 1.7 cm at n = 3) | Limits panel, pitch | `gps/processed/uncertainty.json` → `sigma_pair_m`, `n_stations` | Daniel | [ ] |
| 13 | Self-check range 1.2–2.2 cm per pair at 13 stations | Limits panel | `data/processed/qa_summary_t034_f020.csv` → `rms_pair_residual_m` | Pratheek | [ ] |
| 14 | Descending track ~3 cm RMS per pair | Limits panel | `data/processed/qa_summary_t042_f070.csv` → `rms_pair_residual_m` | Pratheek | [ ] |
