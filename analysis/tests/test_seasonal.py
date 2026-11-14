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