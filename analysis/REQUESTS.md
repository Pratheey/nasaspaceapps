# What the analysis lane needs from each teammate (updated 2026-11-14, hour ~13)

Written by the analysis lane (Ismail). Numbers come from `analysis/NUMBERS.md` (rerun with
`python -m analysis.numbers` after any data change). Done items from earlier versions are removed.

## Ryan (integrator, pitch)

1. **Pitch line 2 (Pick Two Dates) needs new wording.** With Daniel's cleaned GPS, Hanford (CAHA)
   from 2025-12-06 to 2026-02-04 moves **+0.1 cm in GPS** and **+0.7 cm in NISAR**: the two dates look
   **flat**, not "a rise of about 1 cm". The full record from the same start is **−7.4 cm in GPS
   (−3.9 cm NISAR)**. Suggested line: "Compare these two dates and the ground looks flat."
2. **CAHA's seasonal term does not pass in NISAR** (GPS amplitude 16.3 mm is below the calibrated 18.5 mm
   bar), so the app says "seasonal not significant" there. Use **CAFP for the breathing** (NISAR 30.3 mm vs
   GPS 27.4 mm, both peaking in February) and **CAHA for the sinking**.
3. **Calm demo station is now P298** (set at the analysis freeze): all 26 radar dates, GPS −0.7 cm,
   NISAR within 0.9 cm of GPS. P300 had 7 valid dates and no net change. Swap it in `analysis/export.py` if you prefer.
4. **Amplitude wording:** the app's "29.6 mm up and down" is the amplitude A. Peak-to-trough is 2A
   (about 59 mm). Pick one and make the label say which.
5. **North-east control box:** kept for now (conservative). On v3 it behaves like ground that moves (78% of
   its cells "seasonal", +4.3 cm/yr), so it may set the bar too high: without it about 1,300 more cells count
   as seasonal, CAHA included. Decide with Pratheek (`analysis/README.md`, "Decisions taken at the analysis freeze").
6. **Tick rows 5, 6, 12, 13 and 14 of `numbers.md`:** second-checked by the analysis lane (`analysis/SECOND_CHECK.md`).
7. **Canal:** the Aqueduct profile follows contracts v1.2 section 5 and is in the app (tool "Aqueduct", key A).
   A standalone explorer for the project page or pitch: https://claude.ai/artifact/MvwyTvTDxKsEUsrosYcTqf
   (shared on request). Sinking under the canal is mostly 5–17 cm, deepest −16.3 cm at km 84;
   screening only.

## Avi (frontend)

1. **Basemap:** CARTO tiles show "API KEY REQUIRED". Switch to a source that needs no key.
2. **Crash:** `MapView.jsx` calls `m.getSource("grid").updateImage(...)` when the `grid` source is missing
   (seen after a hot reload and once while clicking on unchanged main). Add a null check.
3. **Review the Aqueduct tool** (`App.jsx`, `Panels.jsx`, `MapView.jsx`, `lib/profile.js`, `lib/data.js`);
   change it as you like.
4. **Check the public link** from Ryan's GitHub Pages workflow (D10) on a laptop and a phone.
5. **Legend:** add "blue = stable or rising ground, not water". The western hills read as sea without a basemap.

## Pratheek (nisar)

1. **NISAR trends run about +2 cm/yr less negative than GPS** at the held-out stations (+1.3 to +5.6;
   v3 did not change this, so it is not the tie). Worth a look before the pitch quotes any trend.
2. **North-east control box:** is it stable ground (see Ryan item 5)?
3. **Coverage:** mask tuning on pairs 9–13 and 21, and bridging pairs if ASF has them (details sent earlier).

## Daniel (gps, context)

1. **Delta-Mendota Canal:** the Federal canal service returns 404. A link that works, or the USGS NHD canal
   flowlines, gives a second profile.
2. **Corcoran levee:** no source yet (DWR's levee layer has none in the bbox). Send a source and its date,
   or we drop the levee profile and say so.
3. **H-8 files** (Census places, DWR groundwater for Fresno/Kings/Tulare) are on the hand-off branch
   `ismail/h8-context-for-daniel`, folder `analysis/handoff/h8/`. The earlier canal and GPS hand-off branches are deleted (both copied to `main`).

## Steven (radar)

1. **Vertical in the app is optional** (cross-check only, D7, D9). If wanted, I run
   `python -m analysis.run --component up --var up_disp_m --out frontend/public/data/vertical` on your
   two-track stack (contracts v1.2 section 6). It needs the stack from the Drive and GPS up for the comparison.
