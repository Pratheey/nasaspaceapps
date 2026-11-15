import numpy as np

from analysis import export, fit, guards, labels, seasonal, synthetic, timebase

TRUTH = (-0.06, 0.006, 0.004)


def _pairs(noise=0.003, seed=0):
    t_ref, t_sec, d, dates = synthetic.single_pixel_pairs(*TRUTH, noise_sd=noise, seed=seed)
    return t_ref, t_sec, d


def test_season_of_pair():
    t = timebase.to_years(["2025-12-15", "2026-04-15", "2026-07-15", "2026-10-15"])
    assert guards.season_of_pair(t, t).tolist() == [0, 1, 2, 3]


def test_complete_cell_passes():
    t_ref, t_sec, d = _pairs()
    f = fit.fit_stack(d[:, None], t_ref, t_sec)
    g = guards.trend_guard(f, np.isfinite(d)[:, None], t_ref, t_sec)
    assert g.ok.tolist() == [True] and g.n_seasons.tolist() == [4]


def test_missing_spring_is_hidden():
    """A cell that lost every spring pair (e.g. irrigated fields) cannot separate trend from wave."""
    t_ref, t_sec, d = _pairs()
    spring = guards.season_of_pair(t_ref, t_sec) == 1
    d[spring] = np.nan
    f = fit.fit_stack(d[:, None], t_ref, t_sec)
    g = guards.trend_guard(f, np.isfinite(d)[:, None], t_ref, t_sec)
    assert g.n_seasons.tolist() == [3] and g.ok.tolist() == [False]
    assert g.counts["missing_season"] == 1


def test_large_sigma_is_hidden():
    t_ref, t_sec, d = _pairs(noise=0.08, seed=3)          # 8 cm per date: hopeless
    f = fit.fit_stack(d[:, None], t_ref, t_sec)
    assert f.sigma_B[0] > guards.MAX_SIGMA_TREND_M_PER_YR
    g = guards.trend_guard(f, np.isfinite(d)[:, None], t_ref, t_sec)
    assert g.ok.tolist() == [False] and g.counts["sigma_too_large"] == 1


def test_hidden_fit_becomes_unknown_everywhere():
    t_ref, t_sec, d = _pairs()
    D = np.column_stack([d, d])
    f = fit.fit_stack(D, t_ref, t_sec)
    gf = guards.apply(f, np.array([True, False]))
    assert np.isfinite(gf.B[0]) and np.isnan(gf.B[1]) and np.isnan(gf.cov[1]).all()
    s = seasonal.evaluate(gf)
    assert export.bools(s.significant, s.fitted) == [bool(s.significant[0]), None]   # null in grid.json
    assert np.isnan(s.amp[1]) and np.isnan(s.peak_month[1])


def test_hidden_fit_never_makes_label_1():
    """Sinking cell, unreliable fit: 'seasonal component uncertain' (3), not 'seasonal + sinking' (1)."""
    lab = labels.label(np.array([-0.10, -0.10]), 0.0175, np.array([True, False]))
    assert lab.tolist() == [labels.SEASONAL_WITH_SINKING, labels.SINKING_SEASONAL_UNCERTAIN]


def test_mixed_stack_counts():
    rng = np.random.default_rng(1)
    t_ref, t_sec, _ = _pairs()
    cols, spring = [], guards.season_of_pair(t_ref, t_sec) == 1
    for k in range(30):
        d = _pairs(seed=k)[2]
        if k % 3 == 0:
            d[spring] = np.nan
        cols.append(d)
    D = np.column_stack(cols)
    f = fit.fit_stack(D, t_ref, t_sec)
    g = guards.trend_guard(f, np.isfinite(D), t_ref, t_sec)
    assert g.counts["hidden"] == 10 and g.ok.sum() == 20
    assert "Hidden in 10 of 30 fitted cells" in g.describe()
