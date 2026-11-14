# The Breathing Ground: Proposal

> **Agents:** this is the full team proposal, the reference for *what* we build and *what we
> must not claim*. Read all of it before starting work. Your own tasks are in `docs/PLAN.md`.
> If this file and `docs/DECISIONS.md` disagree, the newer decision wins. Ask if unsure.

NASA Space Apps · NISAR surface-change challenge
Study area: Corcoran–Mendota, San Joaquin Valley, California

## Project summary
The Breathing Ground uses NISAR's first year of L-band radar over the San Joaquin Valley to show where the ground rises and falls with the seasons, and where it keeps sinking underneath that cycle. Groundwater pumping lowers water pressure in the aquifer, the sediments compact, and the surface drops. Some of that drop reverses when the water comes back, and some of it doesn't. A comparison between two dates can make a sinking area look stable, or even rising, if both dates happen to fall at the right points in the seasonal cycle. We will measure about eleven months of NISAR displacement over the Corcoran–Mendota area and correct for the ionosphere. We will check the radar against GPS stations that were not used for calibration. The interactive map will let anyone click a location and see the measured motion, the fitted seasonal and trend components, how certain each one is, and whether an independent instrument agrees.

## 1. Claim
See where seasonal rebound hides continued sinking, and inspect the evidence behind every result.

The project measures and displays. It does not classify ground motion as elastic or inelastic, it does not estimate storage loss, and it does not recommend where to recharge.

## 2. Background
The San Joaquin Valley lost about 14 km³ of volume to subsidence between 2006 and 2022, with local rates above 30 cm/yr near El Nido and Corcoran. These are published figures, not our measurements. Pumping lowers groundwater pressure, the sediment skeleton carries more load, and the aquifer system compacts. Part of that compaction reverses when pressure recovers, part is permanent, and clay layers respond with a delay.

Prior work has already separated seasonal and trend components over this valley using Sentinel-1 and GPS (Neely et al. 2021) and has addressed the elastic/inelastic question (Chaussard and Farr 2019). We claim no new method. Our contribution is applying it to new NISAR observations, testing the result against independent GPS, and presenting the evidence and its uncertainty clearly.

## 3. Data

| Source | Role | Notes |
|---|---|---|
| NISAR GUNW, Track 034 ascending, Frame 020 | Primary measurement | 26 dates, 24 Nov 2025 – 14 Oct 2026, about 54 GiB in full. One of the longer provisional time series ASF provides for selected frames. Confirm in Vertex before relying on it |
| NISAR GUNW, Track 042 descending, Frame 070 | Stretch goal: combine with ascending to separate vertical from east–west motion | 28 dates, 1 Nov 2025 – 15 Oct 2026, about 59 GiB |
| GPS stations P302, P303, P304, P307 (Nevada Geodetic Laboratory) | Independent check of displacement | One station sets the reference; the others are held out |
| DWR / TRE Altamira InSAR, 2015 – July 2026 | Historical context | Sentinel-1 based, so not independent of OPERA. Record which release you use |
| OPERA DISP-S1 | Historical context | Use the unfiltered displacement layer. The portal's filtered layer can create false uplift around subsidence bowls |
| Groundwater levels | Explains the mechanism | Not used for validation |
| Canal, aqueduct, community layers | Why it matters | Screening context only |

All NISAR data is provisional and will be replaced by reprocessed validated versions in 2027. Provisional products are never mixed with other maturity levels.

## 4. Physics
**Mechanism: effective stress.** σ′ = σ − p. When pore pressure p falls, the grain skeleton carries more of the load σ and the aquifer system compacts. When pressure recovers, part of that compaction reverses.

**What the radar measures.** NISAR measures displacement along its line of sight (LOS). To compare with GPS, we project the GPS east, north and vertical motion into NISAR's viewing direction. Any vertical-only shortcut is stated and justified.

**Removed from earlier drafts:** depth from bowl width (the Mogi model), aquifer depth inversion, permanent storage-loss estimates, the "inelastic fraction", and "healthy/dying" labels.

## 5. Measurement and model
**Headline observable: net displacement from the first to the last date.** The two dates are about 11 months apart in nearly the same season, so most of the seasonal signal cancels. This measurement needs no model and is the main map.

**Seasonal fit, used only where it is supported.** Fit each pairwise difference directly, so the constant C cancels:

u(tⱼ) − u(tᵢ) = B(tⱼ − tᵢ) + a[sin(2πtⱼ/T) − sin(2πtᵢ/T)] + b[cos(2πtⱼ/T) − cos(2πtᵢ/T)]

where T = 1 year, the seasonal amplitude is A = √(a² + b²), and peak-to-trough motion is 2A.

| Quantity | Label in the app | What it does not show |
|---|---|---|
| Net change | Displacement, first to last date | — |
| A | Size of the fitted seasonal movement | Water volume or aquifer health |
| Peak timing | Month of maximum | Water travel time |
| B | Fitted trend over the window | Permanent compaction |

**Rules:**
- The record is shorter than one year, so trend and seasonal terms trade off against each other. The NISAR-only trend B is reported with its uncertainty and is never the headline.
- Amplitude is biased upward when the data are noisy. A and timing are shown only where a and b together pass a significance test.
- Uncertainty is measured from residuals against the held-out GPS stations, not assumed.

