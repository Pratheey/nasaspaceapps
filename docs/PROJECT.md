# PROJECT.md: what we're building right now

> **Living document.** This is the single source of truth for the idea. Only the
> Integrator merges changes to it. Every change also gets an entry in `docs/DECISIONS.md`
> and a version bump below. Agents: if anything you were told conflicts with this file, ask.

**Version:** 9. **Last updated:** 2026-11-15: Steven's branch reconciliation confirms the fixes were already merged in PR #25 (D13). Earlier: final lane status, hidden-sinking and motion-pattern views, OPERA history, drinking-water wells context (D12); D11 control box.

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
to 1.8 cm RMS per 12-day pair (13 held-out stations, D9; 1.2–2.2 cm in the data-lane
self-check at 13 stations, D7), so the app shows where the signal clears that and says so
where it doesn't.

**60-second demo a judge sees:** the Corcoran story → two dates that "look fine" → the full
series reveals the sinking → click a pixel → GPS agrees (or the app says it doesn't).

## Scope
- **Region / time range:** Corcoran–Mendota, San Joaquin Valley, CA. App bounding box
  lon −120.60 to −119.40, lat 35.95 to 36.95 (inside Frame 020, confirmed). The NISAR stack
  is read over a wider window (lon −120.80 to −119.40, lat 35.95 to 37.12) so that P302,
  P303 and P725 are covered; those three are outside the app bbox.
  NISAR window 2025-11-24 to 2026-10-14.
- **In scope (core):** net-change map with the 4 labels; click to inspect; GPS reveal
  with residuals; CAFP/CAHA demo (P300 as the calm comparison); amplitude-vs-trend plot;
  limits panel. Everything in `docs/PROPOSAL.md` §8.
- **Proposed additions (confirm at check-in 1; no new data needed, all built from the
  contract files):**
  1. **Pick Two Dates.** User picks any two observation dates; the app shows the naive
     difference next to the net change and fitted trend. Frontend only, from `series.json`.
  2. **Evidence receipts.** Every number links to its granules, corrections, reference
     station and GPS residual. Frontend only, from `meta.json` and `stations.json`.
  3. **Honest styling.** Hatched/faded cells for "Insufficient evidence"; nothing is drawn
     as blank-meaning-zero.
- **Now scheduled (48 h event, D6):** polarization panel, NISAR vs Sentinel-1 coverage,
  descending track and vertical/east (a cross-check only, D7), canal and Corcoran levee profiles (screening only),
  historical panel. All after the checks in `docs/PLAN.md` "Rules that stop us cutting corners".
- **Out of scope:** elastic/inelastic classification, storage-loss estimates, recharge
  recommendations, other basins, tailings dams, anything in `docs/PROPOSAL.md` §11.

## Contracts (v1.2)
`contracts/README.md` lists every agreed file shape. Sample files: `contracts/samples/`
(synthetic, marked `"is_synthetic": true`).

## Current lane goals (update at every check-in)
Full hour-by-hour plan: `docs/PLAN.md`.

| Lane | Person | Status at hour ~29 (2026-11-15 13:50) |
|---|---|---|
| nisar | Pratheek | Done: stack v3 frozen, unwrapping persistence check, self-check, OPERA history (H-20), independent check of app numbers. Open: document the control box in `data/README.md` |
| analysis | Ismail | Done: app data on stack v3, trend guard, labels, canal profile, `NUMBERS.md`, second check. Open: reword the meta note on the north-east box (D11) |
| radar | Steven | Done: polarization, coverage vs Sentinel-1, vertical/east cross-check, sign-off (D9), and project bug fixes merged in [PR #25](https://github.com/Pratheey/nasaspaceapps/pull/25). `steven/project-bugfixes` reconciled with main (D13). Optional: vertical app view remains a cross-check, separate from the primary LOS map. |
| gps | Daniel | Done: 13 held-out stations, residuals, uncertainty (σ 1.84 cm per pair), canals. Open: second canal (Delta-Mendota) if a source works |
| frontend | Avi | Open: check the public site on laptop and phone after the last merge |
| integrator | Ryan | Done: contracts v1.2, D2–D12, deploy, AI-use disclosure, README and roles. Open: demo video, number check rows 1–4 and 15–22, submit before 23:59 |
