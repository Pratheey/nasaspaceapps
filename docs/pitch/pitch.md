# Pitch: The Breathing Ground

**Theme:** *The ground lies twice a year.*
**Closing line:** *We don't tell you the ground is fine. We show you how sure we are.*

## 30-second video script (~72 words)
Record the voiceover first, then cut the visuals to it. Real NISAR map and real GPS curves
only: no mockups, no synthetic sample data on screen.

| Time | On screen | Voiceover |
|---|---|---|
| 0–6 s | Corcoran levee, flood water against it | "This levee in Corcoran, California keeps getting rebuilt. It keeps sinking." |
| 6–13 s | Pick Two Dates: two dates side by side, ground looks stable | "Compare two satellite dates and the ground looks fine." |
| 13–20 s | Full NISAR series plays; breathing map pulses, sinking shown underneath | "But the valley breathes with the seasons, and the breathing hides the sinking." |
| 20–26 s | Click a pixel: measured points, fitted curve, GPS overlay, uncertainty | "The Breathing Ground uses NISAR radar to separate them, and checks every result against GPS." |
| 26–30 s | Title card | "We don't tell you the ground is fine. We show you how sure we are." |

**Fill after real data (hour 18):** pick the two "fine-looking" dates from the real
date-pair results. Candidate from the first stack (D5): Hanford (CAHA), 2025-12-06 to
2026-02-04, where GPS and NISAR both show a rise of about 1 cm while the full record ends
near −5 cm in GPS. If the real data doesn't show a misleading pair at a significant level,
change line 2 to what the data does show. Never stage it.

## Story beats for the project page
1. **Corcoran.** The town's flood levee was built at 195 ft in 1983, sank to 188 ft by 2017,
   was rebuilt to 192 ft, and was back to 188 ft by 2023 (SJV Water, 2023). The
   Friant-Kern Canal has lost up to 60% of capacity in its sinking reach (Maven's Notebook
   summary of the 2026 SJV Conveyance Study; Ag Alert 2025).
2. **The twist.** The valley rises in wet months and drops in dry ones. Two dates can make
   sinking ground look stable.
3. **What we built.** NISAR's first year, ionosphere-corrected, checked against GPS stations
   held out from calibration, with every number's evidence one click away.
4. **Why it matters.** California's groundwater law (SGMA) treats subsidence from pumping as
   an undesirable result that local agencies must monitor.
5. **Future.** With a full validated annual cycle (reprocessed NISAR, 2027), routine 12-day
   monitoring of seasonal and persistent motion in every pumped farm basin.

All figures in beat 1 and 4 are published figures, not our measurements. Say so on screen.

## Answers to the brief (draft, fill the brackets)
- **Physical drivers.** Pumping lowers pore pressure p, so effective stress σ′ = σ − p rises
  and the aquifer system compacts. Part reverses when pressure recovers (the breathing),
  part does not, and clay layers lag. Our fit separates a seasonal term from a trend over
  ~11 months; it cannot by itself say which compaction is permanent.
- **Polarization.** [Steven's HH/HV result from GCOV (H-6) for fields with known crop labels.
  Only claim what the crop labels confirm.]
- **Human drivers.** Agricultural groundwater pumping, worst when surface deliveries drop.
- **Future NISAR use.** As above (beat 5). Next basins: Punjab, Mexico City, Tehran.

## Claims review (Ryan signs off at hour 18, before recording)
- [ ] No "only NISAR can do this" (ALOS-2, SAOCOM also fly L-band).
- [ ] No "permanent", "irreversible" or "storage loss" on anything fitted.
- [ ] No "validated" unless the held-out residual table exists; then quote the measured agreement with its n (D7: 1.7 cm RMS per pair, n = 3 held-out stations so far; 1.2–2.2 cm in the 13-station self-check). Never "1 cm" or "centimetre-level".
- [ ] Vertical vs east-west motion (descending track) only as a cross-check, never a headline (D7).
- [ ] No amplitude or timing shown where the seasonal term isn't significant.
- [ ] 14 km³, 30 cm/yr, levee and canal figures labelled as published, with source.
- [ ] Reference station (P304) and "provisional NISAR" named on the map legend.
- [ ] No synthetic sample data anywhere in the app, video or screenshots.
- [ ] Every number on screen is in `numbers.md` with its source.
