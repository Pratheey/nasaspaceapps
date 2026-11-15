# data/: data dictionary (owned by the nisar lane, Pratheek)

**Rule:** if a dataset isn't documented here, it doesn't exist. Other lanes and their
agents learn the data *only* from this page.

```
data/
├── raw/          git-ignored. Downloads (NGL GPS files, the feasibility bundle)
├── interim/      git-ignored. Per-pair files and the stack; shared through the Drive
├── processed/    small files (< 5 MB), committed for everyone
├── scripts/      everything needed to rebuild interim/ and processed/ from NASA
├── proposals/    changes the data lane proposes to shared files, as patches for Ryan
└── tests/        tests of the processing arithmetic on a synthetic file
```

Status on 2026-11-14: **both tracks are processed with terrain heights (Track 034 ascending, 25 pairs; Track 042 descending, 27 pairs). The current, frozen Track 034 stack is version 3, `interim/stack_t034_f020_v3.nc` (goes on the Drive). Use v3. Version 2 (`interim/stack_t034_f020_v2.nc`, tied to raw NGL GPS) is superseded. Version 1 (constant 50 m height, the file uploaded to the Drive on 14 Nov) is unchanged as `interim/stack_t034_f020.nc`. The Track 042 stack is not on the Drive yet and is still tied to raw NGL P304 (cross-check only). No unwrapping corrections. Read section 4 ("What we found") before using the numbers.**

Shared Drive folder: https://drive.google.com/drive/u/0/folders/152RzXsar-DzAYQNfZgIvnsXe4jqM06Fz (stacks go in its `data/interim` folder).

---

## 1. NISAR L2 GUNW, Track 034 ascending, Frame 020 (primary measurement)

| field | value |
|---|---|
| Product | NISAR L2 GUNW (geocoded unwrapped interferogram), L-band, HH, **provisional** |
| Collection | `NISAR_L2_GUNW_PROVISIONAL_V1`, CMR concept `C2854335566-ASF`, DOI `10.5067/NIL2GUNW-P1` |
| Release | Composite release `P05023`, product version 1.0.11, product specification 1.5.0, software 0.25.16 |
| Access | ASF, HTTPS range requests with an Earthdata login. Nothing is downloaded in full (the 25 granules are about 54 GiB) |
| Pairs | 25 pairs over 26 dates, 2025-11-24 to 2026-10-14, a sequential chain (date i → date i+1). 23 pairs span 12 days; pairs 21 and 25 span 24 days |
| Granule list | [`processed/granules_t034_f020.csv`](processed/granules_t034_f020.csv): pair number, dates, granule ID, CMR concept ID, URL |
| Native grid | UTM zone 11N (EPSG:32611), 80 m pixels, 4284 × 4356. Interferogram multilooked 13 (range) × 16 (azimuth) |
| Geometry | Left-looking, ascending. Acquisitions at about 13:09 UTC. Incidence angle 41.5° (Corcoran) to 45.2° (P302) |
| Wavelength | 0.24196 m (centre frequency 1239 MHz). One phase cycle = 12.1 cm of line-of-sight motion |

### Layers read (all under `/science/LSAR/GUNW/`)

| Layer | Units | Used for |
|---|---|---|
| `grids/frequencyA/unwrappedInterferogram/HH/unwrappedPhase` | radians | The measurement |
| `…/HH/ionospherePhaseScreen` | radians | Subtracted from the phase |
| `…/HH/coherenceMagnitude` | 0–1 | Coherence mask |
| `…/HH/connectedComponents` | integer label, 0 = unreliable, 65535 = fill | Keep only the component that contains the reference station |
| `…/unwrappedInterferogram/mask` | bit field | Water, invalid sub-swath samples, anomaly flags |
| `…/HH/xCoordinates`, `yCoordinates`, `projection` | metres, EPSG code | Grid |
| `metadata/radarGrid/losUnitVectorX`, `losUnitVectorY` | unitless | East and north parts of the unit vector **from the ground to the satellite**; up = √(1 − e² − n²) |
| `metadata/radarGrid/wetTroposphericPhaseScreen`, `hydrostaticTroposphericPhaseScreen` | radians | Subtracted (see "Corrections") |
| `metadata/radarGrid/slantRangeSolidEarthTidesPhase` | radians | Subtracted |

The `radarGrid` layers are cubes: 20 heights (−500 m to 9000 m) on a 500 m grid.

