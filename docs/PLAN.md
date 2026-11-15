# PLAN.md: who does what, hour by hour

**Project:** The Breathing Ground (NISAR, Corcoran–Mendota).
**Team:** 6 people. **Format:** 24 hours. The 48-hour extras are at the bottom.

> **Updated by D5 (proposed, 2026-11-14).** The first real stack is done. The check now uses
> 13 GPS stations (P304 reference, 12 held out), the demo stations are CAFP and CAHA with
> P300 as the calm comparison, and app cells are medians of pixels. Rows changed by D5 are
> marked **(D5)**. Evidence: `data/README.md` section 4.

Every deliverable has **one owner**. Nobody edits another person's folder. Work moves
between people only through the **handoffs** below: a file the owner produces and others
only read.

## Who owns what

| Person | Lane (`.lane`) | Folder | Load | In one line |
|---|---|---|---|---|
| **Pratheek** | `nisar` | `data/` | Heavy (critical path) | Turns the ascending NISAR GUNW into a clean, ionosphere-corrected, referenced stack of pairs |
| **Ismail** | `analysis` | `analysis/`, `frontend/public/data/` | Heavy | Turns that stack into net change, seasonal/trend fits, labels and the app's data files |
| **Steven** | `radar` | `radar/` | Heavy | The other radar products: GCOV polarization, the NISAR vs Sentinel-1 coverage comparison, and the descending track for vertical/east separation |
| **Daniel** | `gps` | `gps/`, `context/` | Lighter, well-defined | GPS stations as the independent check, plus the context layers |
| **Avi** | `frontend` | `frontend/` (not `public/data/`) | Lighter, well-defined | The interactive map the judges click on |
| **Ryan** | `integrator` | `docs/`, `contracts/`, everything shared | Coordination + story | Repo, contracts, check-ins, pitch, video, the claims review, and verifying every number |

## Handoffs (the only points where people depend on each other)

| # | What | From → To | Where | Due |
|---|---|---|---|---|
| H-1 | GPS station coordinates. **(D5)** 14 stations, already in `data/processed/stations_ngl.csv`; Daniel copies them to `gps/processed/stations.csv` with roles | Daniel → Pratheek, Steven | `gps/processed/stations.csv` | done / hour 1 |
| H-2 | Agreed file formats (stack, GPS outputs, app files), reference station, sign convention | Ryan → everyone | `contracts/`, `docs/DECISIONS.md` | hour 2 |
| H-3 | Fake app data files in the agreed format | Ryan → Avi | `contracts/samples/` | hour 3 |
| H-4 | First pair, corrected and referenced, with values at the stations and the LOS geometry. **(D5)** Delivered for all 25 pairs and 14 stations | Pratheek → Daniel | `data/processed/station_values.csv` | done |
| H-5 | **Go/no-go.** **(D5)** Measured: about 2 cm RMS per pair at 12 stations, no 12 cm steps, no drift (self-check on raw GPS). Proposed call: go. Daniel confirms on cleaned GPS | Daniel + Pratheek → Ryan | `docs/DECISIONS.md` | hour 5 |
| H-6 | Polarization result (HH/HV per field and crop type) | Steven → Ryan | `radar/` | hour 6 |
| H-7 | Full stack of all pairs. **(D5)** Built (25 pairs, 424 MB); upload pending | Pratheek → Ismail, Daniel, Steven | shared Drive (`data/interim/`, too big for git) | hour 10 |
| H-8 | Context layers (canals, communities, groundwater, historical) | Daniel → Avi | `context/` | hour 10 |
| H-9 | Held-out residual table for the 12 held-out stations, measured uncertainty, list of pairs with ~12 cm steps | Daniel → Ismail, Pratheek | `gps/` | hour 11 |
| H-10 | NISAR vs Sentinel-1 coverage comparison | Steven → Ryan | `radar/` | hour 11 |
| H-11 | Pratheek's processing scripts runnable with track/frame as inputs (read and run, never edit). **(D5)** Ready: `data/README.md` section 5 | Pratheek → Steven | `data/README.md` | hour 12 |
| H-12 | Real app data files | Ismail → Avi | `frontend/public/data/` | hour 14 |
| H-13 | Vertical vs east–west result (descending + ascending), checked against GPS | Steven → Ryan | `radar/` | hour 18 |
| H-14 | Every number shown in the app or pitch, with its source | Pratheek, Ismail, Steven, Daniel → Ryan | `docs/pitch/numbers.md` | hour 19 |

**Team check-ins (15 min, run by Ryan):** hours 2, 6, 12 and 18.
**Feature freeze:** hour 18. **Submit:** hour 22, which leaves 2 hours of buffer.

