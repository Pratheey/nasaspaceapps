"""The 4 map labels (docs/PROPOSAL.md section 5, contracts/app_data.md).

Inputs per cell: net change (m), its 1-sigma (m, from Daniel's GPS check), and whether
the seasonal term passed the F-test.

    sinking = net < -2*sigma          within = |net| <= 2*sigma
    1  seasonal and sinking   -> "Seasonal movement with persistent sinking"
    2  seasonal and within    -> "Seasonal movement, no resolved trend"
    3  sinking, not seasonal  -> "Persistent sinking, seasonal component uncertain"
    0  everything else, incl. masked cells and uplift beyond 2 sigma (no label for it in v1)
"""
from __future__ import annotations

import numpy as np

INSUFFICIENT = 0
SEASONAL_WITH_SINKING = 1
SEASONAL_NO_TREND = 2
SINKING_SEASONAL_UNCERTAIN = 3

LABEL_TEXT = {
    "0": "Insufficient evidence",
    "1": "Seasonal movement with persistent sinking",
    "2": "Seasonal movement, no resolved trend",
    "3": "Persistent sinking, seasonal component uncertain",
}


def label(net_m, sigma_net_m, seasonal_significant) -> np.ndarray:
    """Return an int8 label code per cell."""
    net = np.asarray(net_m, dtype=float)
    sigma = np.broadcast_to(np.asarray(sigma_net_m, dtype=float), net.shape)
    seasonal = np.asarray(seasonal_significant, dtype=bool)

    known = np.isfinite(net) & np.isfinite(sigma)
    sinking = known & (net < -2 * sigma)
    within = known & (np.abs(net) <= 2 * sigma)

    out = np.full(net.shape, INSUFFICIENT, dtype=np.int8)
    out[sinking & ~seasonal] = SINKING_SEASONAL_UNCERTAIN
    out[within & seasonal] = SEASONAL_NO_TREND
    out[sinking & seasonal] = SEASONAL_WITH_SINKING
    return out