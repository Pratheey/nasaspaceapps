# What the analysis lane needs from other lanes

Written by the analysis lane (Ismail). Each section can be pasted to that person. File
shapes are in `contracts/`. Anything marked **new** is not in contracts v1 yet, so Ryan has
to agree to it first.

## Steven (radar): vertical motion for the seasonal fit

Goal: the app shows **vertical** motion with the same net change, seasonal fit and labels
as the line-of-sight map, and compares it with GPS **up**, which is the cleanest check there is.

1. **Combine ascending (T034 F020) and descending (T042 F070) into vertical and east.**
   Per pixel or cell: `los_asc = e_asc·E + u_asc·U`, `los_desc = e_desc·E + u_desc·U` (north
   is poorly constrained; ignore it and say so). Use the `los_east`/`los_up` unit vectors
   from each stack (`contracts/stack.md`).
2. **Match dates.** The tracks don't share dates (ascending starts 2025-11-24, descending
   2025-11-01). Suggestion: pair each ascending date with the nearest descending date
   (≤ 6 days apart), solve on those matched epochs, and record the offset in days for each.
   **Never interpolate across gaps.** If an epoch has no match, leave it out.
3. **Reference** both tracks to P304, as ascending is (D3). Same sign rules: **up is positive**.
   Units: metres.
4. **Deliver a vertical stack in the same shape as `contracts/stack.md`**, so `analysis/run.py`
   reads it unchanged:
   - `up_disp_m (pair, y, x)`: a sequential chain of matched epochs (epoch i → i+1), NaN where missing
   - `valid (pair, y, x)`, `ref_date`, `sec_date` (use the ascending date of each epoch), `x`, `y`
     plus a `crs` attribute, **or** `lat`/`lon` variables
   - attrs: `reference_station = "P304"`, `sign_convention = "positive up"`, `product_maturity = "provisional"`, and a note of the date matching used
   - the east component too, as `east_disp_m` (not used by the fit yet)
5. **Check it against GPS up** at the held-out stations before handing it over (H-13).

The analysis lane then runs:
`python -m analysis.run --component up --var up_disp_m --stack <vertical.nc> --sigma-json <uncertainty for up> --out <folder>`
**New:** the vertical app files need a place in the app (a folder like `public/data/vertical/`) and a Ryan decision.

## Daniel (gps): files the analysis lane reads

- `gps/processed/stations.csv`, `gps_los.csv`, `gps_fits.csv`, `residuals.csv`,
  `uncertainty.json` exactly as in `contracts/gps.md`. **Without them there is no
  `stations.json`, and the app silently shows the synthetic samples instead of real data.**
- **Any number of stations works.** `stations.csv` can list all 13 NGL stations Pratheek found
  (one `reference`, the rest `held_out`); the app files follow it automatically.
- `residuals.csv`: mark ~12 cm unwrapping pairs with `unwrap_flag = 1`. The analysis lane drops them
  from the fit with `--exclude-pairs`.
- **For vertical:** `gps_fits.csv` rows with `component = up`, and a daily up series
  (new: suggest `gps_up.csv` with the same columns as `gps_los.csv`).
- **Canal profile (new):** canal centre lines clipped to the app bbox as GeoJSON
  LineStrings in lon/lat, one file per canal in `context/`, with `name` and source/release in
  the properties (California Aqueduct, Delta-Mendota Canal, and Friant-Kern if it falls inside).

## Pratheek (nisar)

- Which does the stack carry: `lat`/`lon` variables, or `x`/`y` + `crs` (which EPSG)?
  `run.py` handles either.
- The real date list, so the synthetic tests can use it.

## Ryan (integrator): decisions needed

1. Sign-off on the weighted fit (see `analysis/README.md`, method notes).
2. **Significance threshold calibrated on stable ground.** Pratheek's real-data test found the
   standard F-test flags a "significant seasonal" signal on bedrock that shouldn't move.
   Proposal: choose the threshold so that only 5% of cells on a fixed set of stable
   control areas pass, and record those areas in DECISIONS.
3. **New output files:** `canal_profile_<name>.json` and the vertical app files. Their shape is in
   `analysis/canal.py` and `run.py`; please add them to `contracts/` if they go in the app.
4. Demo stations: Pratheek proposes CAFP and CAHA instead of P302/P307 (needs Daniel to add them).