### Quirks
- **The ionosphere is the largest signal in the raw phase.** In pair 1 the screen spans
  about 60 radians across the frame (over 1 m of apparent motion). Uncorrected phase is
  unusable.
- **`mask` bit 24** ("ionosphere screen was interpolated here") is set on most pixels,
  including all four stations. It is not treated as a problem.
- The **static layers** product linked from each granule (DEM, layover/shadow) could not be
  opened with the same login. Terrain height therefore comes from the Copernicus GLO-90 DEM
  (public), moved to the ellipsoid with a constant geoid undulation of -32 m. The
  troposphere, solid Earth tide and line-of-sight cubes are read at that height at each
  pixel. DEM minus GPS station height at 14 stations: median -3.4 m, range -17.5 to +1.2 m.
  DEM heights in the Track 034 window run from -8 to 1558 m (median 55 m). Version 1 of the
  Track 034 stack used a constant 50 m instead (see N9).
- **Anomaly flag ("qFSP-H1 sample slip").** On some dates the product flags a diagonal
  stripe about 25 km wide through the middle of the window (23% of it) as an input-data
  anomaly: `mask` bits 8–23, and `referenceHasInputDataException` /
  `secondaryHasInputDataException` = 2 in the granule. The first date of the record
  (2025-11-24) is one of them. Phase and coherence inside the stripe look normal. Measured
  at the stripe's west edge on pairs 1–3, the phase step is about 1 to 2.5 mm, with the sign
  flipping as expected when the flagged date is the reference or the secondary; at the east
  edge it is under 0.5 mm. Because every cumulative value depends on pair 1, masking the
  stripe would remove it from the whole time series. **Decision by the data lane: keep the
  pixels, record the flag** in the stack's `anomaly` layer and the `anomaly` column of
  `station_values.csv`, and let the analysis choose. `process_pairs.py --mask-anomalies`
  gives the strict version. Pairs 1, 2, 3, 7, 8, 11 and 12 are flagged, which points to the acquisitions of 2025-11-24, 2025-12-18, 2026-02-16 and 2026-04-05.
- Fill values are `NaN` (floats), 65535 (connected components) and 255 (mask).

---

## 2. What the processing does

For each pair, over the window only:

1. **Subset read.** Window lon −120.80 to −119.40, lat 35.95 to 37.12. This is the app
   bbox widened west and north, because P302 (lon −120.619) and P303 (lat 37.054,
   lon −120.705) are outside the app bbox. On the native grid the window is 1674 × 1620
   pixels.
2. **Corrections.** `phase − ionosphere screen − wet troposphere − hydrostatic troposphere
   − solid Earth tide`. An ionosphere-only version is kept alongside. The troposphere and
   tide screens (and the line-of-sight vectors) are read at each pixel's terrain height from
   the Copernicus GLO-90 DEM, not at a constant height. `make_dem.py` builds the DEM file
   automatically; `--flat-height` goes back to a constant 50 m.
3. **Mask.** A pixel is valid when all of these hold: coherence ≥ 0.3; a valid sample in
   both images; not water; connected component not 0; and in the same connected component
   as the reference station. Anomaly-flagged pixels are kept and flagged (see below).
4. **Reference.** Subtract the median corrected phase of the valid pixels in a 5 × 5 pixel
   block (400 m) centred on P304. A pair with fewer than 5 usable pixels there fails loudly
   rather than being referenced somewhere else.
5. **Metres.** `los_disp = −λ / (4π) × phase`.
6. **Tie.** Add P304's own GPS line-of-sight motion over the pair's dates to every pixel
   (done in `build_stack.py`, stored per pair as `ref_tie_m` so it can be undone). Versions
   1 and 2 use the raw NGL series; version 3 uses `gps/processed/gps_los.csv` (see section 3).

Masked pixels are `NaN`. Nothing is interpolated or filled.

### Sign convention
Positive = motion **toward the satellite** (for mostly vertical motion, uplift), as in
decision D3. The product's native phase has the opposite sense: the interferogram is
reference × conj(secondary), so a positive phase is a range increase. Hence the minus sign
in step 5. This was derived from how the interferogram is formed, and then confirmed against GPS: at the six stations that move more than the scatter or track well (CAFP, CAHA, TRAN, P300, P725, CAFR), the NISAR running sum correlates with GPS at +0.71 to +0.81. The opposite sign would make those correlations negative.

