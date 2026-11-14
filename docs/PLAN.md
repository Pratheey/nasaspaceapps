# PLAN.md: who does what, hour by hour

**Project:** The Breathing Ground (NISAR, Corcoran–Mendota).
**Format:** 24 hours. The 48-hour extras are at the bottom.

Every deliverable has **one owner**. Nobody edits another person's folder. Work moves
between people only through the **handoffs** below: a file the owner produces and the
next person reads.

## Who owns what

| Person | Lane (`.lane`) | Folder | Load | In one line |
|---|---|---|---|---|
| **Pratheek** | `nisar` | `data/` | Heavy (critical path) | Turns NISAR GUNW into a clean, ionosphere-corrected, referenced stack of pairs |
| **Ismail** | `analysis` | `analysis/`, `frontend/public/data/` | Heavy | Turns that stack into net change, seasonal/trend fits, labels and the app's data files |
| **Daniel** | `gps` | `gps/`, `context/` | Lighter, well-defined | GPS stations as the independent check, plus the context layers |
| **Avi** | `frontend` | `frontend/` (not `public/data/`) | Lighter, well-defined | The interactive map the judges click on |
| **Ryan** | `integrator` | `docs/`, `contracts/`, everything shared | Coordination + story | Repo, contracts, check-ins, pitch, video, the claims review, and verifying every number |

## Handoffs (the only points where people depend on each other)

| # | What | From → To | Where | Due |
|---|---|---|---|---|
| H-1 | GPS station coordinates (P302, P303, P304, P307) | Daniel → Pratheek | `gps/README.md` | hour 1 |
| H-2 | Agreed file formats (stack, GPS outputs, app files), reference station, sign convention | Ryan → everyone | `contracts/`, `docs/DECISIONS.md` | hour 2 |
| H-3 | Fake app data files in the agreed format | Ryan → Avi | `contracts/samples/` | hour 3 |
| H-4 | First pair, corrected and referenced, with values at the 4 stations and the LOS geometry | Pratheek → Daniel | `data/README.md` + shared Drive | hour 4 |
| H-5 | **Go/no-go:** first pair vs GPS in LOS, within ~1 cm? | Daniel + Pratheek → Ryan | `docs/DECISIONS.md` | hour 5 |
| H-6 | Full stack of all pairs | Pratheek → Ismail, Daniel | shared Drive (`data/interim/`, too big for git) | hour 10 |
| H-7 | Held-out residual table, measured uncertainty, list of pairs with ~12 cm steps | Daniel → Ismail, Pratheek | `gps/` | hour 11 |
| H-8 | Real app data files | Ismail → Avi | `frontend/public/data/` | hour 14 |
| H-9 | Context layers (canals, communities, groundwater, historical) | Daniel → Avi | `context/` | hour 10 |
| H-10 | Every number shown in the app or pitch, with its source | Ismail, Daniel, Pratheek → Ryan | `docs/pitch/numbers.md` | hour 19 |

**Team check-ins (15 min, run by Ryan):** hours 2, 6, 12 and 18.
**Feature freeze:** hour 18. **Submit:** hour 22, which leaves 2 hours of buffer.

---

## Pratheek: NISAR data (`data/`)
You're the critical path. If you're blocked, tell Ryan right away.

| Hours | Task | Done when |
|---|---|---|
| 0–1 | Earthdata login. In ASF Vertex, confirm Track 034 ascending, Frame 020 has the ~26 provisional GUNW dates (24 Nov 2025 – 14 Oct 2026). | Date list and granule IDs in `data/README.md` |
| 1–2 | Open **one** GUNW over HTTPS (no full download). List its layers and confirm it has unwrapped phase, the ionospheric phase screen, connected components, coherence and LOS geometry. Confirm it covers the station coordinates from Daniel. | Layer names and units written in `data/README.md` |
| 2–4 | Read only the Corcoran–Mendota window for the first pair. Apply the ionosphere screen, mask by coherence and by connected components linked to the reference, reference to the agreed station, and convert phase to LOS metres using the agreed sign. | **H-4** sent to Daniel |
| 4–5 | Go/no-go with Daniel. If the result is off, check the sign, the units (one cycle ≈ 12 cm) and the reference. | **H-5** recorded |
| 5–10 | Script the same steps for every pair and build the full stack (subset reads only, never the 54 GiB). | **H-6**: stack on Drive, documented in `data/README.md` |
| 10–12 | Fix the pairs Daniel flags as ~12 cm unwrapping steps (correct by whole cycles or mask them; never guess). Re-export the stack. | Updated stack and a note on what was changed |
| 12–16 | Polarization answer for the brief: HH and HV backscatter from GCOV for a few fields with known crop labels. Re-run anything Ismail needs. | Small CSV + short note for Ryan |
| 16–18 | Data freeze. Record exact granule IDs, versions and "provisional" status. | `data/README.md` final |
| 18–22 | Check that 3 random pixels and the 4 stations in the app match your stack. Send your numbers for H-10. | Values in `docs/pitch/numbers.md` (send them to Ryan) |
| 22–24 | Buffer. Fixes only. | |

