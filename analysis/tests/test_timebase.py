import datetime as dt

import numpy as np

from analysis.timebase import from_years, to_years


def test_t0_is_zero_and_one_year_is_one():
    t = to_years(["2026-01-01", dt.date(2027, 1, 1), np.datetime64("2025-11-24")])
    assert t[0] == 0.0
    assert abs(t[1] - 365 / 365.25) < 1e-12
    assert t[2] < 0


def test_round_trip():
    assert from_years(to_years(["2026-07-04"])[0]) == dt.date(2026, 7, 4)