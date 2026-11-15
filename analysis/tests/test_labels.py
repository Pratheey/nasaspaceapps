import numpy as np

from analysis import labels as L


def test_all_label_rules():
    sigma = 0.01
    net =      np.array([-0.05, 0.005, -0.05, 0.005, np.nan, 0.05, 0.05])
    seasonal = np.array([True,  True,  False, False, True,   False, True])
    out = L.label(net, sigma, seasonal)
    assert out.tolist() == [
        L.SEASONAL_WITH_SINKING,       # seasonal + sinking
        L.SEASONAL_NO_TREND,           # seasonal + within 2 sigma
        L.SINKING_SEASONAL_UNCERTAIN,  # sinking, wave not significant
        L.INSUFFICIENT,                # nothing resolved
        L.INSUFFICIENT,                # masked
        L.INSUFFICIENT,                # uplift beyond 2 sigma: no v1 label
        L.INSUFFICIENT,                # uplift beyond 2 sigma with seasonal: no v1 label
    ]


def test_label_text_matches_contract_samples():
    import json
    from pathlib import Path

    meta = json.loads((Path(__file__).resolve().parents[2] / "contracts/samples/meta.json").read_text(encoding="utf-8"))
    assert meta["labels"] == L.LABEL_TEXT