## Ismail: measurement and model (`analysis/`)
You turn measurements into what the app shows. Follow sections 5 and 7 of the proposal exactly.

| Hours | Task | Done when |
|---|---|---|
| 0–2 | With Ryan, agree on the stack format and the app file formats (H-2). Write the pairwise fit, u(tⱼ) − u(tᵢ) = B·Δt + a·Δsin + b·Δcos, and check it on a fake series with known B, a and b. | The fit recovers the known values |
| 2–6 | Add net change (first to last date, with missing staying missing), uncertainties for B, a and b, the joint significance test on (a, b), A = √(a² + b²), the peak month, and the 4 map labels. Test on a small fake stack. | All 4 labels appear correctly on fake data |
| 6–10 | Run on the real pairs as Pratheek produces them. Make a draft net-change map and the series at P302 and P307. | Draft map image shared at the hour-6 check-in |
| 10–12 | Plug in Daniel's measured uncertainty (H-7) for the 2σ test, drop the flagged pairs from the fit, and hide A and timing where they aren't significant. | Final labels |
| 12–14 | Export the app files in the agreed format: net-change grid, label grid, per-pixel series and fits, station data. | **H-8** delivered to Avi |
| 14–18 | Data for the amplitude-vs-trend plot and the station fits for the P302/P307 demo. Fix anything Avi finds. | Avi's app runs on real data |
| 18–22 | Send every number the app or pitch shows, with its source (H-10). | Ryan signs off |
| 22–24 | Buffer. Fixes only. | |

## Daniel: GPS validation and context (`gps/`, `context/`)
Clear, well-defined tasks, and the proof that the radar is right.

| Hours | Task | Done when |
|---|---|---|
| 0–1 | Download the NGL time series for P302, P303, P304 and P307, plus the NGL steps file. Send the station coordinates to Pratheek. | **H-1** |
| 1–2 | Find and remove the P307 antenna/receiver offset from November 2025. | P307 series without the jump, with a before/after plot |
| 2–4 | Refit every station over **the NISAR window** (not calendar 2025): seasonal amplitude and trend, with uncertainties. | Table that replaces the "preliminary 2025" one |
| 4–5 | Project each station's east, north and up motion into NISAR's line of sight using Pratheek's geometry. Compare it with his first pair, referenced to the same station. | **H-5** go/no-go with Pratheek |
| 5–10 | Context layers, kept small and clipped to the study area: canals and aqueducts, communities, groundwater levels, and OPERA DISP-S1 (**unfiltered** layer) and DWR/TRE for historical context. Write down each source and release. | **H-9** in `context/` with a README |
| 10–12 | Held-out residual table in LOS, for every pair and for the net change. Flag pairs off by ~12 cm (unwrapping). Report the measured uncertainty. | **H-7** delivered |
| 12–16 | GPS series for the app in the agreed format (P302 and P307 for the demo, every station for the GPS reveal). Help Avi wire them in. | GPS shows in the app |
| 16–18 | Re-run the residual table on Pratheek's final stack. | Final table |
| 18–22 | Send GPS numbers (H-10). Write the note that 4 stations make a prototype check, not a valley-wide accuracy claim, for Ryan's limits text. | Ryan signs off |
| 22–24 | Buffer. Fixes only. | |

## Avi: the app (`frontend/`)
You build against Ryan's fake files first, so you're never waiting on data.

