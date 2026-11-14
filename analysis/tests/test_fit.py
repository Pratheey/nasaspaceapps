import numpy as np

from analysis import fit, synthetic

TRUTH = (-0.06, 0.003, 0.002)  # B (m/yr), a (m), b (m): roughly P307-like


def test_noiseless_fit_recovers_exact_values():
    """The hour 0-2 goal: known B, a, b in -> the same B, a, b out."""
    t_ref, t_sec, d, _ = synthetic.single_pixel_pairs(*TRUTH)
    r = fit.fit_pairs(d, t_ref, t_sec)
    assert np.allclose([r.B, r.a, r.b], TRUTH, atol=1e-10)
    assert r.n_pairs == 25


def test_noisy_fit_is_unbiased_and_sigma_is_honest():
    """With noise, single fits scatter; on average they hit the truth, and the
    reported sigma of B matches the real scatter of B across trials."""
    est, sig = [], []
    for seed in range(300):
        t_ref, t_sec, d, _ = synthetic.single_pixel_pairs(*TRUTH, noise_sd=0.003, seed=seed)
        r = fit.fit_pairs(d, t_ref, t_sec)
        est.append([r.B, r.a, r.b]); sig.append(r.sigma_B)
    est = np.array(est)
    sem = est.std(axis=0) / np.sqrt(len(est))
    assert np.all(np.abs(est.mean(axis=0) - TRUTH) < 4 * sem)
    ratio = np.mean(sig) / est[:, 0].std()
    print("reported sigma_B / actual scatter:", round(float(ratio), 3))
    assert 0.8 < ratio < 1.25


def test_missing_pairs_are_skipped_not_fatal():
    t_ref, t_sec, d, _ = synthetic.single_pixel_pairs(*TRUTH)
    d[[3, 10, 17]] = np.nan
    r = fit.fit_pairs(d, t_ref, t_sec)
    assert r.n_pairs == 22
    assert np.allclose([r.B, r.a, r.b], TRUTH, atol=1e-10)


def test_too_few_pairs_gives_nan():
    t_ref, t_sec, d, _ = synthetic.single_pixel_pairs(*TRUTH)
    d[5:] = np.nan
    r = fit.fit_pairs(d, t_ref, t_sec)
    assert np.isnan(r.B) and r.n_pairs == 0


def test_excluded_pair_is_dropped():
    t_ref, t_sec, d, _ = synthetic.single_pixel_pairs(*TRUTH)
    d[7] += 0.12  # a fake unwrapping error (~one L-band cycle)
    excl = np.zeros(len(d), bool); excl[7] = True
    r = fit.fit_pairs(d, t_ref, t_sec, exclude_pairs=excl)
    assert np.allclose([r.B, r.a, r.b], TRUTH, atol=1e-10)


def test_stack_fit_matches_single_pixel_fit():
    t_ref, t_sec, d1, _ = synthetic.single_pixel_pairs(*TRUTH, noise_sd=0.003, seed=1)
    _, _, d2, _ = synthetic.single_pixel_pairs(-0.01, 0.0, 0.004, noise_sd=0.003, seed=2)
    d2[4] = np.nan
    stack = fit.fit_stack(np.column_stack([d1, d2]), t_ref, t_sec)
    for i, d in enumerate([d1, d2]):
        one = fit.fit_pairs(d, t_ref, t_sec)
        assert np.allclose([stack.B[i], stack.a[i], stack.b[i]], [one.B, one.a, one.b])


def test_complete_chain_equals_cumulative_fit():
    """Sanity check of the weighting: with no gaps, the pairwise fit equals fitting
    c + B t + a sin + b cos directly to the cumulative series."""
    t_ref, t_sec, d, dates = synthetic.single_pixel_pairs(*TRUTH, noise_sd=0.003, seed=5)
    r = fit.fit_pairs(d, t_ref, t_sec)
    t = np.concatenate([t_ref[:1], t_sec])
    u = np.concatenate([[0.0], np.cumsum(d)])
    X = np.column_stack([np.ones_like(t), t, np.sin(2 * np.pi * t), np.cos(2 * np.pi * t)])
    coef, *_ = np.linalg.lstsq(X, u, rcond=None)
    assert np.allclose([r.B, r.a, r.b], coef[1:], atol=1e-12)


def test_offset_puts_curve_at_zero_on_first_date():
    c = fit.offset_for_first_date(-0.1, *TRUTH)
    assert abs(fit.model(-0.1, *TRUTH, c)) < 1e-15