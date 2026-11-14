"""Model-free motion: running position and first-to-last net change.

The stack gives STEPS (pair k = motion from date k to date k+1). Adding them up gives
POSITION relative to the first date:

    steps:       -0.4  +0.1  -0.3  +0.2  -0.5      (pairs)
    cumulative:  0  -0.4  -0.3  -0.6  -0.4  -0.9   (dates; first is always 0)
    net change:  -0.9                              (last cumulative value)

A missing step makes every later position unknown (NaN), never interpolated (D3).
"""
from __future__ import annotations

import numpy as np

from .timebase import to_date


def check_chain(ref_dates, sec_dates) -> list:
    """Check the pairs form a sequential chain (sec of pair k == ref of pair k+1) and
    return the list of dates (n_pairs + 1). Raises ValueError otherwise."""
    ref = [to_date(d) for d in ref_dates]
    sec = [to_date(d) for d in sec_dates]
    if len(ref) != len(sec) or not ref:
        raise ValueError("ref_dates and sec_dates must be the same, non-zero length")
    for k in range(len(ref)):
        if sec[k] <= ref[k]:
            raise ValueError(f"pair {k + 1}: sec_date {sec[k]} is not after ref_date {ref[k]}")
        if k + 1 < len(ref) and ref[k + 1] != sec[k]:
            raise ValueError(f"pairs {k + 1}->{k + 2} break the chain: {sec[k]} != {ref[k + 1]}")
    return [ref[0]] + sec


def cumulative(disp) -> np.ndarray:
    """(n_pairs, ...) steps -> (n_pairs + 1, ...) positions relative to the first date.
    The first value is 0, or NaN where the cell has no valid pair at all."""
    disp = np.asarray(disp, dtype=float)
    no_data = np.all(~np.isfinite(disp), axis=0)
    first = np.where(no_data, np.nan, 0.0)[None, ...]
    return np.concatenate([first, np.cumsum(disp, axis=0)], axis=0)  # NaN propagates forward


def net_change(disp) -> np.ndarray:
    """First-to-last displacement (m). NaN if any pair is missing at that cell."""
    return cumulative(disp)[-1]


def n_valid_dates(cum) -> np.ndarray:
    """How many dates have a known position (for grid.json n_valid_dates)."""
    return np.isfinite(cum).sum(axis=0)