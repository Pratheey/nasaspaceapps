"""Reference ties must use the viewing geometry of the stack being built."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import build_stack


def test_descending_tie_does_not_reuse_ascending_gps_projection(tmp_path, monkeypatch):
    monkeypatch.setattr(build_stack.common, "REPO_ROOT", tmp_path)
    processed = tmp_path / "gps" / "processed"
    processed.mkdir(parents=True)
    (processed / "gps_los.csv").write_text(
        "station,date,los_m\nP304,2026-01-01,0.0\nP304,2026-01-13,0.06\n"
    )
    (processed / "gps_cleaned_enu.csv").write_text(
        "station,date,east_m_corr,north_m_corr,up_m_corr\n"
        "P304,2026-01-01,10,20,30\nP304,2026-01-13,10.1,20,30\n"
    )
    pairs = [("2026-01-01", "2026-01-13")]
    ascending, _ = build_stack.reference_tie(34, 20, (0.6, 0, 0.8), pairs)
    descending, source = build_stack.reference_tie(42, 70, (-0.6, 0, 0.8), pairs)
    assert ascending == pytest.approx([0.06])
    assert descending == pytest.approx([-0.06])
    assert "gps_cleaned_enu.csv" in source


def test_cleaned_tie_preserves_missing_measurements(tmp_path):
    path = tmp_path / "gps.csv"
    path.write_text(
        "station,date,east_m_corr,north_m_corr,up_m_corr\n"
        "P304,2026-01-01,10,20,30\nP304,2026-01-13,nan,20,30\n"
    )
    assert build_stack.tie_from_cleaned_enu_csv(
        path, "P304", (0.6, 0, 0.8), [("2026-01-01", "2026-01-13")]
    ) == [None]