### Corrections: what is and isn't applied
| Correction | Applied | Evidence |
|---|---|---|
| Ionosphere screen | Yes, every pair | Required by `docs/PROPOSAL.md` §6 |
| Troposphere (wet + hydrostatic, model-based), read at terrain height | Yes | Tested without GPS: over the 25 pairs, the spread of displacement across the window drops from 2.2 cm RMS (ionosphere only) to 1.6 cm at a constant 50 m height (version 1); 17 of 25 pairs improve; applying it with the opposite sign gives 3.9 cm. Against GPS: 1.86 cm RMS with the troposphere and tide screens, 2.69 cm with the ionosphere only (all 12 stations, all pairs) |
| Terrain height for the troposphere, tide and LOS cubes (Copernicus GLO-90) | Yes, version 2 and Track 042 | Tested without GPS on Track 034. Spread of displacement across the window, RMS over the 25 pairs: 1.55 cm with a constant 50 m, 1.40 cm with terrain heights, 1.89 cm with the height term reversed. On hill pixels above 150 m (31% of valid pixels): 1.51 cm, 1.25 cm, 2.04 cm. Regressing the measured signal on the height-dependent part of the wet troposphere screen gives a median coefficient of 0.99 (1 = the screen is right) |
| Solid Earth tides, read at terrain height | Yes | Deterministic; differential effect across the window is ≤ ~3 mm |
| Unwrapping errors | **No pair corrected** | None found: Daniel's residual table (H-9, `gps/processed/residuals.csv`) flags no pair, and the data-lane persistence test agrees |

`docs/PROPOSAL.md` §6 names only the ionosphere. Troposphere and tides are an addition by
the data lane; `build_stack.py --iono-only` produces the stack without them, and
`station_values.csv` carries both versions, so the team can choose.

---

## 3. Outputs

### `interim/stack_t034_f020.nc` (version 1, constant 50 m height; shared Drive, not in git)
### `interim/stack_t034_f020_v2.nc` (version 2, terrain heights, raw NGL tie; superseded by v3)
### `interim/stack_t034_f020_v3.nc` (version 3, **current, frozen**; git-ignored, goes on the Drive)
Exactly `contracts/stack.md` §1, plus these additive extras: `cmr_concept_id`,
`tropo_applied`, `set_applied`, `anomalies_masked`, `ref_tie_m`, `valid_fraction` (all
per pair), the `anomaly` layer (pair, y, x; 1 = flagged), and global
attributes `track`, `frame`, `polarization`, `wavelength_m`, `geometry_height_m`.
`granule_id` is the granule name. 25 pairs, 1674 × 1620 pixels. Valid fraction per pair: 78% to 97%
(all versions). Version 1 is 424 MB, versions 2 and 3 are 426 MB. Anomaly-flagged pixels (about
510,000 per flagged pair) appear in pairs 1, 2, 3, 7, 8, 11 and 12. The global attribute
`notes` of version 2 records that the cubes were read at terrain height.

**Version 3 (data freeze).** Built 2026-11-14, about hour 12 of the event:
`python data/scripts/build_stack.py --track 34 --frame 20 --suffix _v3 --notes "v3 = v2 re-tied to the cleaned P304 series (data freeze)"`.
Its `notes` attribute says the same. The only difference from v2 is the tie to P304
(step 6): v3 uses Daniel's cleaned series `gps/processed/gps_los.csv` (7-day median at each
date) instead of the raw NGL IGS20 `tenv3` file. Same granules (listed in
[`processed/granules_t034_f020.csv`](processed/granules_t034_f020.csv); product, collection and
DOI are in section 1), same per-pair files, same corrections (ionosphere, wet and
hydrostatic troposphere, solid Earth tides, cubes read at Copernicus GLO-90 terrain height),
same masks, coherence threshold 0.3. 25 pairs, 1674 × 1620 pixels. No pair was corrected for
unwrapping errors (none found).

Size of the change from v2: the tie of any single pair changes by at most 3.29 mm, and every
pixel in a pair shifts by the same amount. Summed over all 25 pairs, the net change of every
pixel is +3.2 mm (slightly less sinking) compared with v2. That is small next to the
measured uncertainty (`sigma_net` 1.98 cm, `sigma_pair` 1.84 cm, from
`gps/processed/uncertainty.json`, 13 held-out stations). Values relative to P304 do not
change (the tie cancels), so the comparison with GPS in this section is the same as for v2.
The 17 tests in `data/tests` pass.

