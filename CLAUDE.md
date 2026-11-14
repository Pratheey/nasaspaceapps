@AGENTS.md

## Claude Code specifics

- A SessionStart hook prints your lane, how far behind `main` this branch is, and the latest
  decisions. Treat a pivot shown there as more important than earlier context.
- A PreToolUse hook blocks Edit/Write outside your lane. If it blocks you, do not work
  around it with shell commands. Tell your human what change is needed and in which lane.
