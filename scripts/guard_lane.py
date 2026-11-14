#!/usr/bin/env python3
"""Claude Code PreToolUse hook: block Edit/Write outside this person's lane.

Reads the tool call JSON on stdin. Exit 0 = allow, exit 2 = block (stderr goes to the agent).
Paths outside the repo (scratch files, ~/.claude memory, etc.) are always allowed.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lanes import LANES, REPO_ROOT, allowed, read_lane  # noqa: E402


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    tool_input = payload.get("tool_input") or {}
    raw = tool_input.get("file_path") or tool_input.get("notebook_path")
    if not raw:
        return 0

    path = Path(raw)
    if not path.is_absolute():
        path = Path(payload.get("cwd") or REPO_ROOT) / path
    try:
        rel = path.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return 0  # outside the repo

    if rel == ".lane":
        return 0

    lane = read_lane()
    if lane is None:
        print(
            "No lane set. Ask your human which lane they own and have them run "
            "`echo <lane> > .lane` (nisar | analysis | radar | gps | frontend | integrator).",
            file=sys.stderr,
        )
        return 2
    if lane not in LANES:
        print(f"Unknown lane '{lane}' in .lane. Valid: {', '.join(LANES)}.", file=sys.stderr)
        return 2
    if allowed(lane, rel):
        return 0

    print(
        f"Blocked: '{rel}' is outside the '{lane}' lane (see AGENTS.md §2). "
        "Do not work around this. Tell your human what change is needed in that file "
        "so they can raise it with the owning lane or the Integrator.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