Regenerated from v3: `processed/station_values_t034_f020.csv`, `processed/station_values.csv`,
`processed/qa_stations_vs_gps_t034_f020.csv`, `processed/qa_summary_t034_f020.csv`.
v1 and v2 stay on the Drive unchanged. Anyone who ran on v2 should rerun on v3: analysis
(Ismail) reruns the app export, gps (Daniel) reruns the residual table and `uncertainty.json`.
Expected effect: millimetres. The Track 042 stack was not rebuilt (see section 4b).

### `processed/station_values.csv` (in git)
`contracts/stack.md` §2: one row per pair per station. Values are the **median of the valid
pixels in the 3 × 3 block** (240 m) centred on the pixel nearest the station. Extra columns:
`n_valid_px` (0–9), `los_disp_iono_only_m`, `ref_tie_m`, `anomaly` (1 if any pixel of the
block is flagged). `los_disp_m` includes the tie;
subtract `ref_tie_m` to get the value relative to P304. H-4 is the pair-1 rows.

### `processed/stations_ngl.csv`
Coordinates of the 14 NGL stations inside the window that have data through the NISAR
period: P294, P297, P298, P300, P302, P303, P304 (reference), P307, P725, CAFP, CAFR, CAHA,
CAKC, TRAN. Taken from the last epoch of each station's NGL file. Used until
`gps/processed/stations.csv` exists, which then takes over automatically.
`station_values.csv` therefore has rows for all 14 stations, not only the four in the
contract; the extra rows are additive.

### `processed/qa_stations_vs_gps_t034_f020.csv`
The data lane's own check of every pair, and of the running sum, against raw NGL GPS at
the three non-reference stations. **Provisional and not the H-9 residual table.** No number
from it goes in the app or pitch.

### `processed/check_app_vs_stack.csv` (in git)
Output of `scripts/check_app_vs_stack.py`, an independent re-implementation (nothing imported
from `analysis/` or `gps/`) that compares the app files with the frozen v3 stack. Columns:
`check, item, quantity, app_value_m, recomputed_m, diff_mm, tolerance_mm, ok`. Checks: `A` three
random cells, `B_nisar` / `B_gps` / `B_resid` the stations in `stations.json`, `C_*` Daniel's
`residuals.csv` and `uncertainty.json`. Rows named `*_count` hold plain counts (diff and tolerance
are counts, not mm). Rows with an empty `ok` are information only. Tolerance 0.5 mm (the app JSON
is rounded to 0.1 mm).

Result on 2026-11-14, version 3 (terrain heights; same as v2 because the tie cancels), in cm (NISAR minus GPS, both relative to P304, line of sight). "GPS range" is how
far the station moves within the window; "From" is the first date with GPS at that station.
No pair is within 3 cm of a 12 cm step at any station. A flagged pair also gets `near_cycle_persists` (summary column `persistent_cycle_pairs`): 1 if the running-sum residual is still shifted by that many cycles one pair later, as an unwrapping error would leave it, 0 if it reversed, as one-date atmosphere would. Summary file: `processed/qa_summary_t034_f020.csv`.

| Station | Pairs | RMS, single pairs | Worst pair | GPS net | NISAR net | GPS range | RMS, running sum | Correlation | From |
|---|---|---|---|---|---|---|---|---|---|
| CAFP | 24 | 1.9 | 4.0 | −4.4 | −3.4 | 6.7 | 1.8 | 0.81 | 2025-12-06 |
| CAFR | 24 | 1.9 | 4.8 | +1.2 | +5.9 | 1.5 | 2.9 | 0.81 | 2025-12-06 |
| CAHA | 24 | 2.1 | 3.8 | −4.8 | −2.2 | 5.9 | 2.1 | 0.71 | 2025-12-06 |
| CAKC | 24 | 2.2 | 4.7 | +1.6 | +1.2 | 1.7 | 1.4 | 0.29 | 2025-12-06 |
| P294 | 25 | 1.6 | 3.0 | +1.5 | +3.2 | 1.7 | 2.4 | 0.78 | 2025-11-24 |
| P297 | 18 | 1.9 | 3.6 | +0.7 | +1.7 | 1.3 | 2.4 | 0.46 | 2025-11-24 |
| P298 | 25 | 2.1 | 4.2 | +1.6 | +2.4 | 1.8 | 2.1 | 0.75 | 2025-11-24 |
| P300 | 25 | 2.1 | 4.3 | +1.9 | +3.1 | 2.3 | 1.5 | 0.78 | 2025-11-24 |
| P302 | 25 | 1.7 | 3.8 | +1.5 | +2.0 | 2.0 | 1.2 | 0.53 | 2025-11-24 |
| P303 | 25 | 1.8 | 5.2 | −0.7 | −3.2 | 0.9 | 1.6 | −0.19 | 2025-11-24 |
| P307 | 25 | 1.8 | 3.5 | −2.8 | −0.5 | 2.8 | 2.2 | −0.04 | 2025-11-24 |
| P725 | 25 | 1.7 | 4.5 | +1.7 | +2.2 | 2.1 | 2.4 | 0.81 | 2025-11-24 |
| TRAN | 24 | 1.1 | 2.8 | −1.6 | −1.9 | 2.6 | 0.9 | 0.77 | 2025-12-06 |

