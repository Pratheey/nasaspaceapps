# Accuracy and bug review — 2026-11-15

The local review was reconciled with main snapshot
`bb7ef1401b08196a252db1b7ab32189c8ecc088d`. Publication was then prepared against
`b63c1a2a23062efba8aa1b31d30f4cf0baef6d9d`, preserving PR #41's cross-section/timeline fix.
The original review on
`steven/accuracy-review-20261115` at `e8bfa7a614224989db91ac097622bb4d33c6067c`
remains preserved in `work/project-audit`; the current reviewed source copy is
`work/project-review-current`; publication uses `work/project-publish-20261115`.
Changes remained local during the review. Steven subsequently authorized publishing
the tested fixes in a pull request on 2026-11-15; his final instruction is not to merge it.
This is an engineering audit, not a new independent scientific certification or team sign-off.

## Second pass: internal fixes against the newer main snapshot

Preserved the team's newer story illustrations, homepage sizing, always-visible A/B
timeline controls, and removal of Swipe Compare. Resolved the local patch overlaps
without restoring the removed feature or its obsolete test. No redesign or new
presentation/demo was added. Existing accuracy corrections below are retained.

| Additional finding | Local correction |
|---|---|
| Missing labels, invalid notes, incompatible units/fit period, duplicate station dates/IDs or inconsistent grid/series files could reach rendering | Validate the fields the app consumes, including final values and measured-date counts, and use the existing explicit sample fallback on failure. Test both shipped real and sample datasets. |
| Optional radar files with HTTP 200 but invalid structure were cached as usable and could crash field views | Validate the three radar exports together: dates, array lengths, synthetic flags, counts, totals, field IDs and polygon coordinates. Failed loads return the existing unavailable state and remain retryable. Preserve octet-stream GeoJSON support. |
| A serialization failure could overwrite metadata before discovering bad values in another export; direct writes could truncate existing JSON | Serialize every output before writing any file, then replace each completed file through a temporary file in the same directory. Regression tests check NaN and failed replacement. This is not a transaction across all four files: an operating-system failure between replacements can still interrupt a run. |
| Duplicate station/pair rows could be counted as a complete vertical interval | Reject duplicate station/pair rows and require the exact consecutive pair set before summing. Missing intervals remain missing. |
| The ionosphere-only stack mode copied troposphere/tide flags from the unused full-correction layer | Write correction flags for the selected displacement. Tests write and reopen small synthetic stacks in both modes. No frozen satellite stack was reprocessed. |
| The walkthrough still quoted native-pixel GPS residuals beside a 1 km chart | Reuse the chart's shared-date comparison and report its actual date range. |
| Polarization charts placed every acquisition equally far apart and connected missing observations | Calculate x positions and hover selection by elapsed time, so a 24-day interval is twice a 12-day interval; break paths at null observations. Keep the chart's layout and styling. |

Final second-pass validation: **93 Python tests and 19 frontend tests pass (112 total)**;
the production build passes with the existing large-bundle warning. Browser checks
confirmed real-data loading, CAHA's +3.5 cm net GPS discrepancy over 6 Dec–14 Oct,
30 crop fields with the published medians, and A/B timeline updates. No browser errors
were reported in these checks. A preview is saved beside the local review bundle.
The primary `meta.json`, `grid.json` and `series.json` are byte-for-byte identical to
the newer main snapshot. The original first-review checkout remains untouched.
The 112 tests and production build were also rerun after preserving PR #41.

The earlier scientific/source-table checks below remain applicable; they were not
all repeated after reconciling the UI-only upstream commits. The exported-data
regressions were rerun as part of the 93 Python tests.

## Corrections