| Hours | Task | Done when |
|---|---|---|
| 0–2 | Set up the app (the stack is decided at H-2; a static site with a map library is the suggestion) with a basemap over Corcoran–Mendota. | Map runs locally |
| 2–6 | Using the fake files (H-3): the net-displacement map, colored labels, and a legend that names the reference station and the "provisional NISAR" status. | Map shows all 4 labels |
| 6–10 | Click to inspect: observation dates, measured points, the fitted curve, uncertainty, and "seasonal term not significant here" where that's true. | Clicking any pixel works |
| 10–12 | GPS stations on the map and a "GPS reveal" toggle that overlays GPS and shows residuals. | Toggle works on the fake files |
| 12–14 | Switch to Ismail's real files (H-8). | Real data on screen |
| 14–16 | The P302/P307 demo: animate the measured motion at each, then split it into seasonal and trend parts. | Demo runs start to finish |
| 16–18 | Amplitude-vs-trend plot, the limits panel (text from Ryan), and the context layers from Daniel (H-9). | **Feature freeze** |
| 18–20 | Deploy a public link (GitHub Pages or Vercel) and test it on a laptop and a phone. | Link works for the judges |
| 20–24 | Fixes only. Help Ryan record the demo. | |

## Ryan: integrator, story and pitch (`docs/`, `contracts/`)
You keep everyone unblocked and own what the judges read and hear.

| Hours | Task | Done when |
|---|---|---|
| 0–1 | Add collaborators, protect `main`, create a shared Drive folder for big files, and check that everyone has set `.lane`. Fill in `docs/PROJECT.md` from `docs/PROPOSAL.md`. | Everyone can push branches |
| 1–2 | 15-minute contracts meeting. Write the formats in `contracts/`, and record in `docs/DECISIONS.md`: the reference station (one station; the rest held out), the LOS sign convention, metres vs cm, and the app's stack. | **H-2**, check-in 1 |
| 2–3 | Hand-make small fake app files in the agreed format for Avi. | **H-3** |
| 3–6 | Turn this plan into GitHub issues, one per task. Merge PRs. Run the go/no-go at hour 5 and record the result. | Board live, **H-5** logged |
| 6 | Check-in 2: demos from `main`, update lane goals in `PROJECT.md`. | |
| 6–12 | Pitch outline. Answers to the brief (physical drivers, polarization from Pratheek, human drivers, future NISAR use). | `docs/pitch/pitch.md` draft |
| 12 | Check-in 3: is real data running end to end? If not, apply the fallback below. | |
| 12–18 | Limits panel text for Avi. Review the app and pitch against "Claims to avoid". Video script. | Text delivered, claims review done |
| 18 | Check-in 4: **feature freeze**. | |
| 18–22 | Collect every number (H-10) into `docs/pitch/numbers.md` and check each against its source. Record the video. Write the submission text. | Video + submission ready |
| 22 | **Submit.** | |
| 22–24 | Buffer. | |

---

## If NISAR fails at the hour-5 go/no-go
Ryan records it in `docs/DECISIONS.md`. Then:
- Daniel's historical Sentinel-1 / OPERA layer shows the seasonal pattern.
- Pratheek keeps whatever NISAR pairs are usable, labelled as such.
- NISAR stays central, and the pitch states the gap.

Nobody else's tasks change.

## If the event runs 48 hours
| Person | Extra |
|---|---|
| Pratheek | Descending Track 042, Frame 070 stack, combined with ascending to separate vertical from east–west motion (with Ismail) |
| Ismail | Vertical/east separation, the NISAR vs Sentinel-1 coverage comparison (fixed fields, stated threshold, reported whatever the result), and the canal profile data |
| Daniel | Historical panel data (OPERA / DWR series at the stations and along the canal) |
| Avi | Canal profile view and historical panel in the app |
| Ryan | Pitch polish, a second video take, judge Q&A prep |

## How this avoids merge conflicts
- Each person's agent can only edit their own folder. The lane hook enforces this.
- Every handoff is a file one person writes and others only read.
- Only Ryan edits `docs/`, `contracts/` and root files. Others send him text, or open a PR he merges.
- Big files (the GUNW stack) go on the shared Drive, never in git.
