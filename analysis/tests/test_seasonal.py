import numpy as np

from analysis import fit, seasonal, synthetic


def test_peak_month_and_amplitude_for_known_wave():
    phase = 2 * np.pi * (2.5 / 12)            # peak 2.5 months after 1 Jan -> mid March
    A = 0.005
    a, b = A * np.sin(phase), A * np.cos(phase)
    assert seasonal.peak_month(np.array(a), np.array(b)) == 3
    amp, _ = seasonal.amplitude(np.array(a), np.array(b), np.zeros((2, 2)))
    assert abs(amp - A) < 1e-15


def test_peak_month_edges():
    assert seasonal.peak_month(np.array(0.0), np.array(1.0)) == 1     # peak on 1 Jan
    assert seasonal.peak_month(np.array(0.0), np.array(-1.0)) == 7    # half a year later


def _many(B, a, b, noise_sd, n=400):
    t_ref, t_sec, _, dates = synthetic.single_pixel_pairs(B, a, b)
    D = np.column_stack([synthetic.single_pixel_pairs(B, a, b, noise_sd, seed=s)[2] for s in range(n)])
    return seasonal.evaluate(fit.fit_stack(D, t_ref, t_sec))


def test_strong_wave_is_significant():
    s = _many(-0.06, 0.006, 0.004, noise_sd=0.002, n=50)
    assert s.significant.mean() > 0.95
    assert np.all(np.isfinite(s.amp[s.significant]))


def test_noise_only_is_rarely_significant_and_hidden():
    s = _many(-0.02, 0.0, 0.0, noise_sd=0.004)
    rate = s.significant.mean()
    print("false-positive rate:", rate)
    assert 0.01 < rate < 0.10   # should be close to alpha = 0.05
    assert np.all(np.isnan(s.amp[~s.significant]))
    assert np.all(np.isnan(s.peak_month[~s.significant]))

def test_calibration_tames_over_firing_control_cells():
    """Mimic D5's real-data problem: 'stable' cells carry small fake waves (atmosphere-like)
    that the plain F-test calls significant. Calibration must cut their pass rate to <= 5%
    while a real 8 mm wave still passes."""
    rng = np.random.default_rng(0)
    t_ref, t_sec, _, _ = synthetic.single_pixel_pairs(0, 0, 0)
    n_ctrl, n_real = 200, 50
    cols = []
    for k in range(n_ctrl):
        A = rng.uniform(0.0, 0.003); ph = rng.uniform(0, 2 * np.pi)
        cols.append(synthetic.single_pixel_pairs(0.0, A * np.sin(ph), A * np.cos(ph), 0.001, seed=k)[2])
    for k in range(n_real):
        cols.append(synthetic.single_pixel_pairs(-0.05, 0.008 * np.sin(1.3), 0.008 * np.cos(1.3), 0.001, seed=1000 + k)[2])
    f = fit.fit_stack(np.column_stack(cols), t_ref, t_sec)
    control = np.r_[np.ones(n_ctrl, bool), np.zeros(n_real, bool)]

    c = seasonal.calibrate_amplitude_threshold(f, control)
    print("raw control pass rate:", c.raw_pass_rate, "-> calibrated:", c.pass_rate, "threshold m:", c.amp_threshold_m)
    assert c.raw_pass_rate > 0.3                 # the plain test over-fires here
    assert c.pass_rate <= 0.05
    s = seasonal.evaluate(f, amp_threshold_m=c.amp_threshold_m)
    assert s.significant[control].mean() <= 0.05
    assert s.significant[~control].mean() > 0.95


def test_too_few_control_cells_cannot_calibrate():
    t_ref, t_sec, d, _ = synthetic.single_pixel_pairs(0, 0.002, 0, 0.001)
    f = fit.fit_stack(np.column_stack([d] * 5), t_ref, t_sec)
    c = seasonal.calibrate_amplitude_threshold(f, np.ones(5, bool))
    assert c.amp_threshold_m is None and c.n_control == 5


def test_control_mask_boxes():
    m = seasonal.control_mask([36.90, 36.00, 36.50], [-119.45, -120.55, -120.00])
    assert m.tolist() == [True, True, False]
