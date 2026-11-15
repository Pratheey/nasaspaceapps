# PLAN.md: who does what, hour by hour (48 hours)

**Project:** The Breathing Ground (NISAR, Corcoran–Mendota). **Team:** 6 people.
**Format: 48 hours (D6).** Hour 0 ≈ Saturday 09:00 PST, hour 24 ≈ Sunday 09:00, hour 48 ≈
Monday 09:00. If the real start time differs, shift every hour below by the same amount.

> **Rebased at hour 7 (D6, proposed).** The first version of this plan was written for 24 hours.
> With 48 we do **not** add scope by cutting checks: the extra time goes first to the checks
> (cleaned GPS at 13 stations, unwrapping check, calibrated significance, independent number
> review, early deploy, sleep), then to the extras the proposal reserved for 48 hours
> (descending track and vertical motion, NISAR vs Sentinel-1 coverage, canal and levee
> profiles, historical context). D5 (13 GPS stations, CAFP/CAHA/P300 demo, 1 km cell
> medians, calibrated seasonal threshold) is assumed throughout.

Every deliverable has **one owner**. Nobody edits another person's folder. Work moves between
people only through the **handoffs** below: a file the owner produces and others only read.

## Where we are at hour 7

| Lane | Person | Done | Open |
|---|---|---|---|
| nisar | Pratheek | 25-pair stack built (424 MB), station values at 14 stations, scripts ready for another track, D5 proposal; pipeline merged to `main` | Stack not on the Drive yet; no DEM for the troposphere; no unwrapping check against cleaned GPS |
| analysis | Ismail | Fit, calibrated significance, labels, cell medians, `stations.json`, canal profile, vertical input; 39 tests; PR #4 | No run on real data yet |
| gps | Daniel | Coordinates and cleaned ENU for P302, P303, P304, P307; P307 offset handled; PR #6 | No LOS files, fits, residuals or uncertainty yet; 4 of 13 stations |
| radar | Steven | Nothing pushed yet | Polarization (H-6) was due at hour 6 |
| frontend | Avi | (Ryan built the app; it runs on the samples) | Basemap shows "API KEY REQUIRED"; app silently falls back to samples; demo still P302/P307 |
| integrator | Ryan | Contracts v1, samples, the whole frontend v1 | PRs #3–#6 open, D5 unconfirmed, no issue board |

## Milestones

| Hour | Clock (≈) | What |
|---|---|---|
| **8** | Sat 17:00 | **Check-in.** Every lane reports status; Ryan merges #4, #5, #6, closes #3, confirms D5 and D6 |
| 10 | Sat 19:00 | **Go/no-go confirmed on cleaned GPS** (H-5). Stack on the Drive (H-7) |
| **12** | Sat 21:00 | Check-in |
| 16 | Sun 01:00 | **First real map in the app** (draft H-12). App deployed to a public link (on samples is fine) |
| 16–28 | night 1 | **Sleep in two shifts** (see "Sleep" below) |
| **28** | Sun 13:00 | Check-in. Final labels v1 on real data |
| **34** | Sun 19:00 | Check-in. **Data freeze**: exact granules, versions, stack v-final |
| **38** | Sun 23:00 | Check-in. **Feature freeze** |
| 38–42 | | **Two-person number check** (H-14): every number checked by someone who didn't make it |
| **44** | Mon 05:00 | **Submit** |
| 44–48 | | Buffer. Fixes only, resubmit if allowed |

## Rules that stop us cutting corners
1. **Receiver checks every handoff within 1 hour** and replies "received, checked" or says what's wrong. A file nobody opened is not delivered.
2. **Real-data gate.** The real map goes in the app only when (a) NISAR correlates positively with GPS at the moving stations (sign), (b) ≤ 5% of stable control cells pass the seasonal test (calibration), and (c) the held-out residual table exists (H-9). Until then it is labelled "draft".
3. **No "validated"** anywhere until H-9 exists; then quote n = 12 held-out stations and the measured RMS.
4. **Two-person rule** for every number in the app, pitch or video (H-14): producer + one other person.
5. **After the data freeze (hour 34)** reruns only to fix bugs, each one logged in `docs/DECISIONS.md`.
6. **Deploy early** (hour 16) and redeploy often. Never demo only from a laptop.
7. **Claims review** against `docs/PROPOSAL.md` §11 twice: hour 28 and hour 40.
8. **Sleep.** Everyone gets one 6-hour block on night 1. Tired people make the mistakes the checks exist for.

