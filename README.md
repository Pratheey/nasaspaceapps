# NASA Space Apps 2026: Dancing with the SARS

**The Breathing Ground**: where seasonal rebound hides continued sinking in California's San Joaquin
Valley, measured with NISAR L-band radar and checked against held-out GPS.
**Live app:** https://pratheey.github.io/nasaspaceapps/

## Use of AI (Super Intelligence) tools

The team used an AI assistant (Claude, by Anthropic, through Claude Code and claude.ai) for:
- **Code:** much of the website (`frontend/`) and parts of the processing scripts (`data/`, `analysis/`,
  `gps/`, `radar/`) were written or debugged with it. Team members reviewed, ran and tested the code.
- **Research and analysis support:** finding data sources, checking numbers against the source tables,
  and drafting documentation.
- **Illustrations:** the satellite drawing, the aquifer and radar diagrams and the pole drawing on the
  website were coded with AI help. Each carries a visible "AI-assisted illustration" label.

Not AI-generated: the measurements. Every number in the app comes from NISAR, GPS and the other listed
datasets through the scripts in this repository. NASA videos and images are NASA's own (credited on the
site). No AI-generated content uses NASA logos or mission insignia.

- 👋 **Start here, humans: your role and goals:** [ROLES.md](ROLES.md)
- **What we're building:** [docs/PROJECT.md](docs/PROJECT.md)
- **How we work together (git, pivots, check-ins):** [docs/WORKFLOW.md](docs/WORKFLOW.md)
- **Rules every AI agent follows:** [AGENTS.md](AGENTS.md)

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