| Finding | Local correction |
|---|---|
| GPS evidence beside a 1 km cell chart quoted residuals from a different native-pixel / seven-day-median check | Compute chart disagreement from the displayed cell and daily GPS samples on shared dates. Align the GPS curve and CSV to their first shared observation. Require a final-pass sample for net comparison. Preserve the separate native-pixel validation and its overall uncertainty. CAHA's chart comparison is +3.51 cm, rather than the native-pixel +2.65 cm; P300 has no complete app-cell net comparison. |
| Vertical comparison discarded valid late-starting GPS net comparisons | Start at the first shared sample, while still requiring the final pass. Add a regression test for late GPS and missing final radar data. |
| GPS bootstrap omitted the final possible 21-observation block and crashed on short inputs | Include that block; reject insufficient/nonfinite inputs explicitly. Rebuild GPS fits from the local NGL observations. Only fit uncertainty columns change, by at most 0.00004 m or m/year. At app precision this updates P297 and CAFR GPS trend sigmas only. |
| OPERA history accepted a value rejected by its recommended quality mask and connected missing dates | Require mask 1 at both station and P304. P300 on 2024-11-27 changes from 0.0343 m to null. Add 165 explicit missing dates across stations; other existing history values are unchanged. Break chart paths across gaps and disconnected segments. |
| Motion patterns crashed with no eligible cells and created misleading complete records | Handle empty, small, and identical datasets. Require measured endpoints and at least 20 dates. Interpolate only internal gaps by elapsed time, not date index. Cache by requested settings and remove empty groups. The current data uses 8,116 cells. |
| Hidden-sinking view reclassified rounded values at the significance boundary | Reuse the exported significance labels. Corrected counts: 1,698 hidden-sinking cells out of 3,357 sinking cells, rather than 1,701 / 3,360. The underlying labels and measurements are unchanged. |
| Fringe colors, glossary, lens and physics diagram used a nominal 23.84 cm wavelength | Use the dataset's 1239 MHz frequency consistently: a fringe is about 12.1 cm, not 11.9 cm. Source: `data/README.md`, consistent with the GPS cycle constant and phase conversion code. |
| Several captions called GPS-tied absolute LOS motion “relative to P304” or implied vertical height | Correct LOS reference wording and explicitly distinguish the animation's display height from vertical displacement. OPERA history remains relative to P304, as its processing requires. |
| Animation inferred pumping/recharge causes from the shape alone | Describe observed motion toward/away from the satellite. Avoid treating a clustered rise-and-fall pattern as proof of a seasonal groundwater mechanism. |
| Loader accepted numeric strings, invalid dates, invalid flags and malformed optional canal files | Validate numeric values, uncertainty signs, labels, counts, actual calendar dates, synthetic flags and canal geometry arrays. Return no cell for nonfinite coordinates. |
| Aqueduct profile disappeared when reopening a shared view | Encode and restore the canal flag in the share URL; verified with a browser reload. |
| Generated numbers table used mismatched residuals and repeated P298 | Calculate net differences from the same shared window; deduplicate station rows and regenerate `NUMBERS.md`. Update the current pitch-number descriptions. |
| Headline text implied every interval was 12 days and net change removed seasonality | Acknowledge 24-day gaps, display uncertainty beside the largest motion, and explain that an eleven-month net change can retain seasonal motion. |
| Release wording implied no validated NISAR data existed until 2027 | Clarify that validated products for newer acquisitions began release in November 2026, while reprocessing this older record is planned for 2027. Link the ASF availability guide. The project's input record stays marked provisional. |

## First-pass checks

- **87 Python tests and 16 frontend tests pass.** The production frontend builds. New tests cover the failure cases above and independent consistency checks of the committed scientific exports.
- All **12,000 cells × 26 dates** have consistent final values, measured-date counts and station-cell mappings. All **229 Aqueduct samples** agree with their grid cells. The primary `meta.json`, `grid.json` and `series.json` remain unchanged.
- Recomputed native-pixel GPS uncertainty from the published residuals: **1.838 cm pair RMS over 313 unflagged pairs**, **1.977 cm net RMS over 12 stations**, with 13 held-out stations contributing pair checks. These agree with the rounded published values of 1.84 and 1.98 cm.
- Rebuilt GPS processing from the local NGL observations and station-value table into a separate scratch output. All 4,388 daily GPS rows, GPS residual components and unwrap flags match. `uncertainty.json` is identical. Radar residual differences are at most **0.06 mm**, consistent with rounding in the station-value inputs; this is not a claim of bitwise residual reproduction. The corrected bootstrap's fit uncertainties were propagated to the GPS fit CSV and the two affected app summaries.
- Regenerated all three radar app exports. They match the committed versions exactly. Polarization ratios agree with HH/HV differences and crop summaries. Coverage totals remain **542/690 NISAR** and **558/690 Sentinel-1**, using the same fields and matched pairs.
- Verified the older OPERA context export against its source CSV and quality masks. Its chart preserves missing observations instead of drawing them as zero or bridging them.
- Browser checks cover the local map, CAHA GPS evidence, motion-pattern view, Aqueduct share/reload, and the animation at desktop and phone widths. No browser errors were reported during those checks.
- `npm audit --omit=dev` reports **zero known production dependency vulnerabilities**. The tracked-file scan found no recognized private-key/token patterns and no files above 5 MB. This is a scoped scan, not a security guarantee.

## Limits and follow-up

The original ascending/descending raw NISAR stacks and full GCOV/HyP3 imagery were not
available in this checkout for an end-to-end reprocessing of every pixel. Processing
regressions, exported-data consistency, and reproducible source-table/GPS calculations
were checked; original satellite retrieval accuracy was not independently established.

D11's atmospheric tilt and east-edge underestimation remain scientific limitations.
The global RMS is a prototype station check, not a guarantee for every map cell. No new
atmospheric correction, uncertainty calibration, permanent-sinking inference or vertical
headline was introduced. The vertical cross-check is still separate from the primary LOS map.

The production build retains its existing large-bundle warning. Browser checks passed,
but performance across all devices and networks is not proven. The live deployment and
production tile-key permissions were not changed or newly verified in this local review.

## Reproduce

```sh
python -m pytest analysis/tests data/tests radar/tests -q
cd frontend
npm test
npm run build
```

Regenerate the corrected context and number reports from the repository root with
`python context/history/opera_history.py` and `python -m analysis.numbers`.
Use a separate output directory when checking GPS regeneration:
`python gps/scripts/build_gps_los.py --out /path/to/scratch-output`.

Primary external references checked on 2026-11-15:

- [ASF OPERA displacement usage and recommended masking](https://docs.asf.alaska.edu/datasets/disp_usage/)
- [ASF NISAR data availability and maturity](https://nisar-docs.asf.alaska.edu/availability-overview/)