P297 has 18 valid pairs, so its running sum stops early. P294, P297, P298 and P725 sit 320 to 630 m
above the ellipsoid. Single-pair RMS at the four hill stations P294, P297, P298 and P725 went from
2.2, 2.9, 2.5 and 1.9 cm (version 1, constant 50 m) to 1.6, 1.9, 2.1 and 1.7 cm (version 2, terrain heights).

---

## 4. What we found (read before using the stack)

1. **Single pairs agree with GPS to about 2 cm, not 1 cm.** The go/no-go target in
   `docs/PLAN.md` (H-5) was "within ~1 cm". Across 12 stations the RMS over single pairs is
   1.1 to 2.2 cm. The scatter looks like leftover atmosphere: it does not grow with time,
   and the running sum stays within 0.9 to 2.9 cm RMS of GPS over the whole window. The
   call belongs to Daniel and Ryan, on Daniel's cleaned GPS.
2. **The four original stations barely move; other stations in the window do.** Relative
   to P304, P302, P303 and P307 end the window at +1.5, −0.7 and −2.8 cm, about the size of
   the scatter, and NISAR does not track them (correlation −0.2 to 0.5). The window holds
   nine more NGL stations with data through the NISAR period. At the two that move most,
   **CAFP (Five Points) and CAHA (Hanford)**, GPS rises about 1 cm into late winter, sinks
   to −5 or −6 cm by August and ends at −4.4 and −4.8 cm; NISAR follows (correlation 0.81
   and 0.71, net −3.4 and −2.2 cm). TRAN, P300, P725 and CAFR also correlate at 0.77 to
   0.81. CAFR (Fresno) is the worst net disagreement: NISAR +5.9 cm, GPS +1.2 cm. The
   positive correlations at the moving stations confirm the sign convention.
3. **No whole-cycle unwrapping jumps were found** inside any pair: under 0.001% of pixels
   sit within 0.15 cycle of ±1 cycle from their 2 km surroundings.
4. **Only 49% of pixels are valid in all 25 pairs**, which is what a first-to-last net
   change needs under the contract rule "a missing pair makes later values missing". 61%
   are valid in at least 24 pairs, 76% in at least 22. Almost all the loss is coherence
   below 0.3 on farmland in one or more pairs.
5. **The net change has field-shaped patches of apparent sinking that are probably not
   ground deformation.** After removing a 5 km median background, 23% of valid pixels are
   more than 3 cm *below* their surroundings and only 1% are more than 3 cm above; 11% are
   more than 6 cm below. The patches follow field boundaries and build up a little in each
   pair. That one-sided, field-by-field pattern is what a soil-moisture or vegetation phase
   bias in a chain of short-interval interferograms looks like. The smooth background
   itself ranges from about −7 to +1 cm. **Until this is understood, a pixel-level "sinking"
   label on farmland may be showing irrigation, not subsidence.** Not corrected here.

Quick-look figure (not committed): `interim/figures/net_change_selfcheck.png`.

---

### Notes for Ryan and Ismail from the app check (2026-11-14, hour 13)

- **The app matches stack v3.** Three random cells, all 11 app stations and Daniel's residual
  table agree with an independent recomputation to 0.05 mm (`processed/check_app_vs_stack.csv`).
- **P300 is a weak calm comparison.** Its map cell has only 7 valid dates out of 26, so its
  NISAR series in the app is short. P294 and P298 have full series and follow GPS. Your call.
