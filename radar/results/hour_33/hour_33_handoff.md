# Steven’s hour 33 radar handoff

## Ismail · H-16 motion stack

`vertical_t034_t042.nc` contains vertical and east–west displacement for 24 intervals on the ascending 80 m grid. Positive values mean up or east. It uses EPSG:32611 and records both tracks’ acquisition dates. There are **764,156 pixels** with valid radar data across the full window, **28.2%** of the ascending grid. The preview map shows totals only for those complete pixels.

The team’s analysis pipeline read the finished NetCDF and generated its grid and time-series outputs. The test produced net estimates for 5,319 of the app’s 12,000 cells with the existing 20% minimum pixel-coverage rule. The test used the measured vertical uncertainty in `vertical_uncertainty.json`. The app’s existing station exporter is built around GPS line-of-sight data, so the test used no GPS overlay. Use the vertical comparison CSVs for GPS Up.

## Ryan · H-13 GPS cross-check

| Measurement | RMS difference from GPS | Usable comparisons | Held-out stations |
|---|---:|---:|---:|
| Descending LOS, first pair | 2.67 cm | 11 | 11 |
| Descending LOS, all 27 pairs | 2.95 cm | 254 | 12 |
| Vertical motion, nearest map pixels | 2.35 cm | 213 | 12 |
| East–west motion, nearest map pixels | 2.92 cm | 197 | 11 |
| Full-window vertical change | 2.49 cm | 4 | 4 |
| Full-window east–west change | 2.52 cm | 4 | 4 |

At Five Points (CAFP), radar estimated **2.5 cm down** and GPS measured **5.7 cm down** relative to P304 over their shared December 6, 2025–October 14, 2026 window. Hanford (CAHA) falls outside descending coverage. P307’s flagged GPS transient is omitted from the vertical check. Its unresolved antenna-related east offset excludes the station from the east comparison and adds uncertainty to its post-transient descending LOS residuals. The results are provisional and apply to these stations and dates. [Team decision D7](https://github.com/Pratheey/nasaspaceapps/blob/ccbf9dc/docs/DECISIONS.md)

## Method

The two inputs are the terrain-corrected T034 F020 v2 and T042 F070 team stacks. Descending pixel centers were selected by nearest-neighbour sampling after projecting the ascending grid to the descending UTM zone. The tracks matched on 25 distinct acquisition dates, with descending one day later than ascending at every match. The ascending February 4, 2026 date had no descending date within six days and was omitted. For longer intervals the raster sums observed consecutive increments only where every contributing pixel is valid. Both inputs’ P304 GPS ties were removed so motion is relative to P304. North motion is assumed zero.

GPS positions use seven-day medians of cleaned daily measurements, with a minimum of three valid days. The two-track comparison uses GPS on ascending dates, relative to P304, and the radar pixel nearest each station. The descending LOS check uses the data lane’s published station samples and projects the GPS onto the descending look vector at each station. P304 sets the reference and is excluded from all error statistics.

In the repository, place `vertical.py` in `radar/` and use the shared Python requirements. Run `python radar/vertical.py --asc /path/to/stack_t034_f020_v2.nc --desc /path/to/stack_t042_f070.nc --out /path/to/hour_33`. For the H-16 analysis run, pass `--component up --var up_disp_m` and the supplied vertical uncertainty JSON.

[Team stack folder](https://drive.google.com/drive/u/0/folders/152RzXsar-DzAYQNfZgIvnsXe4jqM06Fz) · [Radar station samples](https://github.com/Pratheey/nasaspaceapps/tree/ccbf9dc/data/processed) · [GPS series](https://github.com/Pratheey/nasaspaceapps/tree/ccbf9dc/gps/processed) · [Analysis request](https://github.com/Pratheey/nasaspaceapps/blob/ccbf9dc/analysis/REQUESTS.md)
