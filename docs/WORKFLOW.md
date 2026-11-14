# WORKFLOW.md: how six people and six agents share one repo

## Why merge conflicts happen (and why we will mostly avoid them)
A conflict only happens when two branches change the **same lines of the same file**.
We avoid that by design:
1. Every folder has one owner lane (`AGENTS.md` §2), so two people rarely touch the same file.
2. Shared files (contracts, PROJECT.md) are changed only through the Integrator.
3. Branches live for hours, not days, so `main` never drifts far from you.

## Your loop (every task)

```bash
# 1. start from fresh main
git checkout main && git pull --rebase origin main

# 2. one branch per task: <your-name>/<short-topic>
git checkout -b alex/sars-download-script

# 3. work with your agent ... then commit small, often
git add -A && git commit -m "data: add download script"

# 4. before opening a PR, catch up with main
./scripts/sync.sh            # = fetch + rebase on origin/main

# 5. push and open a PR (website, or `gh pr create --fill`)
git push -u origin alex/sars-download-script
```

Then the Integrator reviews and **squash-merges**. Delete the branch and go to step 1.

Rules:
- Nobody pushes to `main` directly. Turn on branch protection: Settings → Branches →
  require a pull request and passing CI.
- A PR should be reviewable in under 5 minutes. If it's bigger, split it.
- PR title starts with the lane: `data: …`, `backend: …`, `frontend: …`, `story: …`, `contract: …`.
- Run `./scripts/sync.sh` at least every time someone announces a merge to shared files.

## If you do get a conflict
1. Don't panic, and don't force-push over someone else's work.
2. `git status` shows the conflicted files. If a file is **not in your lane**, take
   main's version: `git checkout --ours <file> && git add <file>` during a rebase. (In a
   rebase "ours" means main and "theirs" means *your* commit. It's backwards from what
   you'd expect, so ask the Integrator if unsure.)
3. For files in your lane, ask your agent: "Resolve the conflict markers in <file>,
   keeping both changes' intent." Then `git add <file> && git rebase --continue`.
4. If it's a mess: `git rebase --abort`, and ask the Integrator.

## Changing a contract (agreed data/API shape)
Contracts are the only thing that couples lanes, so they change carefully:
1. Open an issue describing the change and who it affects.
2. Update the shape **and** its sample file in `contracts/` in one PR.
3. After merge, post in chat: **"contract changed, pull now."**
Prefer **adding** fields over renaming or removing them. Additions break nobody.

## Pivoting the idea mid-hackathon (≈10 minutes)
Agents have no memory between sessions. They only know what's in the repo, so a pivot
is real only once it's in the files.
1. Agree as humans (quick call). The Integrator writes:
   - `docs/PROJECT.md`: new idea, scope and lane goals, with the **version bumped**
   - `docs/DECISIONS.md`: a new entry with the *impact per lane*
   - contracts, if shapes change (see above)
2. One PR, merged immediately. Post in chat: **"PIVOT merged: pull and restart agents."**
3. Everyone: `./scripts/sync.sh`, then **start a fresh agent session** (or tell your
   agent: "Re-read AGENTS.md, docs/PROJECT.md and the last 3 entries of
   docs/DECISIONS.md. The plan changed. Summarize what changed for my lane before
   doing anything.").
4. Close or rewrite GitHub issues that no longer fit.

## Check-ins (every 3–4 hours, 15 minutes max)
1. Each lane demos what works **on main** (not on their laptop branch). 1 min each.
2. Blockers: who is waiting on whom?
3. Integrator updates `docs/PROJECT.md` "Current lane goals" and the issue board.
4. Anything decided goes into `docs/DECISIONS.md` before people go back to work.

## Timeline
| Hours | Focus |
|---|---|
| 0–2 | Pick the idea, fill PROJECT.md, explore the SARS data, agree on contracts |
| 2–20 | Lanes build in parallel, check-ins every 3–4h, merge to main often |
| 20–(end−6) | Real data wired end to end, then polish |
| Last 6h | **Feature freeze.** Fix bugs, record video, write submission, submit early |

## Task board
GitHub Issues with the **Agent task** template. One issue is one agent session. Write
issues so they can be pasted straight into an agent as a prompt.