## Sleep (night 1)
| Block | Hours | Who | Why this split |
|---|---|---|---|
| A | 16–22 | Daniel, Avi, Steven | Their next inputs (stack v2, real app files, descending scripts) arrive later in the night |
| B | 22–28 | Pratheek, Ismail, Ryan | They finish the first real map before sleeping; block A is back to check it |

Post "sleeping until hour X" in chat. Night 2 is short: everyone not holding the submission gets at least 3 hours between hours 40 and 48.

## Handoffs

| # | What | From → To | Where | Due (hour) |
|---|---|---|---|---|
| H-1 | GPS station coordinates, **13 stations** (D5) with roles | Daniel → all | `gps/processed/stations.csv` | 4 done; **13 by 12** |
| H-2 | Contracts v1, reference, sign, units | Ryan → all | `contracts/` | done |
| H-3 | Fake app files | Ryan → Avi | `contracts/samples/` | done; **regenerate with D5 stations by 12** |
| H-4 | Pair values at every station + LOS geometry | Pratheek → Daniel | `data/processed/station_values_t034_f020.csv` | done |
| H-5 | **Go/no-go on cleaned GPS** in LOS | Daniel + Pratheek → Ryan | `docs/DECISIONS.md` | **10** |
| H-6 | Polarization result (HH/HV per field and crop type) | Steven → Ryan | `radar/` | **16** (was 6) |
| H-7 | Full stack on the Drive | Pratheek → Ismail, Daniel, Steven | Drive `data/interim/` | **10** |
| H-8 | Context layers (communities, groundwater, OPERA unfiltered, DWR/TRE) | Daniel → Avi | `context/` | 26 |
| H-9 | Residual table (12 held out, per pair and net), `uncertainty.json`, flagged ~12 cm pairs | Daniel → Ismail, Pratheek | `gps/processed/` | **14** |
| H-10 | NISAR vs Sentinel-1 coverage comparison | Steven → Ryan | `radar/` | 28 |
| H-11 | Pratheek's scripts runnable for another track | Pratheek → Steven | `data/README.md` §5 | done |
| H-12 | Real app files: **draft 16**, final labels v1 **28**, frozen **34** | Ismail → Avi | `frontend/public/data/` | 16 / 28 / 34 |
| H-13 | Vertical vs east–west, checked against GPS | Steven → Ryan | `radar/` | 33 |
| H-14 | Every number with its source, checked by a second person | everyone → Ryan | `docs/pitch/numbers.md` | 38–42 |
| H-15 | **New.** Canal and Corcoran levee centre lines (GeoJSON, lon/lat, source + release) | Daniel → Ismail | `context/` | 18 |
| H-16 | **New.** Vertical stack in `contracts/stack.md` shape (`up_disp_m`; spec in `analysis/REQUESTS.md`) | Steven → Ismail | Drive | 33 |
| H-17 | **New.** GPS up series and fits (`component = up`) | Daniel → Steven, Ismail | `gps/processed/` | 26 |
| H-18 | **New.** Contracts v1.2: canal/levee profile file, vertical app files, `demo_stations` | Ryan → Ismail, Avi | `contracts/` | 14 |
| H-19 | **New.** Canal + levee profiles (32), vertical app files (34) | Ismail → Avi | `frontend/public/data/` | 32 / 34 |
| H-20 | **New.** Historical context series (OPERA unfiltered, DWR/TRE) at stations and along the canal | Daniel → Avi | `context/` | 30 |

---

## Pratheek: NISAR data, ascending track (`data/`)
Still the critical path until the stack is on the Drive.

| Hours | Task | Done when |
|---|---|---|
| 7–10 | Upload the stack to the Drive (**H-7**). Tell Ismail whether `valid` already excludes `anomaly` pixels, and confirm the stable control boxes in `analysis/seasonal.py`. Give Daniel the LOS vectors he needs (they are in `station_values_t034_f020.csv`). | Ismail has opened the stack |
| 10–14 | **Go/no-go with Daniel on cleaned GPS (H-5).** Unwrapping check: any pair with a ~12 cm residual at the held-out stations is corrected by whole cycles or masked, never guessed. | H-5 recorded; flagged pairs listed |
| 14–22 | DEM heights for the troposphere screens (hill stations P294, P297, P298, P725). Tune the coherence mask if farmland drops out. Re-export as stack v2 **only if the numbers change**, with a changelog line. | Stack v2 (or "no change") on the Drive |
| 22–28 | Sleep (block B). | |
| 28–32 | Walk Steven through Track 042 with your scripts. Recover masked areas with better unwrapping where it is safe. | Steven's first descending pair processed |
| 32–34 | **Data freeze:** exact granule IDs, versions, "provisional" status, every correction applied. | `data/README.md` final |
| 34–42 | Check 3 random cells and CAFP/CAHA/P300 in the app against your stack. Second-check Daniel's numbers (H-14). | Ryan signs off |
| 42–48 | Buffer. Fixes only. | |

