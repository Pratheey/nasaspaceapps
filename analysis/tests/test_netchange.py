import numpy as np
import pytest

from analysis import netchange


def test_cumulative_and_net_example():
    steps = np.array([-0.4, 0.1, -0.3, 0.2, -0.5])
    cum = netchange.cumulative(steps)
    assert np.allclose(cum, [0, -0.4, -0.3, -0.6, -0.4, -0.9])
    assert np.isclose(netchange.net_change(steps), -0.9)


def test_missing_step_makes_later_dates_missing():
    steps = np.array([-0.4, np.nan, -0.3])
    cum = netchange.cumulative(steps)
    assert np.allclose(cum[:2], [0, -0.4]) and np.all(np.isnan(cum[2:]))
    assert np.isnan(netchange.net_change(steps))
    assert netchange.n_valid_dates(cum) == 2


def test_all_missing_cell_has_null_first_value():
    cum = netchange.cumulative(np.full((3, 2), np.nan))
    assert np.all(np.isnan(cum))


def test_check_chain():
    dates = netchange.check_chain(["2025-11-24", "2025-12-06"], ["2025-12-06", "2025-12-18"])
    assert [d.isoformat() for d in dates] == ["2025-11-24", "2025-12-06", "2025-12-18"]
    with pytest.raises(ValueError):
        netchange.check_chain(["2025-11-24", "2025-12-18"], ["2025-12-06", "2025-12-30"])