# data/proposals/: changes the data lane proposes to files it does not own

The nisar lane can only edit `data/`. When the data shows that shared files (plan, roles,
contracts, pitch) need to change, the change is written here as a patch for the Integrator
to review and apply. Nothing in this folder is in force until Ryan applies it.

## `d5_first_real_stack.patch` (2026-11-14)

Proposes decision **D5** and brings the rest of the repo in line with it. Evidence:
`data/README.md` sections 3 and 4.

What it changes, in 13 files:

| File | Change |
|---|---|
| `docs/DECISIONS.md` | Adds D5, marked "proposed, Ryan confirms" |
| `docs/PROJECT.md` | Version 2 (proposed): 12 held-out GPS stations, demo at CAFP and CAHA, first results, new lane goals |
| `docs/PLAN.md` | Handoffs H-1, H-4, H-5, H-7, H-9, H-11 and the task rows of every person, marked **(D5)** |
| `ROLES.md` | Same changes in plain English |
| `contracts/README.md`, `stack.md`, `gps.md`, `app_data.md` | Version 1.1: station list, extra stack variables and station columns, cells as medians. Additive, no shape removed |
| `docs/pitch/*.md` | 12 stations instead of 3, "about 2 cm", Hanford date pair as the demo candidate |
| `gps/README.md` | Station list |

To review and apply (Integrator, from the repo root, on a new branch):

```bash
git apply --stat data/proposals/d5_first_real_stack.patch
```

```bash
git apply data/proposals/d5_first_real_stack.patch
```

Not in the patch, because they need their owners:

- **Frontend code (Avi):** `frontend/src/lib/tour.jsx` and `frontend/src/story/Story.jsx`
  look up stations `P307` and `P302` by name; `frontend/src/components/Inspector.jsx` and
  `CommandBar.jsx` say "four stations" and "P307" in their text.
- **Sample files (Ryan):** `contracts/samples/make_samples.py` still generates the four old
  stations with placeholder coordinates. Regenerate with the new list.
- **`docs/PROPOSAL.md`:** left as the original proposal. D5 overrides it where they differ
  (stations, demo, the "about a centimetre" go/no-go).
