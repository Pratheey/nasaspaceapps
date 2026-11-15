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
