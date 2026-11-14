"""End to end on the synthetic stack: files exist, match the contract shape, and make sense."""
import json
from pathlib import Path

import numpy as np

from analysis import run

SAMPLES = Path(__file__).resolve().parents[2] / "contracts" / "samples"


def test_synthetic_pipeline(tmp_path):
    res = run.run_synthetic(out_dir=tmp_path)
    meta = json.loads((tmp_path / "meta.json").read_text(encoding="utf-8"))
    grid = json.loads((tmp_path / "grid.json").read_text(encoding="utf-8"))
    series = json.loads((tmp_path / "series.json").read_text(encoding="utf-8"))

    sample_meta = json.loads((SAMPLES / "meta.json").read_text(encoding="utf-8"))
    sample_grid = json.loads((SAMPLES / "grid.json").read_text(encoding="utf-8"))
    assert set(meta) == set(sample_meta)
    assert set(grid) == set(sample_grid)
    assert meta["is_synthetic"] is True and grid["is_synthetic"] is True

    n = meta["grid"]["nrows"] * meta["grid"]["ncols"]
    assert all(len(v) == n for k, v in grid.items() if k != "is_synthetic")
    assert len(series["values_m"]) == n
    assert all(len(row) == len(meta["dates"]) for row in series["values_m"])

    counts = res["label_counts"]
    print("label counts:", counts)
    assert all(c > 0 for c in counts), "every label should appear on the synthetic map"

    # amplitude only where significant
    for sig, amp in zip(grid["seasonal_significant"], grid["amp_m"]):
        assert (amp is not None) == (sig is True)