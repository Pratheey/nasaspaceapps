# The Breathing Ground

**NASA Space Apps 2026 · Dancing with the SARs · Team Manifest Destiny**

**Live app:** https://pratheey.github.io/nasaspaceapps/

California's San Joaquin Valley rises a little every wet season and settles every dry season. Underneath
that rhythm, parts of it keep sinking, because groundwater pumping compacts the clay layers of the aquifer.
Compare the wrong two dates and sinking ground looks flat, or even rising.

We used the first year of NASA–ISRO **NISAR** L-band radar (26 passes, 24 Nov 2025 to 14 Oct 2026, track 34
ascending, frame 20) over Corcoran–Mendota to separate the two, and checked the radar against **13 held-out
GPS stations** it was never calibrated with (agreement about 1.8 cm per 12-day pair). The app lets anyone
click a spot and see every measurement, the fitted seasonal and trend parts, how sure we are, and whether
GPS agrees. Where the evidence is too thin, it says so.

## What's in the app

- **Story:** the problem, the physics of radar interferometry, the satellite, and what sinking does to
  canals, levees and drinking-water wells.
- **Live map:** net change, any two dates, pass-by-pass playback, radar fringes, the four evidence labels,
  "hidden sinking" (where two dates mislead), and motion patterns (k-means grouping of each spot's record).
- **Inspector:** every measurement at a spot, fitted curve with uncertainty, GPS comparison with residuals,
  the source of every number, and ten years of Sentinel-1 history at each GPS station (context only).
- **Polarization and coverage:** NISAR HH/HV over 30 crop fields, and usable coverage vs Sentinel-1.
- **Tools:** cross-sections, the California Aqueduct profile, swipe, 3D, walkthrough.
- **Limits panel:** what the fit does and does not mean.

## Team and roles

| Who | Role | Responsible for |
|---|---|---|
| **Ryan Jian** | Team lead, integrator, story and design | Proposal and pitch, team decisions and data contracts, website design and story, final checks and submission |
| **Pratheek Danam** | NISAR data lead | Getting and processing the NISAR radar data: subset reads, corrections, masking, the data freeze and its checks |
| **Ismail Churaev** | Measurement and model | Net change, the seasonal and trend fit, significance and labels, and the data files the app reads |
| **Tsz "Steven" Liang** | Radar | Polarization over crop fields, NISAR vs Sentinel-1 coverage, and the vertical vs east–west cross-check |
| **Daniel Li** | GPS validation and context | GPS stations, the independent check of the radar, uncertainty, and context layers such as canals |
| **Avinash Lee** | Frontend | The interactive map app |

## How we used AI tools

The science decisions, data processing choices, checks and story were the team's. We used an AI
assistant (Claude, by Anthropic) the way we'd use a fast pair programmer:
- **Code:** help writing and debugging parts of the website and processing scripts. Team members reviewed,
  ran and tested the code, and every number was checked against the source tables.
- **Research:** finding data sources and documentation, and drafting docs.
- **Illustrations:** a few drawings on the site (satellite, diagrams) were coded with AI help and carry a
  small "AI-assisted" label.

Every measurement comes from NISAR, GPS and the listed datasets through the scripts in this repository. NASA
videos and images are NASA's own and credited on the site. No AI-generated content uses NASA logos or mission
insignia.

## Data

NISAR L2 GUNW and GCOV (provisional, NASA/ISRO via ASF DAAC) · Nevada Geodetic Laboratory GPS · OPERA DISP-S1
(Sentinel-1, context) · Sentinel-1 via ASF HyP3 · USDA Cropland Data Layer and Crop Sequence Boundaries ·
California DWR (California Aqueduct) · US Census county lines · OpenStreetMap (basemap). Details and units:
[data/README.md](data/README.md), [gps/](gps/), [radar/](radar/), [contracts/](contracts/).

## For the team

- **Roles and goals:** [ROLES.md](ROLES.md)
- **What we're building:** [docs/PROJECT.md](docs/PROJECT.md) · decisions: [docs/DECISIONS.md](docs/DECISIONS.md)
- **How we work together:** [docs/WORKFLOW.md](docs/WORKFLOW.md) · rules for AI agents: [AGENTS.md](AGENTS.md)

## Setup (everyone, 2 minutes)

```bash
git clone <repo-url> && cd nasaspaceapps
echo nisar > .lane    # Pratheek=nisar  Ismail=analysis  Steven=radar  Daniel=gps  Avi=frontend  Ryan=integrator
```

Then open your agent in the repo folder. It reads `AGENTS.md` (or `CLAUDE.md`) automatically.

## Folders and owners

| Folder | Owner |
|---|---|
| `data/`: NISAR GUNW access, subsetting, ionosphere, masking, stack | Pratheek (`nisar`) |
| `analysis/`: net change, seasonal and trend fit, labels, export for the app | Ismail (`analysis`) |
| `radar/`: GCOV polarization, NISAR vs Sentinel-1 coverage, descending track | Steven (`radar`) |
| `gps/`, `context/`: GPS validation, canals, groundwater, historical layers | Daniel (`gps`) |
| `frontend/`: the interactive map | Avi (`frontend`) |
| `docs/` (incl. pitch), `contracts/`, root files | Ryan (`integrator`) |

**Who does what, hour by hour:** [docs/PLAN.md](docs/PLAN.md)

## Commands
| What | Command |
|---|---|
| Catch up with main | `./scripts/sync.sh` |
| Install processing and test dependencies (Python 3.12) | `python -m pip install -r requirements-dev.txt` |
| Check processing arithmetic and exports | `python -m pytest analysis/tests data/tests radar/tests -q` |
| Install website dependencies | `cd frontend && npm ci` |
| Check website behavior | `cd frontend && npm test` |
| Build the website | `cd frontend && npm run build` |

The automated tests use small synthetic fixtures and do not need an Earthdata login
or a fresh satellite download. Run the website commands from the repository root.
