"""Dates -> numbers the math can use.

Rule from docs/DECISIONS.md (D3): t = (date - 2026-01-01) / 365.25 days, in years.
So 2026-01-01 is t = 0, dates in late 2025 are slightly negative, and one full
seasonal cycle (T = 1 year) is t going from 0 to 1.
"""
from __future__ import annotations

import datetime as dt
from typing import Iterable

import numpy as np

T0 = dt.date(2026, 1, 1)
DAYS_PER_YEAR = 365.25


def to_date(value) -> dt.date:
    """Accept '2025-11-24', a datetime.date/datetime, bytes, or a numpy datetime64."""
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    if isinstance(value, np.datetime64):
        return dt.date.fromisoformat(str(value.astype("datetime64[D]")))
    if isinstance(value, bytes):
        value = value.decode()
    return dt.date.fromisoformat(str(value)[:10])


def to_years(dates: Iterable) -> np.ndarray:
    """Convert a list of dates to years since T0 (float array)."""
    return np.array([(to_date(d) - T0).days / DAYS_PER_YEAR for d in dates], dtype=float)


def from_years(t: float) -> dt.date:
    """Inverse of to_years for one value (rounded to the nearest day)."""
    return T0 + dt.timedelta(days=round(float(t) * DAYS_PER_YEAR))