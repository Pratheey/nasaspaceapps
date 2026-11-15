# DECISIONS.md: append-only log

New entries go at the **bottom**. Never edit or delete old entries. To change a decision,
add a new entry that overrides it. Agents read the last few entries at the start of every
session, so write each entry so an agent can act on it: what changed, why, and what each
lane must now do differently.

Format:

```
## D<n>: <date> <time>: <short title>
- **Decision:**
- **Why:**
- **Impact per lane:** data: … / backend: … / frontend: … / story: …
```

---

## D1: 2026-11-13: Repo skeleton
- **Decision:** One shared repo with five lanes. Each lane owns its folders, as listed in
  `AGENTS.md`. Theme: "Dancing with the SARS," using the SARS dataset. Idea and stack
  are not chosen yet.
- **Why:** Lets five people and their agents work in parallel without merge conflicts.
- **Impact per lane:** Everyone sets `.lane` and works only in their own folders.

## D2: 2026-11-14: Idea chosen: The Breathing Ground
- **Decision:** We build The Breathing Ground for the "Dancing with the SARs" challenge, as
  written in `docs/PROPOSAL.md`. `docs/PROJECT.md` is now version 1. The "SARS dataset" in
  D1 means NISAR L2 GUNW (provisional), Track 034 ascending, Frame 020.
- **Why:** The team agreed on the proposal. It answers the brief with real NISAR data and
  can be checked against independent GPS.
- **Impact per lane:** nisar: follow `docs/PLAN.md`. / analysis: follow `docs/PLAN.md`. /
  gps: follow `docs/PLAN.md`. / frontend: follow `docs/PLAN.md`. / story: pitch theme is
  "The ground lies twice a year." The old "backend" lane does not exist; there is no server.

## D3: 2026-11-14: Contracts v1, reference station, sign, units, stack
**Status: proposed by the Integrator, confirm or override at check-in 1 (hour 2).** Until
then, build against it.
- **Decision:**
  - **Sign convention:** in every processed file, positive LOS displacement = motion
    **toward the satellite** (for mostly vertical motion, uplift). Negative = away (sinking).
    Pratheek confirms the GUNW's native sign from the product spec on the first pair and
    converts if needed.
  - **Units:** metres in every file, and every column or key that holds a length ends in
    `_m` (rates in `_m_per_yr`). The frontend converts to cm for display only.
  - **Reference station: P304.** All NISAR pairs are referenced to the pixel at P304 and
    tied to P304's GPS motion projected into LOS. P302, P303 and P307 are held out and never
    used for calibration. Why P304: it is slow (≈ −0.8 cm/yr in the 2025 fit) and it is not
    one of the two demo stations, so both demo stations stay independent checks.
    **Fallback:** if P304 is masked or incoherent in the first pair, use P302 and say so in
    a new decision entry.
  - **Pairs:** a sequential chain, date i → date i+1. Cumulative displacement at date k is
    the sum of pairs 1..k, relative to the first date. A missing pair makes later
    cumulative values missing for that pixel (never interpolated).
  - **Time:** ISO 8601 dates (UTC). Fit time t = (date − 2026-01-01) / 365.25 days.
  - **App grid:** WGS84 lat/lon, bbox lon −120.60 to −119.40, lat 35.95 to 36.95,
    step 0.01° for real data (samples use 0.02°; read the step from `meta.json`).
  - **App stack:** static site, no backend. MapLibre GL JS for the map. Data loaded as JSON
    from `frontend/public/data/`. Framework and chart library are Avi's choice. Deploy on
    GitHub Pages or Vercel.
  - **File shapes:** `contracts/stack.md`, `contracts/gps.md`, `contracts/app_data.md`.
- **Why:** Lets all four lanes build in parallel from hour 2.
- **Impact per lane:** nisar: write the stack exactly as `contracts/stack.md`. / analysis:
  read the stack and GPS files, write the app files exactly as `contracts/app_data.md`. /
  gps: write `contracts/gps.md` outputs, GPS relative to P304 in LOS. / frontend: build
  against `contracts/samples/`, never against data you invent. / radar: reference the descending
  track to P304 too, same sign and units. / story: legend and pitch name P304 as the
  reference.

