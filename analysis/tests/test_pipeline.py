"""End to end on the synthetic stack + fake GPS + fake canal."""
import json
from pathlib import Path

import numpy as np
import pytest

from analysis import run, synthetic

SAMPLES = Path(__file__).resolve().parents[2] / "contracts" / "samples"


def _load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def synth(tmp_path_factory):
    out = tmp_path_factory.mktemp("synth")
    return out, run.run_synthetic(out_dir=out)


def test_contract_files_match_samples(synth):
    out, res = synth
    for name in ("meta", "grid", "series", "stations"):
        assert (out / f"{name}.json").exists(), f"{name}.json missing (the app would fall back to samples)"
    meta, grid, series = _load(out / "meta.json"), _load(out / "grid.json"), _load(out / "series.json")
    sample_keys = set(_load(SAMPLES / "meta.json"))
    assert set(meta) == sample_keys
    assert meta["contract_version"] == 1.2
    from analysis.export import DEMO_STATIONS
    assert meta["demo_stations"] == DEMO_STATIONS          # set in one place (calm station: P298 since the freeze)
    assert "AND amplitude >" in meta["significance"]
    assert set(grid) == set(_load(SAMPLES / "grid.json"))
    assert meta["is_synthetic"] is True and grid["is_synthetic"] is True

    n = meta["grid"]["nrows"] * meta["grid"]["ncols"]
    assert all(len(v) == n for k, v in grid.items() if k != "is_synthetic")
    assert len(series["values_m"]) == n
    assert all(len(row) == len(meta["dates"]) for row in series["values_m"])
    assert all(c > 0 for c in res["label_counts"]), "every label should appear on the synthetic map"
    for sig, amp in zip(grid["seasonal_significant"], grid["amp_m"]):
        assert (amp is not None) == (sig is True)


def test_stations_match_contract_and_make_sense(synth):
    out, _ = synth
    st = _load(out / "stations.json")
    sample = next(s for s in _load(SAMPLES / "stations.json")["stations"] if s["role"] == "held_out")
    meta = _load(out / "meta.json")
    series = _load(out / "series.json")["values_m"]
    assert {s["station"] for s in st["stations"]} == {"P302", "P303", "P304", "P307"}
    for s in st["stations"]:
        assert s["coords_are_placeholder"] is True
        assert set(s) - {"coords_are_placeholder"} == set(sample) - {"coords_are_placeholder"}
        for block in ("gps", "nisar", "gps_fit", "nisar_fit"):
            assert set(s[block]) == set(sample[block])
        assert s["gps"]["dates"] == meta["dates"] and len(s["gps"]["los_m"]) == len(meta["dates"])
        assert s["nisar"]["los_m"] == series[s["cell_index"]]
        if s["role"] == "reference":
            assert s["residuals"] is None
        else:
            assert set(s["residuals"]) == set(sample["residuals"])
            assert s["residuals"]["pairs_rms_m"] is not None


def test_gps_and_nisar_agree_at_held_out_stations(synth):
    """Same truth underneath, so the trends should agree within a few sigma."""
    out, _ = synth
    for s in _load(out / "stations.json")["stations"]:
        g, n = s["gps_fit"], s["nisar_fit"]
        if n["trend_m_per_yr"] is None:
            continue
        sig = np.hypot(g["trend_sigma_m_per_yr"], n["trend_sigma_m_per_yr"])
        assert abs(g["trend_m_per_yr"] - n["trend_m_per_yr"]) < 5 * sig + 0.003, s["station"]


def test_canal_profile_written(synth):
    out, _ = synth
    prof = _load(out / "canal_profile_synthetic_canal.json")
    assert _load(out / "meta.json")["canal_profiles"] == ["canal_profile_synthetic_canal.json"]
    d = prof["distance_km"]
    assert prof["is_synthetic"] is True
    assert all(b > a for a, b in zip(d, d[1:]))
    assert len({len(prof[k]) for k in ("distance_km", "net_change_m", "trend_m_per_yr", "label")}) == 1
    net = [v for v in prof["net_change_m"] if v is not None]
    assert min(net) < -0.05, "the made-up canal crosses the synthetic bowl, so it should sag"


def test_without_gps_files_no_stations_and_a_warning(tmp_path):
    ds, _ = synthetic.make_stack(seed=3, spacing_m=1500)
    (tmp_path / "stations.json").write_text('{"stations":[]}', encoding="utf-8")
    res = run.run(ds, 0.01, "test", tmp_path, is_synthetic=True, gps_dir=tmp_path / "nope")
    assert res["stations"] is None and not (tmp_path / "stations.json").exists()
    assert any("stations.json not written" in n for n in _load(tmp_path / "meta.json")["notes"])