- **Don't quote a NISAR-only trend.** NISAR net change is on average about 1 cm above GPS at
  the held-out stations (9 of 12 net residuals are positive). That is inside the 2 cm
  uncertainty. A shift shared by most stations points at the reference pixel at P304 rather
  than at each station; this has not been tested.

### Decisions taken by the data lane (2026-11-14), open to override

These are in force in the stack as delivered. Each can be reversed with one flag and a
rebuild. They are proposed for `docs/DECISIONS.md` as D5, together with the matching changes
to the plan, roles, contracts and pitch, in `proposals/d5_first_real_stack.patch`.

| # | Decision | Why | How to reverse |
|---|---|---|---|
| N1 | Window widened to lon −120.80..−119.40, lat 35.95..37.12 | P302 and P303 are outside the app bbox | `process_pairs.py --window` |
| N2 | Troposphere and solid Earth tide screens subtracted, as well as the ionosphere | Scene-wide spread drops from 2.2 to 1.6 cm RMS, tested without GPS | `build_stack.py --iono-only` |
| N3 | "Sample slip" anomaly pixels kept and flagged, not masked | Measured effect about 2 mm; masking removes 19% of the window from the whole series | `process_pairs.py --mask-anomalies --overwrite` |
| N4 | Coherence threshold 0.3 | Common default; not tuned yet | `process_pairs.py --coherence` |
| N5 | Reference = median of a 5 × 5 pixel block at P304; station value = median of a 3 × 3 block | Keeps single-pixel noise out of the reference | code constants in `nisar_gunw.py` |
| N6 | Tie to P304 from a 7-day median at each date. Versions 1 and 2: raw NGL GPS. Version 3: Daniel's cleaned series `gps/processed/gps_los.csv` | The cleaned series did not exist for v1 and v2. Changes a pair's tie by at most 3.29 mm | automatic once `gps/processed/gps_los.csv` exists; `build_stack.py --no-tie` |
| N8 | Station table covers all 14 NGL stations in the window, not only the 4 in the contract | The 4 barely move; CAFP and CAHA move 5–7 cm and NISAR follows them | edit `processed/stations_ngl.csv`, then `build_stack.py --stations-only` |
| N7 | Sign: `los = −λ/(4π) × phase` | Follows from reference × conj(secondary); the opposite sign fits GPS worse | `PHASE_SIGN_TOWARD_SATELLITE` in `nisar_gunw.py` |
| N9 | Terrain heights from Copernicus GLO-90 for the troposphere, tide and LOS cubes | Tested without GPS on Track 034: spread of displacement across the window 1.55 cm RMS at constant 50 m, 1.40 cm with terrain heights, 1.89 cm with the height term reversed; on hill pixels above 150 m (31% of valid pixels) 1.51, 1.25 and 2.04 cm; median regression coefficient on the height-dependent wet screen 0.99 | `process_pairs.py --flat-height --overwrite`, then rebuild the stack |

---

## 4b. NISAR L2 GUNW, Track 042 descending, Frame 070 (secondary)

Processed by the data lane to save time; Steven owns what is done with it. Same window, reference station (P304), sign and corrections as Track 034. Its line-of-sight vectors differ, so its values must not be compared with Track 034 pixel for pixel without the geometry.

| field | value |
|---|---|
| Pairs | 27 pairs over 28 dates, 2025-11-01 to 2026-10-15, a sequential chain. 25 pairs span 12 days; pairs 8 and 22 span 24 days |
| Granule list | [`processed/granules_t042_f070.csv`](processed/granules_t042_f070.csv) |
| Stack | `interim/stack_t042_f070.nc` (358 MB, 27 pairs, 1670 × 1616 pixels; shared Drive: not yet) |
| Station table | `processed/station_values_t042_f070.csv` |
| Self-check | `processed/qa_stations_vs_gps_t042_f070.csv`, summary `processed/qa_summary_t042_f070.csv` |
| Valid fraction per pair | 59% to 75% |
| Valid in all 27 pairs | 33% of pixels |
| Anomaly-flagged pixels | none in any pair |
| Heights | Terrain height from Copernicus GLO-90, as in versions 2 and 3 of Track 034 |
| Tie to P304 | Raw NGL GPS. **Not rebuilt for the data freeze**, so it is not on the cleaned series that Track 034 v3 uses. Cross-check only |

