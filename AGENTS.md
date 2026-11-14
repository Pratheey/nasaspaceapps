# AGENTS.md: rules for every AI agent (and human) in this repo

You are one of six agents on a NASA Space Apps hackathon team building **The Breathing
Ground** (NISAR L-band ground motion over Corcoran–Mendota). Each human owns one **lane**,
and you work only inside that lane. Before doing anything, read:

1. this file
2. **`docs/PROPOSAL.md`**: the full proposal, with the science, data, rules and claims to avoid. Read all of it.
3. `docs/PLAN.md`: your person's hour-by-hour tasks and handoffs
4. `docs/PROJECT.md`, and the latest entries in `docs/DECISIONS.md`: what changed since the proposal

@docs/PROJECT.md
@docs/PROPOSAL.md

## 1. Golden rules

1. **Stay in your lane.** Only create or edit files in the folders your lane owns (see
   the table below). If something outside your lane needs changing, stop and tell your
   human so they can raise it with the owner. Don't "quickly fix" another lane's file.
2. **`docs/PROJECT.md` and `docs/DECISIONS.md` beat your memory.** The idea can change
   mid-hackathon. If your instructions conflict with those files, point it out and ask.
3. **Respect agreed interfaces.** Once the team agrees on a data or API shape, it goes in
   `contracts/`. Never change or invent fields that aren't there. Changes go through the
   Integrator.
4. **Small changes.** One task, one branch, one small PR. Don't reformat, rename or
   "clean up" files you weren't asked to touch. That is what causes merge conflicts.
5. **No secrets, no big files.** `.env` files and credentials never get committed.
   Neither does anything in `data/raw/`. Committed files stay under ~5 MB each.
6. **Say what's real.** Never present fake or placeholder data as real NASA data.
7. **Don't commit, push or merge unless your human asks.** When they do, follow
   `docs/WORKFLOW.md`.

## 2. Lanes and ownership

Your human's lane is in `.lane` at the repo root (one word, git-ignored). If that file is
missing, ask them which lane they're in and have them run `echo <lane> > .lane`.
Claude Code enforces this table with a hook (`scripts/guard_lane.py`). Other tools
have to follow it by hand.

| Person | `.lane` | Role | Owns (may edit) |
|---|---|---|---|
| Pratheek | `nisar` | NISAR data lead | `data/**` |
| Ismail | `analysis` | Measurement and model | `analysis/**`, `frontend/public/data/**` (the app's data files) |
| Steven | `radar` | Polarization, coverage comparison, descending track | `radar/**` |
| Daniel | `gps` | GPS validation and context layers | `gps/**`, `context/**` |
| Avi | `frontend` | Interactive map app | `frontend/**` except `frontend/public/data/**` |
| Ryan | `integrator` | Integrator, story and pitch | everything (shared files go in via PR) |

The full task list per person, hour by hour, is in `docs/PLAN.md`.

**Shared files.** Only the Integrator merges changes to these: `AGENTS.md`, `CLAUDE.md`,
`docs/PROJECT.md`, `docs/DECISIONS.md`, `docs/WORKFLOW.md`, `contracts/**`,
`.github/**`, `.claude/**`, `scripts/**`, `requirements.txt`, `README.md`.

## 3. Stack and conventions

- **Stack:** not decided yet. Once it is, it gets recorded in `docs/DECISIONS.md` and
  summarized here. Until then, don't add frameworks or dependencies to shared files
  without asking.
- **Data docs:** every dataset in `data/processed/` gets an entry in `data/README.md`
  covering source, units, resolution and quirks. If it isn't documented, other lanes
  can't use it.
- **Naming:** use `snake_case` for files, data columns and JSON keys.
- **Units are always explicit**, and missing values are empty or `null`, never `-999`.
- **Time:** ISO 8601, UTC. **Coordinates:** `lat` and `lon` in decimal degrees (WGS84).

## 4. Before you say "done"

- The change works, and you've said how to test it.
- Docs affected by your change are updated, especially `data/README.md` for data.
- Tell your human which files changed and anything another lane needs to know.
