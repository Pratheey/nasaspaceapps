# frontend/: The Breathing Ground app (owned by the frontend lane)

Static site, no backend (D3). Vite + MapLibre GL JS, plain JavaScript, hand-drawn SVG charts.

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/, deployable to GitHub Pages or Vercel
```

## Data
The app loads the four files from `contracts/app_data.md`:
1. `public/data/{meta,grid,series,stations}.json`, written by the analysis lane (real NISAR).
2. If those don't exist, `public/samples/` (synthetic copies of `contracts/samples/`), and a
   striped "Synthetic data" banner appears at the top. Never record the demo with that banner showing.

To refresh the samples: `python3 contracts/samples/make_samples.py && cp contracts/samples/*.json frontend/public/samples/`

## What's in it
| Feature | Where |
|---|---|
| Net change map, same color scale in every view, hatched where there's no reliable measurement | `main.js` `drawGrid` |
| Two dates: drag A and B on the timeline; "find the two dates that hide the most here" | `main.js`, `data.js` `mostMisleadingPair` |
| Breathe: play the record pass by pass | `main.js` `play` |
| What we can say: the four labels from the proposal | `main.js`, `colors.js` |
| Inspector: leveling rod, key numbers with uncertainty, chart with fit or trend/seasonal split | `rod.js`, `chart.js` |
| GPS check: station markers, GPS line on the chart, residual table | `main.js` |
| How we got these numbers (evidence receipt) | `main.js` `renderInspector` |
| Guided walkthrough, mirrors the 30-second pitch | `tour.js` |
| Limits panel (text from `docs/pitch/limits.md`) and keyboard shortcuts | `limits.js` |
| Every pair of dates at a spot: triangle chart, outlined pairs hide the sinking, click to map them | `matrix.js` |
| Cross-section: draw a line (canal, road, levee), drag its ends, hover to find the spot | `profile.js` |
| 3D: same values as height, with the exaggeration stated; animates with Breathe | `main.js` `updateRelief` |
| Compare two spots (Shift-click or the button), listen to a spot, download its numbers as CSV | `main.js`, `extras.js` |
| Go to a place or station; Share view copies a link that reopens the exact view | `main.js`, `extras.js` |
| Hover sparkline on the map | `main.js` `hoverReadout` |

## Design
USGS topographic quad palette: on those maps purple marks change seen from the air, so purple
means sinking. Survey teal means rising. Rod red appears only on the leveling rod. Type is
Barlow Semi Condensed (headings) and Barlow (body), tabular numerals throughout.
