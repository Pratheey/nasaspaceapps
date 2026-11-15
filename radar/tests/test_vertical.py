"""Small stack fixtures cover NetCDF writer compatibility and source provenance."""
from pathlib import Path
import sys

import h5py
import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from radar.vertical import gps_at, grid, stack_outputs, validate_stack_metadata


def test_gps_epoch_with_an_entirely_blank_flag_column():
    dates = pd.date_range("2026-01-01", periods=3)
    enu = pd.DataFrame({
        "station": ["P304"] * 3, "date": dates, "east_m_corr": [1., 2., 3.],
        "north_m_corr": [4., 5., 6.], "up_m_corr": [7., 8., 9.], "flag": [np.nan] * 3,
    }).set_index(["station", "date"])
    np.testing.assert_allclose(gps_at(enu, "P304", "2026-01-02"), [2., 5., 8.])


def make_stack(path, track, frame, text=str):
    stack = h5py.File(path, "w")
    stack.attrs.update(crs=text("EPSG:32611"), reference_station=text("P304"),
                       product_maturity=text("provisional"),
                       sign_convention=text("positive toward satellite"), track=track, frame=frame)
    stack["x"] = [700000., 700080.]
    stack["y"] = [4000080., 4000000.]
    stack["los_east"] = np.full((2, 2), 0.6 if track == 34 else -0.6)
    stack["los_up"] = np.full((2, 2), 0.8)
    stack["ref_tie_m"] = [0.0]
    stack["los_disp_m"] = np.full((1, 2, 2), -0.008, dtype=np.float32)
    stack["valid"] = np.ones((1, 2, 2), dtype=np.uint8)
    return stack


@pytest.mark.parametrize("text", [str, np.bytes_])
def test_accepts_both_netcdf_text_encodings(tmp_path, text):
    with make_stack(tmp_path / "input.nc", 34, 20, text) as stack:
        validate_stack_metadata(stack, 34, 20)
        assert grid(stack)[2].to_epsg() == 32611
        stack.attrs["reference_station"] = text("P302")
        with pytest.raises(ValueError, match="metadata"):
            validate_stack_metadata(stack, 34, 20)


def test_output_records_actual_input_versions(tmp_path):
    dates = pd.DataFrame({
        "asc_date": ["2026-01-01", "2026-01-13"],
        "nearest_desc_date": ["2026-01-02", "2026-01-14"],
        "desc_minus_asc_days": [1, 1], "asc_epoch_index": [0, 1], "desc_epoch_index": [0, 1],
    })
    stations = pd.DataFrame(columns=["station", "lon", "lat"])
    with make_stack(tmp_path / "ascending_v3.nc", 34, 20) as asc:
        with make_stack(tmp_path / "descending_v2.nc", 42, 70) as desc:
            stack_outputs(asc, desc, dates, stations, tmp_path)
    with h5py.File(tmp_path / "vertical_t034_t042.nc") as result:
        assert result.attrs["ascending_source"] == "ascending_v3.nc"
        assert result.attrs["descending_source"] == "descending_v2.nc"
        np.testing.assert_allclose(result["up_disp_m"][:], -0.01, atol=1e-8)
        np.testing.assert_allclose(result["east_disp_m"][:], 0.0, atol=1e-8)
