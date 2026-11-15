# PROJECT.md: what we're building right now

> **Living document.** This is the single source of truth for the idea. Only the
> Integrator merges changes to it. Every change also gets an entry in `docs/DECISIONS.md`
> and a version bump below. Agents: if anything you were told conflicts with this file, ask.

**Version:** 2 (proposed). **Last updated:** 2026-11-14, proposed by the nisar lane after the first real stack, pending Integrator confirmation (see D5)

## Theme
**Dancing with the SARs** (NASA Space Apps 2026). Project: **The Breathing Ground**.
Pitch theme: *"The ground lies twice a year."*

## Dataset
- **Primary:** NISAR L2 GUNW (geocoded unwrapped interferograms), **provisional**, Track 034
  ascending, Frame 020, ~26 dates, 24 Nov 2025 – 14 Oct 2026. Accessed from ASF (Vertex /
  Earthdata) by HTTPS subset reads. Never mixed with other maturity levels.
- **Independent check:** 13 NGL GPS stations inside the stack window. P304 is the reference.
  Held out (12): P294, P297, P298, P300, P302, P303, P307, P725, CAFP, CAFR, CAHA, CAKC, TRAN.
  Demo stations: CAFP (Five Points) and CAHA (Hanford), with P300 as the calm comparison (D5).
- **Context only:** OPERA DISP-S1 (unfiltered layer), DWR/TRE Altamira InSAR, groundwater
  levels, canals/aqueducts/communities. Full table: `docs/PROPOSAL.md` §3.

## Challenge
- **Name:** Dancing with the SARs (NASA Space Apps 2026).
- **What it asks for:** build an interactive app that uses NISAR radar data to track and
  visualize one or more types of surface change at locations around the world, and explain
  the physical and human drivers, polarization, and future NISAR use.

## Our idea
**One question:** where does seasonal rebound hide continued sinking, and how sure are we?

The San Joaquin Valley "breathes": the ground rises and falls with groundwater each season,
and underneath that rhythm it keeps sinking. Compare the wrong two dates and a sinking area
looks stable. We measure ~11 months of NISAR displacement over Corcoran–Mendota, correct the
ionosphere, check it against held-out GPS, and let anyone click a point to see the
measurement, the fitted seasonal and trend parts, their uncertainty, and whether GPS agrees.

**What the first real stack showed (D5):** at Five Points and Hanford, GPS rises about
1 cm into late winter, then sinks 5–6 cm by August, and NISAR follows. NISAR and GPS agree
to about 2 cm per date, so the app shows where the signal clears that and says so where
it doesn't.

**60-second demo a judge sees:** the Corcoran story → two dates that "look fine" → the full
series reveals the sinking → click a pixel → GPS agrees (or the app says it doesn't).

## Scope
- **Region / time range:** Corcoran–Mendota, San Joaquin Valley, CA. App bounding box
  lon −120.60 to −119.40, lat 35.95 to 36.95 (inside Frame 020, confirmed). The NISAR stack
  is read over a wider window (lon −120.80 to −119.40, lat 35.95 to 37.12) so that P302,
  P303 and P725 are covered; those three are outside the app bbox.
  NISAR window 2025-11-24 to 2026-10-14.
- **In scope (core, 24 h):** net-change map with the 4 labels; click to inspect; GPS reveal
  with residuals; CAFP/CAHA demo (P300 as the calm comparison); amplitude-vs-trend plot;
  limits panel. Everything in
  `docs/PROPOSAL.md` §8 except the canal profile.
- **Proposed additions (confirm at check-in 1; no new data needed, all built from the
  contract files):**
  1. **Pick Two Dates.** User picks any two observation dates; the app shows the naive
     difference next to the net change and fitted trend. Frontend only, from `series.json`.
  2. **Evidence receipts.** Every number links to its granules, corrections, reference
     station and GPS residual. Frontend only, from `meta.json` and `stations.json`.
  3. **Honest styling.** Hatched/faded cells for "Insufficient evidence"; nothing is drawn
     as blank-meaning-zero.
- **48 h only:** descending track, canal profile, NISAR vs Sentinel-1 coverage, historical
  panel (see `docs/PLAN.md`).
- **Out of scope:** elastic/inelastic classification, storage-loss estimates, recharge
  recommendations, other basins, tailings dams, anything in `docs/PROPOSAL.md` §11.

## Contracts (v1)
`contracts/README.md` lists every agreed file shape. Sample files: `contracts/samples/`
(synthetic, marked `"is_synthetic": true`).

## Current lane goals (update at every check-in)
Full hour-by-hour plan: `docs/PLAN.md`.

| Lane | Person | Current goal |
|---|---|---|
| nisar | Pratheek | Done: 25-pair stack, station table, scripts (H-4, H-7, H-11). Next: upload the stack, DEM heights for the troposphere, coherence tuning, help Steven run Track 042 |
| analysis | Ismail | Build 1 km cells as medians of valid pixels, fit per cell, calibrate the seasonal threshold on stable ground, export CAFP/CAHA/P300 for the demo |
| radar | Steven | Find GCOV, descending and Sentinel-1 dates; pick ~30 crop fields; submit HyP3 jobs |
| gps | Daniel | Clean and fit all 13 stations (`data/processed/stations_ngl.csv`), residual table for the 12 held out, confirm the go/no-go at about 2 cm |
| frontend | Avi | Switch the demo and tour to CAFP, CAHA and P300; show 12 held-out stations; then deploy and context layers |
| integrator | Ryan | Confirm D5, make the go/no-go call with Daniel, update the pitch and samples to the new stations |
