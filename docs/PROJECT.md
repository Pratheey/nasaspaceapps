# PROJECT.md: what we're building right now

> **Living document.** This is the single source of truth for the idea. Only the
> Integrator merges changes to it. Every change also gets an entry in `docs/DECISIONS.md`
> and a version bump below. Agents: if anything you were told conflicts with this file, ask.

**Version:** 1. **Last updated:** 2026-11-14 by Integrator (idea chosen, contracts v1, see D2–D3)

## Theme
**Dancing with the SARs** (NASA Space Apps 2026). Project: **The Breathing Ground**.
Pitch theme: *"The ground lies twice a year."*

## Dataset
- **Primary:** NISAR L2 GUNW (geocoded unwrapped interferograms), **provisional**, Track 034
  ascending, Frame 020, ~26 dates, 24 Nov 2025 – 14 Oct 2026. Accessed from ASF (Vertex /
  Earthdata) by HTTPS subset reads. Never mixed with other maturity levels.
- **Independent check:** NGL GPS stations P302, P303, P304, P307.
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

**60-second demo a judge sees:** the Corcoran story → two dates that "look fine" → the full
series reveals the sinking → click a pixel → GPS agrees (or the app says it doesn't).

## Scope
- **Region / time range:** Corcoran–Mendota, San Joaquin Valley, CA. App bounding box
  lon −120.60 to −119.40, lat 35.95 to 36.95 (confirm against Frame 020 coverage at hour 2).
  NISAR window 2025-11-24 to 2026-10-14.
- **In scope (core, 24 h):** net-change map with the 4 labels; click to inspect; GPS reveal
  with residuals; P302/P307 demo; amplitude-vs-trend plot; limits panel. Everything in
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
| nisar | Pratheek | Earthdata login, open one GUNW (Track 034, Frame 020), confirm its layers and the sign convention in D3 |
| analysis | Ismail | Read `contracts/app_data.md`, then write and test the pairwise fit on fake data |
| radar | Steven | Find GCOV, descending and Sentinel-1 dates; pick ~30 crop fields; submit HyP3 jobs |
| gps | Daniel | Download NGL data for P302–P307, send coordinates to Pratheek and Steven (H-1), fix the P307 offset |
| frontend | Avi | App setup (D3 stack) with a basemap over the bbox, load `contracts/samples/` |
| integrator | Ryan | Repo admin, confirm D3 at check-in 1, pitch draft in `docs/pitch/` |
