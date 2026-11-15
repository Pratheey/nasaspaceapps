# NASA Space Apps 2026: Dancing with the SARS

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
