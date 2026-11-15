"""Trend guard: hide fits we cannot trust.

With less than a year of data, the fit has to tell a steady trend B from one yearly wave
(a, b). If a cell's usable pairs miss a whole season, many combinations fit equally well and
the solver lands on extreme ones (trends of +-1 m/yr). The fit "knows": its own sigma of B is
huge. Showing those numbers would mislead, so the guard hides the WHOLE fit for that cell
(trend, amplitude, peak month, fitted curve): they come from the same unreliable solve.

A cell keeps its fit only if ALL hold:
  1. its usable pairs cover all four seasons (Dec-Feb, Mar-May, Jun-Aug, Sep-Nov),
  2. it has at least MIN_PAIRS usable pairs,
  3. sigma of the trend <= MAX_SIGMA_TREND_M_PER_YR.

Cut-offs from the first real stack (v2, 2026-11-14): cells covering all 4 seasons have a
median sigma_B of 2.2 cm/yr and none has |B| > 30 cm/yr; cells covering 3 seasons have a
median sigma_B of 41.5 cm/yr and 62% have |B| > 30 cm/yr. All 1,551 cells with |B| > 30 cm/yr
miss a season and have sigma_B > 5 cm/yr. Every GPS station cell passes (sigma_B about 2 cm/yr).

What it does NOT touch: net change (model-free) and therefore the sinking part of the labels.
A hidden fit means "seasonal term unknown", so a sinking cell becomes label 3, never label 1.
"""
from __future__ import annotations

import dataclasses
from dataclasses import dataclass

import numpy as np

from .fit import FitResult
from .timebase import from_years

MAX_SIGMA_TREND_M_PER_YR = 0.05
MIN_PAIRS = 15
SEASONS = ("Dec-Feb", "Mar-May", "Jun-Aug", "Sep-Nov")


def season_of_pair(t_ref, t_sec) -> np.ndarray:
    """Season index (0 = Dec-Feb ... 3 = Sep-Nov) of each pair's midpoint date."""
    mids = (np.asarray(t_ref, dtype=float) + np.asarray(t_sec, dtype=float)) / 2
    return np.array([(from_years(m).month % 12) // 3 for m in mids])


def seasons_covered(used, t_ref, t_sec) -> np.ndarray:
    """used: (n_pairs, ...) bool, True where a pair was usable for that cell. Returns count 0-4."""
    used = np.asarray(used, dtype=bool)
    season = season_of_pair(t_ref, t_sec)
    covered = np.zeros((4,) + used.shape[1:], dtype=bool)
    for s in range(4):
        rows = season == s
        if rows.any():
            covered[s] = used[rows].any(axis=0)
    return covered.sum(axis=0)


@dataclass
class GuardResult:
    ok: np.ndarray                 # bool per cell: fit is trusted
    n_seasons: np.ndarray          # seasons covered per cell
    counts: dict                   # how many fitted cells each rule removes (rules can overlap)
    max_sigma_trend_m_per_yr: float
    min_pairs: int

    def describe(self) -> str:
        c = self.counts
        return (f"Trend guard: fit kept only where pairs cover all 4 seasons, >= {self.min_pairs} pairs, "
                f"sigma of trend <= {self.max_sigma_trend_m_per_yr * 100:.0f} cm/yr. Hidden in "
                f"{c['hidden']} of {c['fitted']} fitted cells (missing a season: {c['missing_season']}, "
                f"too few pairs: {c['too_few_pairs']}, sigma too large: {c['sigma_too_large']}).")


def trend_guard(fit: FitResult, used, t_ref, t_sec,
                max_sigma: float = MAX_SIGMA_TREND_M_PER_YR, min_pairs: int = MIN_PAIRS) -> GuardResult:
    fitted = np.asarray(fit.fitted)
    n_seasons = seasons_covered(used, t_ref, t_sec)
    missing = n_seasons < 4
    few = np.asarray(fit.n_pairs) < min_pairs
    with np.errstate(invalid="ignore"):
        big = ~(np.asarray(fit.sigma_B) <= max_sigma)
    ok = fitted & ~missing & ~few & ~big
    counts = {"fitted": int(fitted.sum()), "hidden": int((fitted & ~ok).sum()),
              "missing_season": int((fitted & missing).sum()), "too_few_pairs": int((fitted & few).sum()),
              "sigma_too_large": int((fitted & big).sum())}
    return GuardResult(ok, n_seasons, counts, max_sigma, min_pairs)


def apply(fit: FitResult, ok) -> FitResult:
    """A copy of the fit with every value set to NaN where the guard failed."""
    ok = np.asarray(ok, dtype=bool)
    nan = lambda arr: np.where(ok, arr, np.nan)
    return dataclasses.replace(
        fit, B=nan(fit.B), a=nan(fit.a), b=nan(fit.b), cov=np.where(ok[..., None, None], fit.cov, np.nan),
        rss=nan(fit.rss), rss_trend_only=nan(fit.rss_trend_only), n_pairs=np.where(ok, fit.n_pairs, 0))
