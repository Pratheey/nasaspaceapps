"""Tests for the persistence test in data/scripts/qa_stations_vs_gps.py (pure arithmetic)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from qa_stations_vs_gps import cycle_step_persists  # noqa: E402

HALF = 0.121


def test_step_persists():
    assert cycle_step_persists(0.010, -0.115, -1, HALF) == 1


def test_step_reverses():
    assert cycle_step_persists(0.127, 0.067, -1, HALF) == 0


def test_missing_after_is_none():
    assert cycle_step_persists(0.010, None, -1, HALF) is None


def test_two_cycles_persist():
    assert cycle_step_persists(0.0, 0.240, 2, HALF) == 1