---

## Pratheek: NISAR data, ascending track (`data/`)
You're the critical path. If you're blocked, tell Ryan right away.

| Hours | Task | Done when |
|---|---|---|
| 0–1 | Earthdata login. In ASF Vertex, confirm Track 034 ascending, Frame 020 has the ~26 provisional GUNW dates (24 Nov 2025 – 14 Oct 2026). | Date list and granule IDs in `data/README.md` |
| 1–2 | Open **one** GUNW over HTTPS (no full download). List its layers and confirm it has unwrapped phase, the ionospheric phase screen, connected components, coherence and LOS geometry. Confirm it covers the station coordinates from Daniel. | Layer names and units in `data/README.md` |
| 2–4 | Read only the Corcoran–Mendota window for the first pair. Apply the ionosphere screen, mask by coherence and by connected components linked to the reference, reference to the agreed station, and convert phase to LOS metres using the agreed sign. **Write it so the track and frame are inputs**, because Steven reuses it later. | **H-4** sent to Daniel |
| 4–5 | Go/no-go with Daniel. If the result is off, check the sign, the units (one cycle ≈ 12 cm) and the reference. | **H-5** recorded |
| 5–10 | Script the same steps for every pair and build the full stack (subset reads only, never the 54 GiB). | **H-7**: stack on Drive, documented |
| 10–12 | Fix the pairs Daniel flags as ~12 cm unwrapping steps (correct by whole cycles or mask them; never guess). Re-export the stack. Write down how to run your scripts for another track. **(D5)** Also: get a DEM so the troposphere screens use real heights (matters for the hill stations P294, P297, P298, P725). | Updated stack + **H-11** |
| 12–16 | Walk Steven through running your scripts on Track 042. Re-run anything Ismail needs. Tune the coherence mask if too much farmland drops out. | Steven's first descending pair is processed |
| 16–18 | Data freeze. Record exact granule IDs, versions and "provisional" status. | `data/README.md` final |
| 18–22 | Check that 3 random cells and the demo stations (CAFP, CAHA, P300) in the app match your stack. Send your numbers for H-14. | Ryan signs off |
| 22–24 | Buffer. Fixes only. | |

## Ismail: measurement and model (`analysis/`)
You turn measurements into what the app shows. Follow sections 5 and 7 of the proposal exactly.