## Ismail: measurement and model (`analysis/`, `frontend/public/data/`)

| Hours | Task | Done when |
|---|---|---|
| 0–7 | Fit, calibrated significance, labels, cell medians, `stations.json`, canal profile, vertical input (PR #4). | Done |
| 7–10 | **First real numbers:** run the fit on `station_values_t034_f020.csv` (CAFP, CAHA, P300 and all 14 stations). Make the full run fit in memory (process the 1674 × 1620 stack in strips). | Station table shared at the hour-8/12 check-in |
| 10–16 | Full run on the real stack (H-7) → **draft map in the app (H-12 draft)**. Check the real-data gate: bedrock pass rate, sign at moving stations. | Draft map at hour 16, labelled draft |
| 16–22 | Plug in Daniel's σ and flagged pairs (H-9). Compare cell series with Pratheek's station values at every station. Sensitivity: how labels change with the cell valid-fraction and the threshold; write it down. | Final labels v1 ready for hour 28 |
| 22–28 | Sleep (block B). | |
| 28–32 | Canal and Corcoran levee profiles on Daniel's real lines (H-15 → H-19). Amplitude-vs-trend data and CAFP/CAHA/P300 demo fits. | Profiles delivered |
| 32–34 | Rerun everything on the frozen stack. Vertical run as soon as Steven's stack lands (H-16, hour 33), compared with GPS up (H-17). | Frozen files; vertical files delivered or "not ready" stated |
| 34–42 | Every number with its source (H-14); second-check Pratheek's or Daniel's numbers. | Ryan signs off |
| 42–48 | Buffer. Fixes only. | |

## Steven: the other radar products (`radar/`)
Nothing is pushed yet. Report status at the hour-8 check-in. If you're stuck, say so then;
someone will pair with you.

| Hours | Task | Done when |
|---|---|---|
| 7–8 | Earthdata login; GCOV granules, Track 042 dates and matching Sentinel-1 dates found; ~30 fields of 3–4 crop types picked (USDA CDL). **Submit the Sentinel-1 HyP3 jobs now**: the queue is slow. | Lists in `radar/README.md`; jobs submitted |
| 8–16 | **Polarization (H-6):** HH and HV per field and date in dB, HV/HH, by crop type through the season. Claim only what the crop labels confirm. | Chart + 3-sentence note to Ryan |
| 16–22 | Sleep (block A). | |
| 22–28 | **Coverage comparison (H-10):** GUNW coherence vs matched Sentinel-1 coherence on the same fields, with a stated threshold. Report it whatever the result. | Table + chart |
| 28–31 | **Descending track:** Track 042 with Pratheek's scripts (he walks you through at 28), referenced to P304; first pair vs GPS, then the rest. | Descending stack |
| 31–33 | **Vertical vs east (H-13, H-16):** combine with ascending as in `analysis/REQUESTS.md` (nearest dates ≤ 6 days, never interpolated, up positive). Check against GPS up (H-17). | Vertical stack to Ismail; result to Ryan |
| 34–42 | "What this does and doesn't show" note for each result; your numbers (H-14). | Ryan signs off |
| 42–48 | Buffer. | |

If the descending track runs late, polarization and coverage still ship: they answer the brief.

## Daniel: GPS validation and context (`gps/`, `context/`)
The proof that the radar is right.

| Hours | Task | Done when |
|---|---|---|
| 7–10 | Project the 4 cleaned stations into LOS with Pratheek's vectors; write `gps_los.csv` and `gps_fits.csv` (refit over the NISAR window). **Go/no-go with Pratheek (H-5).** | H-5 recorded |
| 10–14 | Extend to all **13 stations** (D5): steps checked and removed; CAFP, CAFR, CAHA, CAKC and TRAN start at 2025-12-06. `residuals.csv` with ~12 cm flags and `uncertainty.json` (**H-9**). | H-9 delivered, Ismail confirms it loads |
| 14–16 | Canal and Corcoran levee centre lines (**H-15**), clipped to the bbox, source and release written down. | Lines in `context/` |
| 16–22 | Sleep (block A). | |
| 22–26 | GPS **up** series and fits for the vertical check (H-17). Context layers (H-8): communities, groundwater levels. | H-17, H-8 |
| 26–30 | Historical context (H-20): OPERA DISP-S1 **unfiltered** layer and DWR/TRE at the stations and along the canal; record each release. | H-20 |
| 30–34 | Rerun the residual table on the frozen stack. | Final table |
| 34–42 | GPS numbers (H-14); second-check Ismail's station numbers. The note: 12 held-out stations in one frame are a prototype check, not a valley-wide accuracy claim. | Ryan signs off |
| 42–48 | Buffer. | |

## Avi: the app (`frontend/`, not `public/data/`)
Ryan built v1; you own it from here.

| Hours | Task | Done when |
|---|---|---|
| 7–10 | Pull `main`, run the app. Replace the basemap with one that needs no API key. Make a partly filled `public/data/` show a visible warning instead of silently using the samples. | No watermark; warning works |
| 10–14 | D5 demo: CAFP and CAHA, with P300 calm, in `src/lib/tour.jsx` and `src/story/Story.jsx`; "four stations" text in `Inspector.jsx`; GPS reveal shows every station in `stations.json`. | Demo runs on the regenerated samples |
| 14–16 | **Deploy a public link** (GitHub Pages or Vercel), on samples. | Link works on a phone |
| 16–22 | Sleep (block A). | |
| 22–28 | Real data in (H-12 draft, then final v1). Fix whatever breaks. | Real map live on the link |
| 28–36 | Canal/levee profile view, vertical toggle, polarization and coverage panels, historical panel (H-19, H-6, H-10, H-20). | Each panel works or is hidden |
| 36–38 | Limits panel text from Ryan; laptop + phone test. | **Feature freeze** |
| 38–48 | Fixes only. Help record the demo. | |

## Ryan: integrator, story and pitch (`docs/`, `contracts/`)

| Hours | Task | Done when |
|---|---|---|
| 7–9 | **Hour-8 check-in.** Merge #4, #5 (D5), #6 and this plan (D6); close #3; get status from Steven and Avi. | `main` current, everyone synced |
| 9–14 | Contracts v1.2 (H-18): canal/levee profile file, vertical app files, `demo_stations`. Regenerate `contracts/samples/` with the D5 stations. GitHub issue per task in this plan. | Board live |
| 14–22 | Pitch outline; answers to the brief (physical drivers, polarization H-6, human drivers, future NISAR use). | `docs/pitch/pitch.md` draft |
| 22–28 | Sleep (block B). | |
| 28 | Check-in. **Claims review 1** of the app and pitch against PROPOSAL §11. | |
| 28–34 | Limits panel text; video script; decide what of H-10/H-13/H-20 goes in the pitch. | Text to Avi |
| 34–38 | Check-ins at 34 (data freeze) and 38 (feature freeze). | |
| 38–42 | Collect H-14 in `docs/pitch/numbers.md` with the two-person check. **Claims review 2.** Record the video. | Video + numbers |
| 42–44 | Write and **submit** at hour 44. | Submitted |
| 44–48 | Buffer; judge Q&A prep. | |

---

## If the real-data gate fails
Ryan records it in `docs/DECISIONS.md`. The map still shows NISAR net change, labelled as such;
seasonal labels are switched off where the calibration fails; OPERA/DWR history (H-20) shows the
seasonal pattern as context. NISAR stays central and the pitch states the gap.

## Still out of scope (PROPOSAL §11)
Elastic/inelastic classification, storage-loss estimates, recharge recommendations, damage or
capacity claims from the canal/levee profiles, crop claims beyond what the labels confirm,
"only NISAR can do this", other basins.

## How this avoids merge conflicts
- Each person's agent edits only their own folder. The lane hook enforces this.
- Every handoff is a file one person writes and others only read.
- Steven *runs* Pratheek's scripts but never edits them.
- Only Ryan merges `docs/`, `contracts/` and root files.
- Big files go on the shared Drive, never in git.