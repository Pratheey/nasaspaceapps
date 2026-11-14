# DECISIONS.md: append-only log

New entries go at the **bottom**. Never edit or delete old entries. To change a decision,
add a new entry that overrides it. Agents read the last few entries at the start of every
session, so write each entry so an agent can act on it: what changed, why, and what each
lane must now do differently.

Format:

```
## D<n>: <date> <time>: <short title>
- **Decision:**
- **Why:**
- **Impact per lane:** data: … / backend: … / frontend: … / story: …
```

---

## D1: 2026-11-13: Repo skeleton
- **Decision:** One shared repo with five lanes. Each lane owns its folders, as listed in
  `AGENTS.md`. Theme: "Dancing with the SARS," using the SARS dataset. Idea and stack
  are not chosen yet.
- **Why:** Lets five people and their agents work in parallel without merge conflicts.
- **Impact per lane:** Everyone sets `.lane` and works only in their own folders.
