# NASA Space Apps 2026: Dancing with the SARS

- **What we're building:** [docs/PROJECT.md](docs/PROJECT.md)
- **How we work together (git, pivots, check-ins):** [docs/WORKFLOW.md](docs/WORKFLOW.md)
- **Rules every AI agent follows:** [AGENTS.md](AGENTS.md)

## Setup (everyone, 2 minutes)

```bash
git clone <repo-url> && cd nasaspaceapps
echo data > .lane     # your lane: data | backend | frontend | story | integrator
```

Then open your agent in the repo folder. It reads `AGENTS.md` (or `CLAUDE.md`) automatically.

## Folders and owners

| Folder | Owner lane |
|---|---|
| `data/`: raw (git-ignored), processed, notebooks, scripts, and the data dictionary | data |
| `backend/` | backend |
| `frontend/` | frontend |
| `docs/pitch/`: pitch, video script, submission | story |
| `docs/`, `contracts/`, `.github/`, `scripts/`, root files | integrator |

## Commands
| What | Command |
|---|---|
| Catch up with main | `./scripts/sync.sh` |