| Hours | Task | Done when |
|---|---|---|
| 0–2 | With Ryan, agree on the stack format and the app file formats (H-2). Write the pairwise fit, u(tⱼ) − u(tᵢ) = B·Δt + a·Δsin + b·Δcos, and check it on a fake series with known B, a and b. | The fit recovers the known values |
| 2–6 | **(D5)** Build each 1 km app cell as the median, per date, of its valid pixels' positions (each pixel's summed chain), then difference back to pairs; not a per-pair median, which makes cells drift (single pixels: only 49% survive all 25 pairs, and they carry field-shaped soil-moisture patches). Add net change (first to last date, with missing staying missing), uncertainties for B, a and b, the joint significance test on (a, b), A = √(a² + b²), the peak month, and the 4 map labels. Test on a small fake stack. | All 4 labels appear correctly on fake data |
| 6–10 | Run on the real pairs as Pratheek produces them. Make a draft net-change map and the series at CAFP, CAHA and P300. | Draft map shared at the hour-6 check-in |
| 10–12 | Plug in Daniel's measured uncertainty (H-9) for the 2σ test, drop the flagged pairs from the fit, and hide A and timing where they aren't significant. **(D5)** The F-test alone over-fires: it finds a "seasonal" signal on bedrock. Calibrate the amplitude threshold on stable ground (hill cells at the window's north-east and south-west corners) and require both. | Final labels |
| 12–14 | Export the app files in the agreed format: net-change grid, label grid, per-pixel series and fits, station data. | **H-12** delivered to Avi |
| 14–18 | Data for the amplitude-vs-trend plot and the station fits for the CAFP/CAHA demo (P300 as the calm comparison). Fix anything Avi finds. | Avi's app runs on real data |
| 18–22 | Send every number the app or pitch shows, with its source (H-14). | Ryan signs off |
| 22–24 | Buffer. Fixes only. | |

## Steven: the other radar products (`radar/`)
Three self-contained pieces of real radar work that answer parts of the brief the main map
doesn't. You start with products nobody else touches (GCOV, Sentinel-1), so you're never
waiting on anyone early. You reuse Pratheek's scripts later; you never edit them.

| Hours | Task | Done when |
|---|---|---|
| 0–1 | Earthdata login. In ASF Vertex, find: (a) NISAR **GCOV** granules over the study area, (b) the descending Track 042, Frame 070 GUNW dates, (c) Sentinel-1 dates that match NISAR pairs as closely as possible. Pick a **fixed set of ~30 fields** of 3–4 crop types from the USDA Cropland Data Layer. Both the polarization and coverage work use this set. | Date lists + field list in `radar/README.md` |
| 1–2 | Request matched Sentinel-1 interferograms with coherence through ASF HyP3, cropped to the study area. Do this early: the queue takes time. | Jobs submitted |
| 2–5 | GCOV: read only the HH and HV backscatter for your fields (subset reads). Build a per-field, per-date table in dB, including HV/HH. | Table in `radar/` |
| 5–6 | **Polarization result:** how HH and HV differ by crop type and through the season. Claim only what the crop labels confirm. | **H-6**: chart + 3-sentence summary to Ryan |
| 6–11 | **Coverage comparison:** read only the coherence layer from the NISAR GUNW pairs for your fields, and compare with the matched Sentinel-1 coherence. Pick and **state a threshold** (e.g. coherence ≥ 0.3 = usable), then report the % of fields usable per pair for each. Report it whatever the result, and note that differences can come from processing as well as wavelength. | **H-10**: table + chart to Ryan |
| 12–15 | **Descending track:** run Pratheek's scripts (H-11) on Track 042, Frame 070, referenced to the same GPS station. Check the first descending pair against GPS projected into the descending line of sight, using Daniel's cleaned station motion. | First descending pair agrees with GPS (or you know why not) |
| 15–17 | Process the remaining descending pairs needed to cover the same window as ascending. | Descending net change over the window |
| 17–18 | **Vertical vs east–west:** combine the ascending and descending net change where the dates match, and solve for vertical and east motion (north is poorly constrained; state that). Compare with GPS vertical and east at the held-out stations. | **H-13**: result + GPS comparison to Ryan |
| 18–22 | Send your numbers (H-14). Write the short "what this does and doesn't show" note for each of your 3 results. | Ryan signs off |
| 22–24 | Buffer. Fixes only. | |

**If the descending track runs late:** finish the polarization and coverage results first. They're
part of the core submission. The vertical/east result is a bonus in a 24-hour event.

## Daniel: GPS validation and context (`gps/`, `context/`)
Clear, well-defined tasks, and the proof that the radar is right.

| Hours | Task | Done when |
|---|---|---|
| 0–1 | Download the NGL time series for the 14 stations in `data/processed/stations_ngl.csv` (P304 reference; 12 held out; D5), plus the NGL steps file. Write `gps/processed/stations.csv`. | **H-1** |
| 1–2 | Check every station for equipment offsets inside or near the NISAR window and remove them. The P307 change was on 12 Nov 2025, before the first NISAR date. **(D5)** CAFP, CAFR, CAHA, CAKC and TRAN have no solution near 2025-11-24; start their series at 2025-12-06. | Clean series, with a before/after plot where an offset was removed |
| 2–4 | Refit every station over **the NISAR window** (not calendar 2025): seasonal amplitude and trend, with uncertainties. Save the cleaned east/north/up motion so Steven can use it too. | Table that replaces the "preliminary 2025" one |
| 4–5 | Project each station's east, north and up motion into NISAR's line of sight using Pratheek's geometry. Compare it with his first pair, referenced to the same station. | **H-5** go/no-go with Pratheek |
| 5–10 | Context layers, kept small and clipped to the study area: canals and aqueducts, communities, groundwater levels, and OPERA DISP-S1 (**unfiltered** layer) and DWR/TRE for historical context. Write down each source and release. | **H-8** in `context/` with a README |
| 10–12 | Held-out residual table in LOS, for every pair and for the net change. Flag pairs off by ~12 cm (unwrapping). Report the measured uncertainty. | **H-9** delivered |
| 12–16 | GPS series for the app in the agreed format (CAFP, CAHA and P300 for the demo, every station inside the app bbox for the GPS reveal). Help Avi wire them in. | GPS shows in the app |
| 16–18 | Re-run the residual table on Pratheek's final stack. | Final table |
| 18–22 | Send GPS numbers (H-14). Write the note that 12 held-out stations in one frame make a prototype check, not a valley-wide accuracy claim, for Ryan's limits text. | Ryan signs off |
| 22–24 | Buffer. Fixes only. | |

## Avi: the app (`frontend/`)
You build against Ryan's fake files first, so you're never waiting on data.

| Hours | Task | Done when |
|---|---|---|
| 0–2 | Set up the app (the stack is decided at H-2; a static site with a map library is the suggestion) with a basemap over Corcoran–Mendota. | Map runs locally |
| 2–6 | Using the fake files (H-3): the net-displacement map, colored labels, and a legend that names the reference station and the "provisional NISAR" status. | Map shows all 4 labels |
| 6–10 | Click to inspect: observation dates, measured points, the fitted curve, uncertainty, and "seasonal term not significant here" where that's true. | Clicking any pixel works |
| 10–12 | GPS stations on the map and a "GPS reveal" toggle that overlays GPS and shows residuals. | Toggle works on the fake files |
| 12–14 | Switch to Ismail's real files (H-12). | Real data on screen |
| 14–16 | **(D5)** The CAFP/CAHA demo: animate the measured motion at each, then split it into seasonal and trend parts, with P300 as the calm comparison. Replace the hard-coded P307/P302 in `src/lib/tour.jsx` and `src/story/Story.jsx`, and the "four stations" text in `src/components/Inspector.jsx`. | Demo runs start to finish |
| 16–18 | Amplitude-vs-trend plot, the limits panel (text from Ryan), and the context layers from Daniel (H-8). | **Feature freeze** |
| 18–20 | Deploy a public link (GitHub Pages or Vercel) and test it on a laptop and a phone. | Link works for the judges |
| 20–24 | Fixes only. Help Ryan record the demo. | |

## Ryan: integrator, story and pitch (`docs/`, `contracts/`)
You keep everyone unblocked and own what the judges read and hear.

| Hours | Task | Done when |
|---|---|---|
| 0–1 | Add collaborators, protect `main`, create a shared Drive folder for big files, and check that everyone has set `.lane`. Fill in `docs/PROJECT.md` from `docs/PROPOSAL.md`. | Everyone can push branches |
| 1–2 | 15-minute contracts meeting. Write the formats in `contracts/`, and record in `docs/DECISIONS.md`: the reference station (one station; the rest held out), the LOS sign convention, metres vs cm, and the app's stack. | **H-2**, check-in 1 |
| 2–3 | Hand-make small fake app files in the agreed format for Avi. | **H-3** |
| 3–6 | Turn this plan into GitHub issues, one per task. Merge PRs. Run the go/no-go at hour 5 and record the result. **(D5)** Confirm or override D5; regenerate `contracts/samples/` with the new station list. | Board live, **H-5** logged |
| 6 | Check-in 2: demos from `main`, update lane goals in `PROJECT.md`. | |
| 6–12 | Pitch outline. Answers to the brief: physical drivers, polarization (Steven, H-6), human drivers, future NISAR use. Add Steven's coverage comparison (H-10). | `docs/pitch/pitch.md` draft |
| 12 | Check-in 3: is real data running end to end? If not, apply the fallback below. | |
| 12–18 | Limits panel text for Avi. Review the app and pitch against "Claims to avoid". Video script. | Text delivered, claims review done |
| 18 | Check-in 4: **feature freeze**. Decide whether Steven's vertical/east result (H-13) goes in the pitch. | |
| 18–22 | Collect every number (H-14) into `docs/pitch/numbers.md` and check each against its source. Record the video. Write the submission text. | Video + submission ready |
| 22 | **Submit.** | |
| 22–24 | Buffer. | |

---

## If NISAR fails at the hour-5 go/no-go
Ryan records it in `docs/DECISIONS.md`. Then:
- Daniel's historical Sentinel-1 / OPERA layer shows the seasonal pattern.
- Pratheek keeps whatever NISAR pairs are usable, labelled as such.
- NISAR stays central, and the pitch states the gap.

Steven's polarization and coverage work doesn't depend on the go/no-go, so it carries on.

## If the event runs 48 hours
| Person | Extra |
|---|---|
| Pratheek | Recover masked areas with better unwrapping; reprocess with any updated GUNW versions |
| Ismail | Run the seasonal/trend fit on Steven's vertical component; canal profile data |
| Steven | Full descending stack and vertical/east time series (not just net change); extend the coverage comparison to more fields and dates |
| Daniel | Historical panel data (OPERA / DWR series at the stations and along the canal) |
| Avi | Canal profile view, historical panel, vertical/east toggle, and small panels for polarization and coverage |
| Ryan | Pitch polish, a second video take, judge Q&A prep |

## How this avoids merge conflicts
- Each person's agent can only edit their own folder. The lane hook enforces this.
- Every handoff is a file one person writes and others only read.
- Steven *runs* Pratheek's scripts but never edits them. If he needs a change, he asks Pratheek.
- Only Ryan edits `docs/`, `contracts/` and root files. Others send him text, or open a PR he merges.
- Big files (the GUNW stacks) go on the shared Drive, never in git.
