# Limits panel text (for Avi; paste as-is)

**What this map shows**
- Ground motion measured by NISAR along the radar's line of sight, from 24 Nov 2025 to
  14 Oct 2026, relative to GPS station P304. Negative means moving away from the satellite,
  which here is mostly sinking.
- The headline is the change from the first to the last date. Those dates are in nearly the
  same season, so most of the seasonal movement cancels out.

**What the fit means**
- We fit each location with a steady trend plus a once-a-year cycle. With less than a year
  of data, the two can trade off, so the trend is shown with its uncertainty and is never
  the headline.
- Seasonal size and timing are shown only where the cycle passes a significance test.
  Elsewhere the app says "seasonal term not significant here."

**What it does not mean**
- It does not say how much of the sinking is permanent.
- It does not measure water volume, aquifer health, or where to recharge.
- "Insufficient evidence" means we could not tell, not that the ground is stable.

**How we checked it**
- GPS stations that were never used to calibrate the radar are compared with NISAR in the
  GPS reveal, including the one that disagrees most.
- NISAR and GPS agree to about 1.8 cm per 12-day pair (root mean square, held-out stations
  checked so far; the station count is shown next to it and comes from
  `gps/processed/uncertainty.json`). A separate check at 13 stations gives 1.2 to 2.2 cm.
  Motion smaller than that is not resolved at a single spot.
- A handful of check stations in one radar frame make a prototype check, not a valley-wide
  accuracy claim.

**About the data**
- NISAR data here is provisional. NASA and ISRO will release reprocessed, validated
  versions in 2027.
- Corrected for the ionosphere, the troposphere and solid Earth tides using the product's
  own correction layers, read at each spot's ground height.
- A second NISAR viewing direction (descending track) is used only as a cross-check of
  vertical vs east-west motion. It is noisier (about 3 cm per pair) and misses Hanford.
- Each map cell is the median of the radar pixels inside it. Single pixels on farmland can
  show soil-moisture effects that look like sinking.
- Published figures (levee heights, canal capacity, valley-wide subsidence) are other
  people's measurements, credited where shown.