def test_vertical_component(tmp_path):
    import csv
    import datetime as dt

    ds, _ = synthetic.make_stack(seed=4)
    gps = tmp_path / "gps"
    synthetic.make_gps_files(gps, ds)
    ds = ds.rename({"los_disp_m": "up_disp_m"})
    dates = synthetic.nisar_like_dates()
    with (gps / "gps_cleaned_enu.csv").open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["station", "date", "east_m_corr", "north_m_corr", "up_m_corr", "flag"])
        for i, day in enumerate(dates):
            for delta in range(-1, 2):
                sample = day + dt.timedelta(days=delta)
                writer.writerow(["P304", sample, 80.0, 60.0, 20.0 + i * 0.002, ""])
                writer.writerow(["P302", sample, 60.0, 80.0, 40.0 + i * 0.006, ""])
                if i >= 2:
                    writer.writerow(["P307", sample, 60.0, 80.0, 40.0 + i * 0.008, ""])
    out = tmp_path / "out"
    run.run(ds, 0.01, "test", out, gps_dir=gps, is_synthetic=True, component="up")
    meta = _load(out / "meta.json")
    assert meta["sign_convention"] == "positive up"
    assert meta["component"] == "up"
    assert meta["reference_station"] == "P304"
    assert any("cross-check only" in note and "CAHA" in note for note in meta["notes"])
    stations = {s["station"]: s for s in _load(out / "stations.json")["stations"]}
    assert stations["P304"]["gps"]["los_m"] == [0.0] * len(dates)
    np.testing.assert_allclose(stations["P302"]["gps"]["los_m"], np.arange(len(dates)) * 0.004)
    assert stations["P302"]["residuals"]["n_pairs"] > 0
    assert stations["P303"]["gps"]["los_m"] == [None] * len(dates)
    late = stations["P307"]
    assert late["gps"]["los_m"][:2] == [None, None]
    assert late["gps"]["los_m"][2] == late["nisar"]["los_m"][2]
    assert late["gps"]["los_m"][3] - late["gps"]["los_m"][2] == pytest.approx(0.006)
    radar_change = late["nisar"]["los_m"][-1] - late["nisar"]["los_m"][2]
    gps_change = late["gps"]["los_m"][-1] - late["gps"]["los_m"][2]
    assert late["residuals"]["net_m"] == pytest.approx(radar_change - gps_change, abs=0.0001)


def test_geographic_stack_keeps_masks_and_input_unchanged(tmp_path):
    import xarray as xr

    from analysis.regrid import AppGrid

    ds = xr.Dataset(
        {
            "los_disp_m": (("pair", "y", "x"), [[[0.1, 0.4]]]),
            "valid": (("pair", "y", "x"), [[[1.0, np.nan]]]),
            "ref_date": ("pair", ["2025-11-24"]),
            "sec_date": ("pair", ["2025-12-06"]),
        },
        coords={"lat": ("y", [36.945]), "lon": ("x", [-120.595, -120.585])},
    )
    grid = AppGrid(nrows=1, ncols=2)
    res = run.run(ds, 0.01, "test", tmp_path, grid=grid, calibrate=False)
    np.testing.assert_allclose(ds["los_disp_m"].values, [[[0.1, 0.4]]])
    assert _load(tmp_path / "grid.json")["net_change_m"] == [0.1, None]
    assert res["label_counts"] == [2, 0, 0, 0]
    with pytest.raises(ValueError, match="Excluded pair 0"):
        run.run(ds, 0.01, "test", tmp_path, grid=grid, exclude_pairs=[0])

def test_calibration_on_synthetic_stable_corners(synth):
    _, res = synth
    c = res["calibration"]
    print("synthetic calibration:", c)
    assert c.amp_threshold_m is not None and c.n_control >= 100
    assert c.pass_rate <= 0.05


def test_failed_calibration_hides_seasonal_results_but_keeps_net(tmp_path):
    ds, _ = synthetic.make_stack(seed=0)
    res = run.run(ds, 0.01, "test", tmp_path, is_synthetic=True, control_boxes=())
    gid = _load(tmp_path / "grid.json")
    assert res["n_net"] > 0
    assert res["n_fitted"] > 0
    assert res["n_significant"] == 0
    assert res["label_counts"][1:3] == [0, 0]
    assert set(gid["seasonal_significant"]) == {None}
    assert set(gid["amp_m"]) == {None}
    assert "unavailable" in _load(tmp_path / "meta.json")["significance"]


def test_stations_outside_bbox_are_left_out(tmp_path):
    import shutil
    ds, _ = synthetic.make_stack(seed=5, spacing_m=1500)
    gps = tmp_path / "gps"
    synthetic.make_gps_files(gps, ds)
    with open(gps / "stations.csv", "a", encoding="utf-8") as fh:
        fh.write("P725,35.50,-120.90,,held_out,SYNTHETIC outside the bbox\n")
    res = run.run(ds, 0.01, "test", tmp_path / "out", is_synthetic=True, gps_dir=gps)
    names = [s["station"] for s in res["stations"]["stations"]]
    meta = _load(tmp_path / "out" / "meta.json")
    assert "P725" not in names and "P725" not in meta["held_out_stations"]
    assert meta["reference_station"] == "P304"


def test_trend_guard_on_synthetic_keeps_good_cells(synth):
    out, res = synth
    g = res["guard"]
    assert g is not None and g.counts["fitted"] > 0
    assert g.counts["hidden"] / g.counts["fitted"] < 0.05      # synthetic gaps never remove a season
    assert any(n.startswith("Trend guard:") for n in _load(out / "meta.json")["notes"])


def test_meta_lists_canal_profiles(synth):
    out, _ = synth
    meta = _load(out / "meta.json")
    assert meta["canal_profiles"] == ["canal_profile_synthetic_canal.json"]
    assert all((out / f).exists() for f in meta["canal_profiles"])
