"""Single source of truth for lane ownership (mirrors the table in AGENTS.md)."""
from __future__ import annotations

from fnmatch import fnmatch
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

LANES = {
    "data": ["data/**", "requirements.txt"],
    "backend": ["backend/**", "requirements.txt"],
    "frontend": ["frontend/**"],
    "story": ["docs/pitch/**"],
    "integrator": ["**"],
}

# Paths a lane may NOT touch even if a pattern above matches.
EXCLUDE: dict = {}


def read_lane() -> str | None:
    f = REPO_ROOT / ".lane"
    if not f.exists():
        return None
    lane = f.read_text().strip().lower()
    return lane or None


def _match(rel: str, pattern: str) -> bool:
    if pattern == "**":
        return True
    if pattern.endswith("/**"):
        prefix = pattern[:-3]
        return rel == prefix or rel.startswith(prefix + "/")
    return fnmatch(rel, pattern)


def allowed(lane: str, rel_path: str) -> bool:
    rel = rel_path.replace("\\", "/")
    if rel.startswith("./"):
        rel = rel[2:]
    if any(_match(rel, p) for p in EXCLUDE.get(lane, [])):
        return False
    return any(_match(rel, p) for p in LANES.get(lane, []))
