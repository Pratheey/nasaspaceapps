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