**Labels on the map:**

| Label | Condition |
|---|---|
| Seasonal movement with persistent sinking | Seasonal term significant; net change negative beyond 2σ |
| Seasonal movement, no resolved trend | Seasonal term significant; net change within 2σ |
| Persistent sinking, seasonal component uncertain | Net change negative beyond 2σ; seasonal term not significant |
| Insufficient evidence | Neither significant, or masked |

## 6. Processing
- **Ionosphere.** Apply GUNW's ionospheric phase screen to every pair. L-band is about 18 times more sensitive to the ionosphere than C-band. Left uncorrected, it creates broad ramps across the scene and can leak into the annual term.
- **Reference.** All pairs are referenced to the same stable point or reference GPS station, and the legend names it.
- **Masking.** Mask by coherence and by connected components linked to the reference. A missing measurement stays missing; ploughing breaks coherence even at L-band.
- **Unwrapping check.** The pairs form a simple chain with no loops, so an error in one pair carries into every later date. At L-band one phase cycle equals about 12 cm, so unwrapping errors appear as roughly 12 cm steps. Check each pair against GPS.
- **Subregion reads.** Read only the needed layers and the Corcoran–Mendota window over HTTPS range requests. Do not download 54 GiB at the venue.

## 7. Validation
- Refit GPS over the NISAR window, not calendar 2025.
- Handle the P307 antenna/receiver offset from November 2025 first, because it falls at the start of the NISAR record.
- Use one station as the reference and hold out the others. Report a residual table in line of sight.
- Four stations make a prototype check, not a valley-wide accuracy claim.

**Preliminary GPS context (2025 fits, to be redone):**

| Station | Seasonal amplitude A | Trend |
|---|---|---|
| P302 | 0.47 cm | −0.26 cm/yr |
| P303 | 0.21 cm | −3.48 cm/yr |
| P304 | 0.26 cm | −0.78 cm/yr |
| P307 | 0.46 cm | −5.96 cm/yr |

The seasonal signal is millimetres, not centimetres. NISAR may not resolve it at a single point, and the app will say so where that happens.

## 8. Application
**Demo: P302 and P307.** Animate the measured motion at each, then split it into its seasonal and trend parts. Both stations move with the seasons at about the same amplitude; one is nearly stable, the other is sinking about 6 cm a year. Measured points and the smooth fitted curve are visibly different on screen.

| Element | Purpose |
|---|---|
| NISAR net-displacement map with labels | Shows real new satellite measurements |
| Click to inspect | Observation dates, measured points, fitted curve, uncertainty |
| Amplitude vs trend plot | Separates seasonal movement from persistent sinking |
| GPS reveal | Shows whether an independent instrument agrees, residuals included |
| Canal profile | Movement along a reach, presented as a screening tool for closer inspection |
| Limits panel | What the fit does and doesn't mean |

**Secondary: NISAR vs Sentinel-1 usable coverage.** GUNW coherence against matched Sentinel-1 pairs over a fixed set of fields, with a stated threshold. Differences may come from processing as well as wavelength. Reported whatever the result.

## 9. Answers to the brief
- **Physical drivers:** groundwater pressure acting through effective stress; reversible and delayed components; why our fit alone can't separate them.
- **Polarization:** HH and HV backscatter from GCOV shown per field. Claims are limited to what crop labels confirm.
- **Human drivers:** agricultural pumping.
- **Future NISAR use:** once a full validated annual cycle exists, routine 12-day monitoring of seasonal and persistent motion across agricultural basins.

## 10. Plan (one day; expand if the event runs 48 hours)
Per-person detail is in `docs/PLAN.md`.

| Hours | Deliverable |
|---|---|
| 0–2 | Earthdata access; one real GUNW opened; dates, coverage and ionosphere/connected-component layers confirmed; GPS loaded and refit over the NISAR window |
| 2–6 | Subregion reads; ionosphere applied; referencing; GPS projected to LOS; first pair compared to GPS |
| 6–12 | All pairs; unwrapping check; net-change map; pairwise fit; significance masks; held-out residual table |
| 12–18 | App: map, click to inspect, P302/P307 animation, scatter plot, GPS reveal |
| 18–24 | Verify every displayed number, freeze the data, record the pitch, document sources |

- **If 48 hours:** add the descending track for vertical/east separation, the coverage comparison, the canal profile, and the historical panel.
- **If NISAR fails:** historical Sentinel-1 shows the seasonal pattern; NISAR shows whatever pairs are usable, labelled as such. NISAR stays central, and the gap is stated.

## 11. Claims to avoid
- "Only NISAR can do this." ALOS-2 and SAOCOM also fly L-band.
- "Permanent," "irreversible," or "storage loss" as labels for anything fitted.
- "We validated it" before the residual table exists.
- Mapping amplitude or timing where the seasonal term isn't significant.
- Presenting the 14 km³ or 30 cm/yr figures as our own.

## 12. First hour
1. Earthdata login; open one GUNW from Track 034, Frame 020.
2. Confirm that it covers P302–P307 and contains the ionosphere and connected-component layers.
3. Compare the first pair's displacement at the GPS locations with the GPS change over the same dates, in line of sight. If they agree to within about a centimetre after the ionospheric correction, the project is on.
