import datetime as dt

import numpy as np
import pytest

from analysis.stations import _vertical_comparison


def test_late_gps_uses_shared_start_and_requires_final_radar_sample():
    dates = [dt.date(2025, 1, 1) + dt.timedelta(days=12 * k) for k in range(26)]
    radar = np.arange(26) * 0.01
    gps = np.arange(26) * 0.006
    gps[:2] = np.nan
    _, comparison = _vertical_comparison(gps, radar, dates, 0.05)
    assert comparison["net_m"] == pytest.approx(23 * 0.004)
    assert comparison["pairs_rms_m"] == pytest.approx(0.004)
    assert comparison["n_pairs"] == 23
    radar[-1] = np.nan
    assert _vertical_comparison(gps, radar, dates, 0.05)[1]["net_m"] is None


def test_gps_bootstrap_includes_last_block_and_rejects_insufficient_samples(monkeypatch):
    from gps.scripts.build_gps_los import fit_row

    days = [dt.date(2025, 1, 1) + dt.timedelta(days=k) for k in range(42)]
    values = np.sin(np.arange(42) * 0.5) * 0.001
    with pytest.raises(ValueError, match="more than 21"):
        fit_row("TEST", "los", days[:21], values[:21])
    seen = []
    class LastBlock:
        def choice(self, starts, count):
            seen.append(starts[-1])
            return np.full(count, starts[-1])
    monkeypatch.setattr(np.random, "default_rng", lambda _: LastBlock())
    result = fit_row("TEST", "los", days, values)
    assert seen and all(start == 21 for start in seen)
    assert np.isfinite(float(result["trend_sigma_m_per_yr"]))
