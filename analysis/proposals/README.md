# Proposals from the analysis lane for other lanes' files

Changes the analysis lane would like in files it does not own, as patches the owner reviews and applies
(same pattern as `data/proposals/`). Nothing here changes the app until the owner applies it.

## `story_labels_remove_circle.patch` (for Avi, frontend; 2026-11-15)

Asked for by Ismail. Clearer charts on the story page, one line on "Insufficient evidence", and the
"year as a circle" chart removed. Built and tested on main: `npm test` 8 passed, `npm run build` passes.

- **Story, "The record" (breathing chart):** axis title "ground motion since 24 Nov, cm (radar line of
  sight)", start and end dates on the x-axis, and a one-line key: dots = one NISAR pass at the station's
  1 km map cell, solid = measured record, dashed = fitted trend.
- **Story, "Two dates":** y-axis ticks in cm with an axis title, and a one-line key under the chart
  (each dot is one pass at the station; A and B are the dates being compared).
- **Map overview:** one short line under the four label cards: "Insufficient evidence" means we can't
  tell, not that the ground is stable. On stack v3, 52% of those cells lost the ground on at least one
  pass, 48% changed less than the uncertainty (±4 cm) with no clear yearly cycle.
- **Removed "The year as a circle"** from the spot inspector (and `SeasonClock.jsx`, used nowhere else).

Apply from the repo root:
```bash
git apply analysis/proposals/story_labels_remove_circle.patch
```