## D4: 2026-11-14: Frontend stack is React + Tailwind + Lucide
- **Decision:** The app in `frontend/` is React 19 + Vite, Tailwind CSS v4 and Lucide icons,
  with MapLibre GL JS for the map (refines D3, which left the framework open). Dark theme:
  sinking glows coral, rising glows cyan, gold marks interactive controls. New view: Radar
  fringes (one color cycle = 11.9 cm, half NISAR's L-band wavelength).
- **Why:** The integrator built the first full version so the frontend lane starts from a
  working app instead of a blank page.
- **Impact per lane:** frontend: build on `frontend/src/`, don't restart; next jobs are deploy,
  context layers (H-8) and polish. / analysis: no change, the app reads exactly
  `contracts/app_data.md`. / others: no change.

## D5: 2026-11-14: First real stack: more GPS stations, new demo stations, 1 km cell medians
**Status: proposed by the nisar lane (Pratheek) from the first real results. Ryan confirms
or overrides at the next check-in.** Evidence and numbers: `data/README.md` sections 3–4.
- **Decision:**
  - **Claim and method are unchanged.** NISAR Track 034 / Frame 020, 25 pairs, P304 as the
    reference, sign and units as in D3. The sign is now confirmed against GPS.
  - **Held-out GPS stations: 12 instead of 3.** The stack window holds 14 NGL stations with
    data through the NISAR period. P304 stays the reference. Held out: P294, P297, P298, P300, P302, P303, P307, P725, CAFP, CAFR, CAHA, CAKC, TRAN.
    P302, P303 and P725 are outside the app bbox, so they appear in the residual table but
    not on the app map.
  - **Demo stations: CAFP (Five Points) and CAHA (Hanford), with P300 as the calm
    comparison.** They replace P302 and P307. Why: relative to P304, P302 and P307 move
    only 1.5 and 2.8 cm over the window, about the size of the radar scatter, and NISAR
    does not track them. CAFP and CAHA move 6–7 cm: GPS rises about 1 cm into late winter,
    then sinks to −5 or −6 cm by August, and NISAR follows (correlation 0.81 and 0.71).
  - **Go/no-go (H-5): the measured agreement is about 2 cm per pair, not 1 cm.** RMS over
    single pairs is 1.1–2.9 cm at the 12 stations (raw NGL GPS, data-lane self-check). No
    12 cm unwrapping steps and no drift. Proposed call: **go**, with the uncertainty stated
    as measured. Daniel confirms on cleaned GPS.
  - **App grid cells are medians.** Each 1 km app cell is, for each date, the median of
    the positions (summed chains) of its valid NISAR pixels; the cell's pairs are the
    differences between dates. (A per-pair median breaks the cancellation of each date's
    noise between neighbouring pairs and makes cells drift: analysis-lane tests.) Why: only 49% of single pixels
    are valid in all 25 pairs, and the pixel-level net change has field-shaped patches of
    apparent sinking that are probably soil moisture, not ground motion.
  - **Seasonal significance needs an empirical threshold.** The joint F-test flags a
    "seasonal" signal on bedrock that should not move, so its p-value alone is not enough.
    Calibrate the threshold on stable ground before showing amplitude or timing.
  - **Data-lane processing choices** N1–N8 in `data/README.md` are accepted: wider read
    window, troposphere and solid Earth tide screens applied as well as the ionosphere,
    "sample slip" anomaly pixels kept and flagged, coherence threshold 0.3.
- **Why:** The first real stack shows the claim holds where the ground moves, and that the
  four original stations are too quiet to show it.
- **Impact per lane:** nisar: stack and station table delivered (H-4, H-7, H-11 ready);
  next, a DEM for the troposphere heights and coherence tuning. / analysis: build cells as
  medians, fit per cell, calibrate the seasonal threshold on stable ground, export CAFP,
  CAHA and P300 for the demo. / gps: clean and fit all 13 stations (coordinates in
  `data/processed/stations_ngl.csv`), residual table for the 12 held out, confirm the
  go/no-go. / frontend: demo and tour use CAFP, CAHA and P300 instead of P307 and P302
  (`src/lib/tour.jsx`, `src/story/Story.jsx`); "four stations" wording in
  `src/components/Inspector.jsx`. / radar: unchanged; check the descending track against
  the same 13 stations. / story: 12 held-out stations, not 3; Hanford and Five Points are
  the demo; say "about 2 cm" wherever the pitch states agreement.

## D6: 2026-11-14 16:15: The event is 48 hours; plan rebased at hour 7
**Status: proposed (from the analysis lane, at the team's request). Ryan confirms or overrides
at the hour-8 check-in.** Builds on D5.
- **Decision:**
  - The event runs **48 hours**: hour 0 ≈ Saturday 09:00 PST, hour 48 ≈ Monday 09:00.
    `docs/PLAN.md` is rewritten from hour 7 on.
  - **The extra 24 hours go to the checks first, then to the 48 h extras.** Checks: cleaned GPS at
    all 13 stations, the unwrapping check, the calibrated seasonal threshold, sensitivity
    tests, an early public deploy, two claims reviews and a two-person check of every number.
    Extras now scheduled: polarization, NISAR vs Sentinel-1 coverage, descending track and
    vertical/east, canal and Corcoran levee profiles, historical context (OPERA unfiltered,
    DWR/TRE).
  - **Milestones:** check-ins at hours 8, 12, 28, 34, 38; first real map in the app at 16;
    final labels v1 at 28; data freeze at 34; feature freeze at 38; submit at 44; buffer to 48.
  - **Real-data gate:** the real map loses its "draft" label only when the sign checks out at the
    moving stations, at most 5% of stable control cells pass the seasonal test, and the held-out
    residual table exists.
  - **Sleep:** two 6-hour shifts on night 1 (hours 16–22: Daniel, Avi, Steven; hours 22–28:
    Pratheek, Ismail, Ryan).
  - **New handoffs H-15 to H-20** (canal/levee lines, vertical stack, GPS up, contracts v1.2,
    profile and vertical app files, historical series); see `docs/PLAN.md`.
- **Why:** The plan was written for 24 hours. With 48, cutting checks to add features would
  weaken the one thing the project promises: showing how sure we are.
- **Impact per lane:** nisar: stack on the Drive and go/no-go by hour 10, DEM troposphere, help
  Steven with Track 042 at 28, data freeze at 34. / analysis: first real station numbers now,
  draft map at 16, final labels v1 at 28, profiles and vertical by 34. / radar: report status at
  hour 8; polarization by 16, coverage by 28, vertical by 33. / gps: LOS files and go/no-go by 10,
  13 stations and residuals by 14, canal/levee lines by 16, GPS up by 26, history by 30. /
  frontend: keyless basemap, visible data-fallback warning, D5 demo, public deploy by 16; new
  panels 28–36; feature freeze at 38. / integrator: merge #4–#6 and the plan, confirm D5/D6 at
  hour 8, contracts v1.2 by 14, claims reviews at 28 and 40, submit at 44.

## D7: 2026-11-14 17:35: Go/no-go is GO; stack v2 replaces v1; descending track is a cross-check
**Status: decided by the Integrator (Ryan) at hour ~9.**
- **Decision:**
  - **Go/no-go (H-5): GO.** NISAR vs cleaned GPS in line of sight agrees to **1.7 cm RMS per
    pair** (Daniel, `gps/processed/uncertainty.json`: `sigma_pair_m` = 0.0174, 3 held-out
    stations so far). The data-lane self-check on stack v2 gives **1.2 to 2.2 cm** per station
    at the 13 non-reference stations (`data/processed/qa_summary_t034_f020.csv`). No unwrapping
    errors on either track (the one near-cycle step on Track 042 reverses in the next pair, so
    it is atmosphere: persistence test, `data/README.md`), and no drift. **The original 1 cm
    target was not met; uncertainty is stated as measured, never as "1 cm" or
    "centimetre-level".**
  - **Stack v2 replaces v1.** v2 reads the troposphere, tide and line-of-sight screens at
    terrain height (Copernicus GLO-90; data-lane decision N9) instead of a constant 50 m. Same
    valid-pixel mask as v1. Both are on the Drive; v1 is kept only so running work does not
    break. Every result from now on is from v2.
  - **The descending track (042/070) is processed and on the Drive.** It is noisier (about 3 cm
    RMS per pair against GPS; 1.3 to 5.4 cm per station, `qa_summary_t042_f070.csv`) and has no
    data at CAHA. **Vertical vs east-west is a cross-check, not a headline.**
- **Why:** The measured agreement is the honest number; overstating it would undercut the
  project's promise. v2 removes a height-dependent troposphere error on the hills (fake
  seasonal signal there drops sharply) without changing the valley floor. The descending
  track is too noisy, and misses a demo station, to carry a headline claim.
- **Impact per lane:** nisar: v2 is the stack of record; keep v1 on the Drive until nobody uses
  it; next is coverage (mask tuning, bridging pairs) and the data freeze on v2. / analysis: run
  on v2 with `uncertainty.json`; rerun when Daniel adds stations (σ will change); vertical app
  files are a cross-check, lower priority than the trend guard and final labels. / gps: extend
  cleaned series, residuals and `uncertainty.json` to all held-out stations, CAFP and CAHA
  first; GPS up for the vertical cross-check. / radar: build vertical vs east-west from the
  processed Track 042 stack as a cross-check with GPS up (no CAHA); polarization and coverage
  stay your core results. / frontend: limits panel numbers as in `docs/pitch/limits.md`; no
  "1 cm" anywhere; any vertical view is labelled cross-check. / integrator and story: quote
  1.7 cm (n = 3 held-out stations, rising as Daniel adds stations) and the 1.2–2.2 cm
  self-check; vertical motion never as a headline.

## D8: 2026-11-14 19:20: Radar results go in the app; new contract radar_app.md
**Status: decided by the Integrator (Ryan).**
- **Decision:** Steven's hour-28 polarization and NISAR vs Sentinel-1 coverage results
  (`radar/results/`) are shown in the app: a story section ("The fields") and a Fields layer on the
  live map. `radar/app_export.py` writes three small files to `frontend/public/radar/` in the shape of
  `contracts/radar_app.md`.
- **Numbers shown:** 30 fields, 26 passes, 780 field measurements; median HV/HH alfalfa −7.7 dB,
  almonds −6.1 dB, cotton −7.9 dB. Coverage at median coherence ≥ 0.30: NISAR 542 of 690 field checks
  (78.6%), Sentinel-1 558 of 690 (80.9%), 23 matched pairs.
- **Why:** Polarization is part of the challenge brief, and the coverage comparison is reported
  whatever the result (PROPOSAL §8). The result does not favour NISAR, and the app says so.
- **Impact per lane:** radar: rerun `python3 radar/app_export.py` if the tables change. / frontend:
  reads `public/radar/`. / story: never say NISAR keeps more fields usable over these fields.

## D9: 2026-11-14 21:20: Radar results signed off; final GPS agreement is 1.8 cm at 13 stations
**Status: decided by the Integrator (Ryan).**
- **Decision:**
  - **Radar H-6, H-10, H-13 signed off** (Steven's hour-42 handoff, rows 9–11 of
    `docs/pitch/numbers.md`). Every figure was recomputed from `radar/results/` and matches:
    HV/HH medians −6.1 / −7.7 / −7.9 dB (780 paired observations); coverage 542/690 (78.6%) vs
    558/690 (80.9%); vertical 2.49 cm and east–west 2.52 cm RMS (4 held-out sites each), per-interval
    2.35 cm (213 comparisons, 12 sites) and 2.92 cm (197, 11 sites); descending LOS 2.95 cm (254, 12);
    CAFP shared window 2.5 cm down radar vs 5.7 cm down GPS.
  - **Vertical/east–west stays a cross-check** (D7): project page only, never a headline; Hanford has
    no descending coverage.
  - **Agreement quoted everywhere: 1.8 cm RMS per 12-day pair, 13 held-out stations**
    (`gps/processed/uncertainty.json`: `sigma_pair_m` = 0.0184, `n_stations` = 13). Replaces the
    hour-9 figure of 1.7 cm at n = 3 (D7).
  - **Video wording:** "compares the ground motion with GPS at held-out stations", not "checks every
    result against GPS". GPS checks displacement only; polarization and coverage use radar returns and
    coherence.
  - **Polarization claim limit:** the comparison describes the sampled fields and dates; identifying
    crops from radar alone would need a separate test.
- **Impact per lane:** frontend: agreement figure and field texts updated. / story: new video line;
  quote 1.8 cm (n = 13). / radar: rows 9–11 ticked.

## D10: 2026-11-14 22:05: Contracts v1.2, samples on the D5 stations, public deploy
**Status: decided by the Integrator (Ryan).** Closes H-18.
- **Decision:**
  - **Contracts v1.2** (`contracts/app_data.md`): `demo_stations` in `meta.json` (already written by
    the analysis lane); new optional `canal_profile_<slug>.json` (section 5, the shape `analysis/canal.py`
    already writes) listed in `meta.json` → `canal_profiles`; new optional `vertical/` folder (section 6)
    with the four core files for the vertical cross-check. The four core files keep their shape.
  - **Samples regenerated** (`contracts/samples/`, copied to `frontend/public/samples/`): the 11 D5
    stations inside the bbox at their real NGL positions, P304 reference, CAFP/CAHA sinking and P300
    calm, plus a sample canal profile on the real California Aqueduct line. Every value is still synthetic.
  - **Public deploy:** `.github/workflows/pages.yml` builds `frontend/` and publishes it to GitHub
    Pages on every push to `main`. CI now also checks that the frontend builds.
  - Story wording: "of ground measured", not "of farmland measured" (the measured cells include hills).
- **Impact per lane:** analysis: add `canal_profiles` to `meta.json` when writing profiles; vertical
  run goes to `frontend/public/data/vertical/`. / frontend: read profiles and the vertical folder only
  through these keys; label vertical as a cross-check. / integrator: turn on Pages in repo settings.

## D11: 2026-11-15 10:35: North-east control box stays; east-edge sinking is understated
**Status: decided by the Integrator (Ryan) with the data lane (Pratheek).** Answers
`analysis/REQUESTS.md` Ryan item 5 and Pratheek item 2.
- **Decision:**
  - **Keep the north-east control box** (lat 36.85–36.95, lon −119.5 to −119.4) in
    `seasonal.STABLE_CONTROL_BOXES`. It is stable ground; its apparent seasonal signal and
    +4.3 cm/yr trend are atmospheric error, not motion (details in `data/README.md`). The 18.5 mm
    seasonal bar stays, so the labels in the app do not change.
  - **East edge:** NISAR reads about 2–3 cm less sinking than GPS toward the east edge of the map.
    Sinking there is **understated, not overstated**. The limits panel and `docs/pitch/limits.md` say so.
  - **Still no NISAR-only trend** in the pitch, video or app headline (PROPOSAL §5 rule; NISAR trends
    run about +2 cm/yr less negative than GPS at the held-out stations).
- **Impact per lane:** analysis: nothing to rerun; optionally reword the `meta.json` note so it no
  longer says the north-east box "may raise the bar above what is needed". / frontend: limits text
  updated. / story: any "sinking at the east edge" line says "at least". / nisar: document the box in
  `data/README.md` if not already there.

## D12: 2026-11-15 13:30: Three additions built from data we already have
**Status: decided by the Integrator (Ryan).** No new NISAR processing; no NISAR-only trend anywhere.
- **Hidden sinking view (key 6):** spots that sank beyond 2σ over the record where some pair of dates at
  least 120 days apart shows the ground rising by 1 cm or more: 1,701 of 3,360 sinking spots (51%) on
  stack v3. Seasonal rebound and single-pair noise (about 1.8 cm, D9) both cause it; the legend says so.
- **Motion patterns view (key 7):** unsupervised k-means (k = 5, fixed seed) on each spot's 26-date record,
  run in the browser. Exploratory and descriptive only: it groups shapes and never says why the ground
  moves or whether sinking is permanent. This is the project's only machine-learning component.
- **Before NISAR:** the inspector shows OPERA DISP-S1 Sentinel-1 history (2016–2026) at each GPS station,
  re-referenced to P304 per granule and chained across reference dates
  (`context/history/opera_history.py` → `frontend/public/context/opera_history.json`). Context only,
  labelled as a different satellite and viewing direction, never compared value for value with NISAR.
- **Map loads without the tile server:** the map starts from a local style and adds the street basemap
  only if it answers, so blocked networks (the artifact host, some venues) still get the map.

