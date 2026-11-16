"""Reference ties must use the viewing geometry of the stack being built."""
import sys
from pathlib import Path

import pytest
import numpy as np
import xarray as xr

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


@pytest.mark.parametrize("iono_only", [False, True])
def test_stack_flags_describe_the_selected_displacement(tmp_path, monkeypatch, iono_only):
    # Exercise the file writer using a tiny synthetic pair, without satellite downloads.
    values = {"los_disp_ref_m": 0.2, "los_disp_iono_only_ref_m": 0.1,
              "los_east": 0.6, "los_north": 0., "los_up": 0.8,
              "coherence": 0.9, "valid": 1, "anomaly": 0}
    attrs = dict(pair=1, ref_date="2026-01-01", sec_date="2026-01-13", epsg=32611,
                 coherence_threshold=0.3, granule_id="synthetic", cmr_concept_id="synthetic",
                 iono_applied=1, tropo_applied=1, set_applied=1, anomalies_masked=0,
                 valid_fraction=1., polarization="HH", wavelength_m=0.242, geometry_height_m=0.)
    ds = xr.Dataset({name: (("y", "x"), np.full((2, 2), value)) for name, value in values.items()},
                    coords={"x": [0., 80.], "y": [80., 0.]}, attrs=attrs)
    ds.to_netcdf(tmp_path / "pair_01.nc")
    for name in ("REPO_ROOT", "INTERIM", "PROCESSED"):
        monkeypatch.setattr(build_stack.common, name, tmp_path)
    monkeypatch.setattr(build_stack.common, "pair_dir", lambda *_: tmp_path)
    monkeypatch.setattr(build_stack.common, "read_csv", lambda *_: [{}])
    monkeypatch.setattr(build_stack.common, "load_stations", lambda: [{"station": "P304"}])
    monkeypatch.setattr(build_stack.common, "sample_stations", lambda *_: [{**values, "n_valid_px": 4}])
    monkeypatch.setattr(sys, "argv", ["build_stack", "--track", "34", "--frame", "20", "--no-tie"]
                        + (["--iono-only"] if iono_only else []))
    assert build_stack.main() == 0
    with xr.open_dataset(tmp_path / "stack_t034_f020.nc") as result:
        assert np.allclose(result.los_disp_m, 0.1 if iono_only else 0.2)
        assert result.iono_applied.item() == 1
        assert result.tropo_applied.item() == (0 if iono_only else 1)
        assert result.set_applied.item() == (0 if iono_only else 1)