Self-check, in cm (NISAR minus GPS, both relative to P304, line of sight). Same columns as the Track 034 table. CAHA has no valid pixels on this track. P300 has 25 pairs but its running sum stops on 2026-01-24 (7 dates). Pair 24 is flagged as near a whole cycle (about 12 cm) at CAKC and P298. A flagged pair also gets `near_cycle_persists` (summary column `persistent_cycle_pairs`): 1 if the running-sum residual is still shifted by that many cycles one pair later, as an unwrapping error would leave it, 0 if it reversed, as one-date atmosphere would. Both flags have `near_cycle_persists` = 0. Provisional, same status as the Track 034 check.

Pair 24 (2026-08-28 to 2026-09-09) is within 3 cm of one phase cycle at CAKC and P298, but it is not an unwrapping error: the misfit reverses in the next pair (CAKC running-sum residual +12.7 cm, then -2.0 cm, then +6.7 cm). It is atmosphere on 2026-08-28. No pair of Track 042 has been corrected or masked.

On Track 042 the troposphere screens help less than on Track 034. Against GPS, all stations and pairs: 3.10 cm RMS with the screens and 3.11 cm with the ionosphere only (Track 034: 1.86 and 2.69 cm). Scene-wide spread without GPS: 2.21 cm with and 2.60 cm without, better in 15 of 27 pairs (Track 034: 1.40 and 2.18 cm, better in 19 of 25).

| Station | Pairs | RMS, single pairs | Worst pair | GPS net | NISAR net | GPS range | RMS, running sum | Correlation | From |
|---|---|---|---|---|---|---|---|---|---|
| CAFP | 25 | 1.6 | 3.4 | −3.3 | −1.2 | 6.1 | 2.7 | 0.42 | 2025-11-01 |
| CAFR | 25 | 2.7 | 6.6 | +1.1 | +3.7 | 1.7 | 3.2 | 0.60 | 2025-11-01 |
| CAHA | 0 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | none |
| CAKC | 25 | 5.3 | 14.8 | +1.4 | +6.1 | 1.9 | 4.3 | 0.54 | 2025-11-01 |
| P294 | 27 | 3.6 | 7.8 | +1.2 | +3.3 | 1.7 | 3.3 | 0.34 | 2025-11-01 |
| P297 | 20 | 3.2 | 7.3 | +2.7 | +4.0 | 3.0 | 2.6 | 0.55 | 2025-11-01 |
| P298 | 27 | 4.4 | 10.5 | +1.3 | +5.0 | 2.2 | 3.6 | 0.47 | 2025-11-01 |
| P300 | 25 | 2.8 | 7.6 | −0.3 | −1.6 | 0.5 | 1.4 | 0.77 | 2025-11-01 |
| P302 | 27 | 2.1 | 5.0 | +0.9 | −0.2 | 1.6 | 1.6 | −0.03 | 2025-11-01 |
| P303 | 27 | 2.7 | 5.6 | −1.0 | −1.3 | 1.1 | 2.2 | −0.01 | 2025-11-01 |
| P307 | 27 | 2.0 | 4.2 | −4.3 | −3.4 | 4.8 | 3.2 | −0.32 | 2025-11-01 |
| P725 | 27 | 3.1 | 7.0 | +1.4 | +6.9 | 2.1 | 4.5 | 0.68 | 2025-11-01 |
| TRAN | 25 | 1.3 | 2.9 | −0.5 | −0.4 | 2.4 | 1.2 | −0.06 | 2025-11-01 |

---

## 5. How to run (any track and frame)

One-time setup, from the repo root:

```bash
python -m venv data/.venv
data/.venv/Scripts/python -m pip install earthaccess h5py xarray netCDF4 numpy scipy pyproj rasterio pytest
data/.venv/Scripts/python -c "import earthaccess; earthaccess.login(strategy='interactive', persist=True)"
```

(On macOS/Linux the interpreter is `data/.venv/bin/python`.) Then, for Track 034 / Frame 020:

```bash
data/.venv/Scripts/python data/scripts/find_granules.py --track 34 --frame 20 --direction A
data/.venv/Scripts/python data/scripts/process_pairs.py --track 34 --frame 20 --pairs all
data/.venv/Scripts/python data/scripts/build_stack.py --track 34 --frame 20
data/.venv/Scripts/python data/scripts/qa_stations_vs_gps.py --track 34 --frame 20
```

- After changing the station list, `build_stack.py --track 34 --frame 20 --stations-only`
  rewrites the station table in seconds without touching the stack file.
