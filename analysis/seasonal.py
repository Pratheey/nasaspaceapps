"""Is the yearly wave real, how big is it, and when does it peak?

Inputs come from fit.py (a, b, their covariance, and the two RSS values).

- F-test: compare the full model (B, a, b) with a trend-only model (B). If adding the
  wave shrinks the misfit much more than noise would, the wave is significant:
      F = [(RSS_trend_only - RSS_full) / 2] / [RSS_full / (n - 3)]
      p = P(F(2, n-3) > F)
- Amplitude A = sqrt(a^2 + b^2). Biased upward in noise, so only shown if significant.
- Peak: a*sin(x) + b*cos(x) is largest at x = atan2(a, b), so the peak is at
  t = atan2(a, b) / (2*pi) years after 1 January (mod 1).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import stats

from .fit import FitResult
from .timebase import DAYS_PER_YEAR

ALPHA = 0.05


def f_test(rss_full, rss_reduced, n_pairs, n_extra: int = 2, n_params_full: int = 3):
    """Joint F-test on the extra parameters (a, b). Returns (F, p). NaN where not fitted."""
    rss_full = np.asarray(rss_full, dtype=float)
    rss_reduced = np.asarray(rss_reduced, dtype=float)
    dof = np.asarray(n_pairs, dtype=float) - n_params_full
    with np.errstate(invalid="ignore", divide="ignore"):
        F = ((rss_reduced - rss_full) / n_extra) / (rss_full / dof)
        p = stats.f.sf(F, n_extra, np.where(dof > 0, dof, np.nan))
    return F, p


def amplitude(a, b, cov_ab):
    """A = sqrt(a^2 + b^2) and its 1-sigma (first-order error propagation).

    cov_ab: (..., 2, 2) covariance of [a, b] (fit.cov[..., 1:, 1:]).
    """
    a = np.asarray(a, dtype=float); b = np.asarray(b, dtype=float)
    A = np.hypot(a, b)
    var = a * a * cov_ab[..., 0, 0] + b * b * cov_ab[..., 1, 1] + 2 * a * b * cov_ab[..., 0, 1]
    with np.errstate(invalid="ignore", divide="ignore"):
        sigma = np.sqrt(np.maximum(var, 0.0)) / A
    return A, sigma


def peak_fraction_of_year(a, b):
    """Where in the year (0..1, from 1 January) the wave is highest."""
    return (np.arctan2(a, b) / (2 * np.pi)) % 1.0


def peak_month(a, b):
    """Calendar month (1..12) of the seasonal maximum, as float (NaN where a or b is NaN)."""
    frac = np.asarray(peak_fraction_of_year(a, b), dtype=float)
    out = np.full(frac.shape, np.nan)
    ok = np.isfinite(frac)
    days = np.floor(frac[ok] * DAYS_PER_YEAR).astype("timedelta64[D]")
    months = (np.datetime64("2026-01-01") + days).astype("datetime64[M]").astype(int) % 12 + 1
    out[ok] = months
    return out


@dataclass
class SeasonalResult:
    f_stat: np.ndarray
    p_value: np.ndarray
    significant: np.ndarray   # bool; False where not fitted (see `fitted`)
    fitted: np.ndarray        # bool; False -> app shows seasonal_significant = null
    amp: np.ndarray           # m; NaN where not significant
    amp_sigma: np.ndarray     # m; NaN where not significant
    peak_month: np.ndarray    # 1..12 as float; NaN where not significant


def evaluate(fit: FitResult, alpha: float = ALPHA) -> SeasonalResult:
    """Run the F-test and, only where it passes, report amplitude and peak month."""
    F, p = f_test(fit.rss, fit.rss_trend_only, fit.n_pairs)
    fitted = np.asarray(fit.fitted)
    significant = fitted & (np.nan_to_num(p, nan=1.0) < alpha)
    A, sA = amplitude(fit.a, fit.b, fit.cov[..., 1:, 1:])
    pm = peak_month(fit.a, fit.b)
    hide = ~significant
    return SeasonalResult(
        f_stat=F, p_value=p, significant=significant, fitted=fitted,
        amp=np.where(hide, np.nan, A), amp_sigma=np.where(hide, np.nan, sA),
        peak_month=np.where(hide, np.nan, pm),
    )