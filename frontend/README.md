# frontend/: The Breathing Ground app (owned by the frontend lane)

Static single-page app, no backend (D3). React 19 + Vite, Tailwind CSS v4, Lucide icons,
MapLibre GL JS for the map, hand-built SVG/canvas charts.

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/, deployable to GitHub Pages or Vercel
```

## Data
Loads the four files from `contracts/app_data.md`:
1. `public/data/{meta,grid,series,stations}.json`, written by the analysis lane (real NISAR).
2. If those don't exist, `public/samples/` (synthetic copies of `contracts/samples/`), with a
   striped "Synthetic data" banner. Never record the demo with that banner showing.

Refresh samples: `python3 contracts/samples/make_samples.py && cp contracts/samples/*.json frontend/public/samples/`

## Layout of the code
| File | What it does |
|---|---|
| `src/App.jsx` | State, actions, keyboard, playback, shareable links, layout |
| `src/components/MapView.jsx` | MapLibre map: data layer, 3D relief, outlines, stations, cross-section ends |
| `src/components/Inspector.jsx` | Overview (label shares, seasonal-vs-trend scatter) and the selected-spot panel |
| `src/components/Chart.jsx`, `Gauge.jsx`, `PairMatrix.jsx` | Time series, height gauge, every-pair-of-dates triangle |
| `src/components/Timeline.jsx` | Pass track: play, scrub, drag A and B |
| `src/components/Legend.jsx`, `Panels.jsx` | Legend; cross-section, walkthrough, intro, limits |
| `src/lib/*` | Data loading and contract helpers, colors, formatting, tour steps, CSV/hash/sound |

## Views (keys 1–5)
Net change, Two dates, Breathe, Radar fringes (one color cycle = 11.9 cm, half NISAR's L-band
wavelength), What we can say (the four labels). Same color scale in every value view.

## Story page (`src/story/`)
Scroll story in front of the explorer: NASA/JPL hero image, the 1925–1977 subsidence pole,
an aquifer you can pump and recharge (concept diagram), the breathing record, draggable two
dates, a globe with NISAR's orbit, how radar measures a centimetre, radar fringes, GPS check,
why it matters. Glossary terms pop up on hover. Smooth scrolling with Lenis.

## Extra explorer tools
Swipe (date A left, date B right), year-as-a-circle chart, "Where to look first" leaderboards,
cross-section, 3D, compare, listen, CSV, share links.

## Design
Night graphite background. Still ground stays dark; motion glows: coral for sinking, cyan for
rising. Azure marks everything you can touch. Type: Saira Semi
Condensed (headings), Public Sans (body), tabular numerals.