- `build_stack.py --suffix _v3` writes `interim/stack_t034_f020_v3.nc` instead of
  overwriting the existing stack file. The frozen v3 was built with
  `build_stack.py --track 34 --frame 20 --suffix _v3 --notes "v3 = v2 re-tied to the cleaned P304 series (data freeze)"`
  (with `gps/processed/gps_los.csv` present).
- `process_pairs.py` builds the DEM itself (`interim/dem_tTTT_fFFF.nc`, via `make_dem.py`)
  the first time it runs for a track. It takes about 70 s per pair and skips pairs already
  on disk, so it can be interrupted and restarted. `--pairs 1`, `--pairs 3-7` and
  `--overwrite` are available, as are `--coherence`, `--window`, `--no-troposphere`,
  `--no-tides`, `--mask-anomalies` and `--flat-height` (constant 50 m instead of terrain
  height).
- **Descending track (H-11, Steven):** the same four commands with
  `--track 42 --frame 70 --direction D`. Outputs get `t042_f070` in their names. Run the
  scripts; don't edit them. Ask Pratheek for changes.
- Tests: `data/.venv/Scripts/python -m pytest data/tests -q`

| Script | Does |
|---|---|
| `scripts/nisar_gunw.py` | Library: granule search, subset reads, corrections, masking, referencing |
| `scripts/find_granules.py` | CMR search → `processed/granules_tTTT_fFFF.csv` (no login needed) |
| `scripts/make_dem.py` | Copernicus GLO-90 DEM for a track and frame → `interim/dem_tTTT_fFFF.nc`; prints DEM minus GPS station height |
| `scripts/process_pairs.py` | One `interim/tTTT_fFFF/pair_NN.nc` per pair |
| `scripts/build_stack.py` | Stack + station table, with the GPS tie |
| `scripts/qa_stations_vs_gps.py` | Provisional self-check against raw NGL GPS |
| `scripts/check_app_vs_stack.py` | Independent check of the app files and the GPS residuals against the v3 stack → `processed/check_app_vs_stack.csv`; run `data/.venv/Scripts/python data/scripts/check_app_vs_stack.py` (about 10 s, `--seed` picks the random cells, exit 1 on any failure) |

---

## 6. Other files in `raw/` (git-ignored)

- `raw/feasibility/`: the "San Joaquin Feasibility Data" bundle (14 Nov 2026). Catalogue
  metadata for the NISAR frames, raw NGL GPS series, DWR samples. It contains **no NISAR
  measurements**. Its Track 034 / Frame 020 granule list matches the live CMR catalogue
  exactly (25 of 25).
- `raw/dem/`: Copernicus DEM GLO-90 tiles, fetched by `make_dem.py`. Copernicus DEM GLO-90,
  (c) DLR e.V. 2010-2014 and (c) Airbus Defence and Space GmbH 2014-2018, provided under
  COPERNICUS by the European Union and ESA.
- `raw/ngl/`: NGL IGS20 `.tenv3` daily series, fetched by `build_stack.py` and the QA script
  from `https://geodesy.unr.edu/gps_timeseries/IGS20/tenv3/IGS20/<station>.tenv3`.
  Cite Blewitt, Hammond and Kreemer (2018), doi:10.1029/2018EO104623.

---

## 7. Changelog

- **v1, 2026-11-14.** Track 034 / Frame 020 stack with a constant 50 m height for the troposphere, tide and LOS cubes. `interim/stack_t034_f020.nc`, uploaded to the Drive.
- **v2, 2026-11-14.** Terrain heights from Copernicus GLO-90. `interim/stack_t034_f020_v2.nc` and `interim/stack_t042_f070.nc`. The station tables and self-check summaries in `processed/` now reflect v2.
- **v3, 2026-11-14 (data freeze).** `interim/stack_t034_f020_v3.nc` (426 MB, git-ignored, goes on the Drive). v2 re-tied to P304 with the cleaned series `gps/processed/gps_los.csv` instead of raw NGL. Everything else is the same. A single pair's tie changes by at most 3.29 mm; the net change of every pixel is +3.2 mm against v2. The four station and QA files in `processed/` were regenerated from v3. v2 is superseded; v1 and v2 stay on the Drive unchanged. Track 042 was not rebuilt. Ismail and Daniel rerun on v3.
- **2026-11-14:** self-check gains a persistence test that separates unwrapping errors from one-date atmosphere.
