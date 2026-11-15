# Data story: which data answers which question

| Question | Dataset (product + version) | How we use it | Where it shows in the app |
|---|---|---|---|
| Where is the ground sinking over the NISAR window? | NISAR L2 GUNW, T034 asc F020, provisional | First-to-last net LOS change | Main map |
| Does it breathe with the seasons? | Same | Pairwise fit, seasonal term where significant | Click to inspect, breathing animation |
| Can two dates mislead? | Same | Any-pair differences from the cumulative series | Pick Two Dates |
| Is the radar right? | NGL GPS: held-out stations, P304 as the reference (D5); 1.8 cm RMS per pair at 13 held-out stations (D9) | LOS projection, residual table | GPS reveal, evidence receipts |
| Up/down vs east-west? (cross-check only, D7) | NISAR L2 GUNW, T042 desc F070, provisional, with T034 | Combine the two viewing directions; compare with GPS up | Project page only, labelled cross-check |
| Does rebound hide sinking? | NGL GPS CAFP (Five Points) and CAHA (Hanford) with NISAR at the same spots | Winter rise of about 1 cm, then 5–6 cm of sinking by August | Demo, Pick Two Dates |
| Why does it move? | Groundwater levels [source TBD by Daniel] | Mechanism only, not validation | Context layer |
| Why does it matter? | Canals, aqueducts, communities [sources TBD] | Screening context | Context layers |
| Is this new? | OPERA DISP-S1 (unfiltered), DWR/TRE | Historical context only | Historical panel (48 h) |
| Polarization | NISAR L2 GCOV HH/HV, provisional | Per-field backscatter with crop labels | Polarization panel |
