"""Is the yearly wave real, how big is it, and when does it peak?

Inputs come from fit.py (a, b, their covariance, and the two RSS values).

- F-test: compare the full model (B, a, b) with a trend-only model (B). If adding the
  wave shrinks the misfit much more than noise would, the wave is significant:
      F = [(RSS_trend_only - RSS_full) / 2] / [RSS_full / (n - 3)]
      p = P(F(2, n-3) > F)
- Amplitude A = sqrt(a^2 + b^2). Biased upward in noise, so only shown if significant.
- Peak: a*sin(x) + b*cos(x) is largest at x = atan2(a, b), so the peak is at
  t = atan2(a, b) / (2*pi) years after 1 January (mod 1).
- Calibration (D5): on real data the F-test alone finds "seasonal" motion on bedrock. A cell
  therefore also needs A above a threshold calibrated on stable control areas, so that at
  most 5% of those areas pass both tests.
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


@dataclass(frozen=True)
class Box:
    """A lat/lon rectangle of ground that should not move (stable control area)."""
    name: str
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float


# D5: "hill cells at the window's north-east and south-west corners". Checked by Pratheek on the
# real stack (2026-11-14): north-east = 394 m median height, 98% valid in all 25 pairs, no anomaly
# flags; south-west = 714 m, 73% valid in all 25 pairs, no anomaly flags.
# D11 (2026-11-15): the north-east box is stable ground. Its apparent signal (+2.2 cm net, 15 mm
# "seasonal") is broad atmospheric error shared date by date with the valley floor next to it
# (correlation 0.90), so the box measures the error at the far side of the map; keep it.
# CAUTION: the south-west box sits on or next to the creeping section of the San Andreas fault, so
# it can have a steady TREND. That is fine here, because the seasonal test fits a trend and asks
# only whether the yearly wave is real. Never use these boxes as "zero-trend" ground.
STABLE_CONTROL_BOXES = (
    Box("north-east corner hills", 36.85, 36.95, -119.50, -119.40),
    Box("south-west corner hills", 35.95, 36.05, -120.60, -120.50),
)
TARGET_FALSE_RATE = 0.05
MIN_CONTROL_CELLS = 20


def control_mask(lat, lon, boxes=STABLE_CONTROL_BOXES) -> np.ndarray:
    lat = np.asarray(lat, dtype=float); lon = np.asarray(lon, dtype=float)
    m = np.zeros(lat.shape, dtype=bool)
    for b in boxes:
        m |= (lat >= b.lat_min) & (lat <= b.lat_max) & (lon >= b.lon_min) & (lon <= b.lon_max)
    return m


@dataclass
class Calibration:
    amp_threshold_m: float | None   # None = could not calibrate (too few control cells)
    n_control: int                   # fitted control cells used
    raw_pass_rate: float             # control cells passing the F-test alone
    pass_rate: float                 # control cells passing F-test AND amplitude threshold
    target_rate: float


def calibrate_amplitude_threshold(fit: FitResult, control, alpha: float = ALPHA,
                                  target_rate: float = TARGET_FALSE_RATE) -> Calibration:
    """The F-test alone over-fires on real data (D5: 'seasonal' on bedrock), because real noise
    is messier than the test assumes. So a cell also needs amplitude A > threshold, where the
    threshold is the smallest value that lets at most `target_rate` of the stable control
    cells pass both tests."""
    _, p = f_test(fit.rss, fit.rss_trend_only, fit.n_pairs)
    A, _ = amplitude(fit.a, fit.b, fit.cov[..., 1:, 1:])
    ctrl = np.asarray(control, dtype=bool) & np.asarray(fit.fitted)
    n = int(ctrl.sum())
    passing = ctrl & (np.nan_to_num(p, nan=1.0) < alpha)
    raw = float(passing.sum() / n) if n else float("nan")
    if n < MIN_CONTROL_CELLS:
        return Calibration(None, n, raw, raw, target_rate)
    allowed = int(np.floor(target_rate * n))
    amps = np.sort(A[passing])
    thr = 0.0 if len(amps) <= allowed else float(amps[len(amps) - allowed - 1])
    rate = float((passing & (A > thr)).sum() / n)
    return Calibration(thr, n, raw, rate, target_rate)


def evaluate(fit: FitResult, alpha: float = ALPHA, amp_threshold_m: float | None = None) -> SeasonalResult:
    """Run the F-test (plus the calibrated amplitude threshold, if given) and, only where it
    passes, report amplitude and peak month."""
    F, p = f_test(fit.rss, fit.rss_trend_only, fit.n_pairs)
    fitted = np.asarray(fit.fitted)
    A, sA = amplitude(fit.a, fit.b, fit.cov[..., 1:, 1:])
    significant = fitted & (np.nan_to_num(p, nan=1.0) < alpha)
    if amp_threshold_m is not None:
        significant &= np.nan_to_num(A, nan=0.0) > amp_threshold_m
    pm = peak_month(fit.a, fit.b)
    hide = ~significant
    return SeasonalResult(
        f_stat=F, p_value=p, significant=significant, fitted=fitted,
        amp=np.where(hide, np.nan, A), amp_sigma=np.where(hide, np.nan, sA),
        peak_month=np.where(hide, np.nan, pm),
    )
