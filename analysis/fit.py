"""Pairwise seasonal + trend fit (docs/PROPOSAL.md section 5).

Model for position (t in years since 2026-01-01, period T = 1 year):

    u(t) = c + B*t + a*sin(2*pi*t) + b*cos(2*pi*t)

The radar only gives differences between two dates, so for each pair i -> j:

    d_ij = u(t_j) - u(t_i)
         = B*(t_j - t_i) + a*[sin(2*pi*t_j) - sin(2*pi*t_i)] + b*[cos(2*pi*t_j) - cos(2*pi*t_i)]

c cancels. Each pair is one row of G, and each unknown (B, a, b) owns one column:

    G = [ dt , dsin , dcos ]        solve   G @ [B, a, b] ~= d   by least squares.

a and b together are ONE yearly wave: a*sin + b*cos = A*sin(2*pi*t + phase), with
A = sqrt(a^2 + b^2). Writing it as a and b keeps the problem linear. seasonal.py turns
a and b back into amplitude and peak month.

Weighting (why this is generalised, not plain, least squares)
-------------------------------------------------------------
Most of the noise belongs to a DATE (that day's atmosphere/ionosphere residual), not to a
pair. Pair k = date k+1 minus date k, so neighbouring pairs share a date and their noise
is correlated: each date's error appears once with + and once with -. Plain least squares
ignores that and loses most of the information (tests showed a clear 7 mm wave detected
only ~20% of the time). So we use the noise covariance implied by the pair network:

    M[k, date] = -1 at the pair's ref date, +1 at its sec date      C = M @ M.T

and whiten with C before solving. The equation and the columns are unchanged. For a
complete chain this equals fitting the cumulative series; unlike that, it still works
pair by pair when some pairs are missing. sigma^2 (per-date noise variance) is estimated
from the whitened residuals. The uncertainty the app headlines still comes from the GPS
residuals (Daniel, H-9), as the proposal requires.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.linalg import cho_factor, solve_triangular

TWO_PI = 2.0 * np.pi
MIN_PAIRS = 8  # fewer usable pairs than this -> no fit (left as NaN)


def design_matrix(t_ref, t_sec) -> np.ndarray:
    """One row per pair, columns [dt, dsin, dcos]. Same for every pixel (depends only on dates)."""
    t_ref = np.asarray(t_ref, dtype=float)
    t_sec = np.asarray(t_sec, dtype=float)
    return np.column_stack([
        t_sec - t_ref,
        np.sin(TWO_PI * t_sec) - np.sin(TWO_PI * t_ref),
        np.cos(TWO_PI * t_sec) - np.cos(TWO_PI * t_ref),
    ])


def pair_noise_covariance(t_ref, t_sec) -> np.ndarray:
    """C = M M^T (in units of the per-date noise variance) for any pair network."""
    t_ref = np.asarray(t_ref, dtype=float)
    t_sec = np.asarray(t_sec, dtype=float)
    dates, inv = np.unique(np.concatenate([t_ref, t_sec]), return_inverse=True)
    n = len(t_ref)
    M = np.zeros((n, len(dates)))
    M[np.arange(n), inv[:n]] = -1.0
    M[np.arange(n), inv[n:]] = 1.0
    return M @ M.T


def model(t, B, a, b, c=0.0):
    """Position u(t) from fitted parameters (used to draw the fitted curve)."""
    t = np.asarray(t, dtype=float)
    return c + B * t + a * np.sin(TWO_PI * t) + b * np.cos(TWO_PI * t)


def offset_for_first_date(t_first, B, a, b):
    """The c that makes model(t_first) = 0, so the curve lines up with the cumulative
    series (whose first value is 0). The pairwise fit cannot see c, so we choose it."""
    return -(B * t_first + a * np.sin(TWO_PI * t_first) + b * np.cos(TWO_PI * t_first))


@dataclass
class FitResult:
    """Fit output. Fields are arrays over cells (or 0-d arrays for one pixel). NaN = not fitted."""

    B: np.ndarray               # trend, m/yr (never the headline)
    a: np.ndarray               # sine coefficient, m
    b: np.ndarray               # cosine coefficient, m
    cov: np.ndarray             # (..., 3, 3) covariance of [B, a, b]
    rss: np.ndarray             # whitened residual sum of squares, full model
    rss_trend_only: np.ndarray  # same for a B-only fit; the F-test compares the two
    n_pairs: np.ndarray         # number of pairs actually used

    @property
    def fitted(self) -> np.ndarray:
        return np.isfinite(self.B)

    @property
    def dof(self) -> np.ndarray:
        return self.n_pairs - 3

    @property
    def sigma_B(self) -> np.ndarray:
        return np.sqrt(self.cov[..., 0, 0])

    @property
    def noise_sd(self) -> np.ndarray:
        """Estimated per-date noise (m) from the whitened residuals."""
        with np.errstate(invalid="ignore", divide="ignore"):
            return np.sqrt(self.rss / self.dof)


def fit_stack(disp, t_ref, t_sec, min_pairs: int = MIN_PAIRS, exclude_pairs=None) -> FitResult:
    """Fit every cell at once.

    disp: (n_pairs, ...) pair displacements in metres, NaN where missing.
    t_ref, t_sec: (n_pairs,) pair dates in years (timebase.to_years).
    exclude_pairs: optional bool array (n_pairs,), True = drop this pair from the fit
        everywhere (e.g. pairs Daniel flags as ~12 cm unwrapping errors).

    Cells are grouped by which pairs they have, so each group is solved in one numpy
    call. A missing pair only removes that one row; the fit still uses the rest.
    """
    G = design_matrix(t_ref, t_sec)
    C = pair_noise_covariance(t_ref, t_sec)

    disp = np.asarray(disp, dtype=float)
    npair = disp.shape[0]
    spatial = disp.shape[1:]
    D = disp.reshape(npair, -1)
    ncell = D.shape[1]

    ok = np.isfinite(D)
    if exclude_pairs is not None:
        ok[np.asarray(exclude_pairs, dtype=bool)] = False

    B = np.full(ncell, np.nan); a = np.full(ncell, np.nan); b = np.full(ncell, np.nan)
    cov = np.full((ncell, 3, 3), np.nan)
    rss = np.full(ncell, np.nan); rss0 = np.full(ncell, np.nan)
    n_used = ok.sum(axis=0)

    patterns, inverse = np.unique(ok.T, axis=0, return_inverse=True)
    inverse = np.asarray(inverse).reshape(-1)
    for k, pattern in enumerate(patterns):
        n = int(pattern.sum())
        if n < max(min_pairs, 4):
            continue
        cells = np.flatnonzero(inverse == k)

        # whiten: L L^T = C restricted to the pairs this group has
        L = cho_factor(C[np.ix_(pattern, pattern)], lower=True)[0]
        Gw = solve_triangular(L, G[pattern], lower=True)
        if np.linalg.matrix_rank(Gw) < 3:
            continue
        Dw = solve_triangular(L, D[pattern][:, cells], lower=True)  # (n, m)

        coef, *_ = np.linalg.lstsq(Gw, Dw, rcond=None)              # (3, m)
        rss_k = ((Dw - Gw @ coef) ** 2).sum(axis=0)
        inv = np.linalg.inv(Gw.T @ Gw)

        g0 = Gw[:, :1]                                              # trend-only model
        c0, *_ = np.linalg.lstsq(g0, Dw, rcond=None)
        rss0_k = ((Dw - g0 @ c0) ** 2).sum(axis=0)

        B[cells], a[cells], b[cells] = coef
        cov[cells] = (rss_k / (n - 3))[:, None, None] * inv
        rss[cells] = rss_k
        rss0[cells] = rss0_k

    n_used = np.where(np.isfinite(B), n_used, 0)
    return FitResult(
        B=B.reshape(spatial), a=a.reshape(spatial), b=b.reshape(spatial),
        cov=cov.reshape(spatial + (3, 3)), rss=rss.reshape(spatial),
        rss_trend_only=rss0.reshape(spatial), n_pairs=n_used.reshape(spatial),
    )


def fit_pairs(d, t_ref, t_sec, min_pairs: int = MIN_PAIRS, exclude_pairs=None) -> FitResult:
    """Fit one pixel: d is (n_pairs,). Same maths as fit_stack, returns 0-d values."""
    res = fit_stack(np.asarray(d, dtype=float)[:, None], t_ref, t_sec, min_pairs, exclude_pairs)
    return FitResult(**{name: value[0] for name, value in vars(res).items()})