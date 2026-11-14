# data/: data dictionary (owned by the nisar lane, Pratheek)

**Rule:** if a dataset isn't documented here, it doesn't exist. Other lanes and their
agents learn the data *only* from this page.

```
data/
├── raw/          git-ignored. Downloads (NGL GPS files, the feasibility bundle)
├── interim/      git-ignored. Per-pair files and the stack; shared through the Drive
├── processed/    small files (< 5 MB), committed for everyone
├── scripts/      everything needed to rebuild interim/ and processed/ from NASA
└── tests/        tests of the processing arithmetic on a synthetic file
```

Status on 2026-11-14: **all 25 pairs of Track 034 / Frame 020 are processed and stacked. The tie to P304 uses raw NGL GPS and is provisional. No unwrapping corrections. The stack is not on the Drive yet. Read section 4 ("What we found") before using the numbers.**

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
  opened with the same login, so no DEM is used. The geometry and troposphere cubes are
  sampled at a constant 50 m ellipsoidal height. On the valley floor this costs at most
  ~2 mm; in the Coast Range foothills at the west edge of the window it is worse.
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
   − solid Earth tide`. An ionosphere-only version is kept alongside.
3. **Mask.** A pixel is valid when all of these hold: coherence ≥ 0.3; a valid sample in
   both images; not water; connected component not 0; and in the same connected component
   as the reference station. Anomaly-flagged pixels are kept and flagged (see below).
4. **Reference.** Subtract the median corrected phase of the valid pixels in a 5 × 5 pixel
   block (400 m) centred on P304. A pair with fewer than 5 usable pixels there fails loudly
   rather than being referenced somewhere else.
5. **Metres.** `los_disp = −λ / (4π) × phase`.
6. **Tie.** Add P304's own GPS line-of-sight motion over the pair's dates to every pixel
   (done in `build_stack.py`, stored per pair as `ref_tie_m` so it can be undone).

Masked pixels are `NaN`. Nothing is interpolated or filled.

### Sign convention
Positive = motion **toward the satellite** (for mostly vertical motion, uplift), as in
decision D3. The product's native phase has the opposite sense: the interferogram is
reference × conj(secondary), so a positive phase is a range increase. Hence the minus sign
in step 5. This is derived from how the interferogram is formed; no statement of the sign was found in the product's own metadata. GPS cannot confirm it strongly, because the stations move less than 3 cm over the window and the radar scatter at a station is 1–2 cm. With the opposite sign the net-change residuals at the three stations get worse (30, 38 and 35 mm instead of 1, 24 and 21 mm). **Treat the sign as probable, not proven**, until it is checked against the NISAR GUNW product specification.

### Corrections: what is and isn't applied
| Correction | Applied | Evidence |
|---|---|---|
| Ionosphere screen | Yes, every pair | Required by `docs/PROPOSAL.md` §6 |
| Troposphere (wet + hydrostatic, model-based) | Yes | Tested without GPS: over the 25 pairs, the spread of displacement across the window drops from 2.2 cm RMS (ionosphere only) to 1.6 cm; 17 of 25 pairs improve; applying it with the opposite sign gives 3.9 cm |
| Solid Earth tides | Yes | Deterministic; differential effect across the window is ≤ ~3 mm |
| Unwrapping errors | **No pair corrected** | Waiting for Daniel's flags (H-9) |

`docs/PROPOSAL.md` §6 names only the ionosphere. Troposphere and tides are an addition by
the data lane; `build_stack.py --iono-only` produces the stack without them, and
`station_values.csv` carries both versions, so the team can choose.

---

## 3. Outputs

### `interim/stack_t034_f020.nc` (shared Drive, not in git)
Exactly `contracts/stack.md` §1, plus these additive extras: `cmr_concept_id`,
`tropo_applied`, `set_applied`, `anomalies_masked`, `ref_tie_m`, `valid_fraction` (all
per pair), the `anomaly` layer (pair, y, x; 1 = flagged), and global
attributes `track`, `frame`, `polarization`, `wavelength_m`, `geometry_height_m`.
`granule_id` is the granule name. 25 pairs, 1674 × 1620 pixels, 424 MB. Valid fraction per pair: 78% to 97%.

### `processed/station_values.csv` (in git)
`contracts/stack.md` §2: one row per pair per station. Values are the **median of the valid
pixels in the 3 × 3 block** (240 m) centred on the pixel nearest the station. Extra columns:
`n_valid_px` (0–9), `los_disp_iono_only_m`, `ref_tie_m`, `anomaly` (1 if any pixel of the
block is flagged). `los_disp_m` includes the tie;
subtract `ref_tie_m` to get the value relative to P304. H-4 is the pair-1 rows.

### `processed/stations_ngl.csv`
The four station coordinates (NGL, from Daniel). Used until `gps/processed/stations.csv`
exists, which then takes over automatically.

### `processed/qa_stations_vs_gps_t034_f020.csv`
The data lane's own check of every pair, and of the running sum, against raw NGL GPS at
the three non-reference stations. **Provisional and not the H-9 residual table.** No number
from it goes in the app or pitch.

Result on 2026-11-14 (NISAR minus GPS, both relative to P304, line of sight):

| Station | RMS over the 25 single pairs | Worst single pair | Net change, NISAR | Net change, GPS | Pairs near a 12 cm step |
|---|---|---|---|---|---|
| P302 | 1.7 cm | 4.0 cm | +1.5 cm | +1.5 cm | none |
| P303 | 1.8 cm | 5.2 cm | −3.1 cm | −0.7 cm | none |
| P307 | 1.8 cm | 3.4 cm | −0.7 cm | −2.8 cm | none |

---

## 4. What we found (read before using the stack)

1. **Single pairs agree with GPS to about 2 cm, not 1 cm.** The go/no-go target in
   `docs/PLAN.md` (H-5) was "within ~1 cm". Pair 1 is off by 1.3 cm at P302 and 1.5 cm at
   P303. The scatter looks like leftover atmosphere: it does not grow with time, and the
   running sum stays within about 1 to 2 cm RMS of GPS over the whole window. The call
   belongs to Daniel and Ryan, on Daniel's cleaned GPS.
2. **The stations barely move compared with that scatter.** GPS net motion relative to
   P304 is +1.5, −0.7 and −2.8 cm. So the stations can show that NISAR is not wildly wrong
   (no 12 cm steps, no drift), but they cannot confirm a centimetre-level signal.
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

### Decisions taken by the data lane (2026-11-14), open to override

These are in force in the stack as delivered. Each can be reversed with one flag and a
rebuild; none is recorded in `docs/DECISIONS.md` yet (that file is the Integrator's).

| # | Decision | Why | How to reverse |
|---|---|---|---|
| N1 | Window widened to lon −120.80..−119.40, lat 35.95..37.12 | P302 and P303 are outside the app bbox | `process_pairs.py --window` |
| N2 | Troposphere and solid Earth tide screens subtracted, as well as the ionosphere | Scene-wide spread drops from 2.2 to 1.6 cm RMS, tested without GPS | `build_stack.py --iono-only` |
| N3 | "Sample slip" anomaly pixels kept and flagged, not masked | Measured effect about 2 mm; masking removes 19% of the window from the whole series | `process_pairs.py --mask-anomalies --overwrite` |
| N4 | Coherence threshold 0.3 | Common default; not tuned yet | `process_pairs.py --coherence` |
| N5 | Reference = median of a 5 × 5 pixel block at P304; station value = median of a 3 × 3 block | Keeps single-pixel noise out of the reference | code constants in `nisar_gunw.py` |
| N6 | Tie to P304 from raw NGL GPS, 7-day median at each date | Daniel's cleaned series does not exist yet | automatic once `gps/processed/gps_los.csv` exists; `build_stack.py --no-tie` |
| N7 | Sign: `los = −λ/(4π) × phase` | Follows from reference × conj(secondary); the opposite sign fits GPS worse | `PHASE_SIGN_TOWARD_SATELLITE` in `nisar_gunw.py` |

---

## 5. How to run (any track and frame)

One-time setup, from the repo root:

```bash
python -m venv data/.venv
data/.venv/Scripts/python -m pip install earthaccess h5py xarray netCDF4 numpy scipy pyproj pytest
data/.venv/Scripts/python -c "import earthaccess; earthaccess.login(strategy='interactive', persist=True)"
```

(On macOS/Linux the interpreter is `data/.venv/bin/python`.) Then, for Track 034 / Frame 020:

```bash
data/.venv/Scripts/python data/scripts/find_granules.py --track 34 --frame 20 --direction A
data/.venv/Scripts/python data/scripts/process_pairs.py --track 34 --frame 20 --pairs all
data/.venv/Scripts/python data/scripts/build_stack.py --track 34 --frame 20
data/.venv/Scripts/python data/scripts/qa_stations_vs_gps.py --track 34 --frame 20
```

- `process_pairs.py` takes about 70 s per pair and skips pairs already on disk, so it can be
  interrupted and restarted. `--pairs 1`, `--pairs 3-7` and `--overwrite` are available, as
  are `--coherence`, `--window`, `--no-troposphere`, `--no-tides` and `--mask-anomalies`.
- **Descending track (H-11, Steven):** the same four commands with
  `--track 42 --frame 70 --direction D`. Outputs get `t042_f070` in their names. Run the
  scripts; don't edit them. Ask Pratheek for changes.
- Tests: `data/.venv/Scripts/python -m pytest data/tests -q`

| Script | Does |
|---|---|
| `scripts/nisar_gunw.py` | Library: granule search, subset reads, corrections, masking, referencing |
| `scripts/find_granules.py` | CMR search → `processed/granules_tTTT_fFFF.csv` (no login needed) |
| `scripts/process_pairs.py` | One `interim/tTTT_fFFF/pair_NN.nc` per pair |
| `scripts/build_stack.py` | Stack + station table, with the GPS tie |
| `scripts/qa_stations_vs_gps.py` | Provisional self-check against raw NGL GPS |

---

## 6. Other files in `raw/` (git-ignored)

- `raw/feasibility/`: the "San Joaquin Feasibility Data" bundle (14 Nov 2026). Catalogue
  metadata for the NISAR frames, raw NGL GPS series, DWR samples. It contains **no NISAR
  measurements**. Its Track 034 / Frame 020 granule list matches the live CMR catalogue
  exactly (25 of 25).
- `raw/ngl/`: NGL IGS20 `.tenv3` daily series, fetched by `build_stack.py` and the QA script
  from `https://geodesy.unr.edu/gps_timeseries/IGS20/tenv3/IGS20/<station>.tenv3`.
  Cite Blewitt, Hammond and Kreemer (2018), doi:10.1029/2018EO104623.
