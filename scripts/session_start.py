#!/usr/bin/env python3
"""Claude Code SessionStart hook: tell the agent its lane, freshness vs main, and recent decisions.

Whatever this prints is added to the agent's context at the start of every session.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lanes import LANES, REPO_ROOT, read_lane  # noqa: E402


def git(*args: str) -> str:
    try:
        return subprocess.run(
            ["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, timeout=8
        ).stdout.strip()
    except Exception:
        return ""


def main() -> None:
    out = ["=== Team context (scripts/session_start.py) ==="]

    lane = read_lane()
    if lane in LANES:
        out.append(f"Your human's lane: {lane}. You may edit: {', '.join(LANES[lane])}")
    else:
        out.append("No valid .lane file. Ask your human for their lane before editing files.")

    branch = git("rev-parse", "--abbrev-ref", "HEAD")
    if branch:
        out.append(f"Current branch: {branch}")
        git("fetch", "--quiet", "origin", "main")
        behind = git("rev-list", "--count", "HEAD..origin/main")
        if behind and behind != "0":
            out.append(
                f"WARNING: {behind} commit(s) on origin/main are not in this branch. "
                "Suggest running ./scripts/sync.sh before starting work."
            )

    project = REPO_ROOT / "docs" / "PROJECT.md"
    if project.exists():
        m = re.search(r"\*\*Version:\*\*[^\n]*", project.read_text())
        if m:
            out.append(f"docs/PROJECT.md {m.group(0)}")

    decisions = REPO_ROOT / "docs" / "DECISIONS.md"
    if decisions.exists():
        entries = re.split(r"(?m)^(?=## D\d+)", decisions.read_text())
        recent = [e.strip() for e in entries if e.startswith("## D")][-3:]
        if recent:
            out.append("Most recent decisions (newest last). These override older context:")
            out.extend(recent)

    print("\n".join(out))


if __name__ == "__main__":
    main()
