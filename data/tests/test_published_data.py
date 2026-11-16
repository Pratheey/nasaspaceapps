"""Independent consistency checks of the committed scientific deliverables.

These verify exports against source tables, not the correctness of NASA retrievals.
They deliberately do not download or pretend to reconstruct the raw NISAR stacks.
"""
import csv
import json
import math
import statistics
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "frontend/public"


def read_json(path):
    return json.loads(path.read_text())


def rows(path):
    with path.open(newline="", encoding="utf-8-sig") as source:
        return list(csv.DictReader(source))


def test_grid_series_stations_and_canal_describe_the_same_cells():
    meta, grid, series, stations = [read_json(APP / "data" / f"{name}.json")
                                    for name in ("meta", "grid", "series", "stations")]
    assert all(obj["is_synthetic"] is False for obj in (meta, grid, series, stations))
    n = meta["grid"]["nrows"] * meta["grid"]["ncols"]
    assert len(series["values_m"]) == n
    for i, values in enumerate(series["values_m"]):
        assert len(values) == len(meta["dates"])
        assert all(v is None or math.isfinite(v) for v in values)
        assert sum(v is not None for v in values) == grid["n_valid_dates"][i]
        assert values[-1] == grid["net_change_m"][i]
        if grid["seasonal_significant"][i]:
            assert grid["amp_m"][i] is not None
            assert 1 <= grid["peak_month"][i] <= 12
    for station in stations["stations"]:
        assert station["nisar"]["dates"] == meta["dates"]
        assert station["nisar"]["los_m"] == series["values_m"][station["cell_index"]]
        if station["role"] == "reference":
            assert station["residuals"] is None
    for filename in meta.get("canal_profiles", []):
        canal = read_json(APP / "data" / filename)
        assert all(b > a for a, b in zip(canal["distance_km"], canal["distance_km"][1:]))
        for j, cell in enumerate(canal["cell_index"]):
            for field in ("net_change_m", "net_change_sigma_m", "trend_m_per_yr", "trend_sigma_m_per_yr", "label"):
                expected = grid[field][cell] if cell is not None else (0 if field == "label" else None)
                assert canal[field][j] == expected


def test_published_uncertainty_is_held_out_residual_rms():
    uncertainty = read_json(ROOT / "gps/processed/uncertainty.json")
    residuals = rows(ROOT / "gps/processed/residuals.csv")
    pairs = [r for r in residuals if r["pair"] != "net" and r["unwrap_flag"] == "0"]
    nets = [r for r in residuals if r["pair"] == "net"]
    assert all(r["station"] != "P304" for r in residuals)
    for entries, key in ((pairs, "sigma_pair_m"), (nets, "sigma_net_m")):
        rms = math.sqrt(statistics.mean(float(r["residual_m"]) ** 2 for r in entries))
        assert uncertainty[key] == pytest.approx(rms, abs=0.00005)
    assert uncertainty["n_pairs_used"] == len(pairs)
    assert uncertainty["n_stations"] == len({r["station"] for r in pairs})
    assert read_json(APP / "data/meta.json")["sigma_net_m"] == uncertainty["sigma_net_m"]


def test_station_gps_fit_summaries_match_the_source_table():
    fits = {(r["station"], r["component"]): r for r in rows(ROOT / "gps/processed/gps_fits.csv")}
    for station in read_json(APP / "data/stations.json")["stations"]:
        source = fits[(station["station"], "los")]
        for key, value in station["gps_fit"].items():
            expected = int(source[key]) if key == "peak_month" else round(float(source[key]), 4)
            assert value == expected


def test_radar_exports_match_field_measurements_and_pair_counts():
    results = ROOT / "radar/results"
    polarization = read_json(APP / "radar/polarization.json")
    fields = rows(results / "nisar-polarization-fields.csv")
    assert len({(r["field_id"], r["date"]) for r in fields}) == len(fields)
    assert polarization["measurements"] == len(fields)
    for r in fields:
        if r["hh_db"] and r["hv_db"]:
            assert float(r["hv_over_hh_db"]) == pytest.approx(float(r["hv_db"]) - float(r["hh_db"]), abs=1e-8)
    for crop in polarization["crops"]:
        for k, date in enumerate(polarization["dates"]):
            values = [float(r["hv_over_hh_db"]) for r in fields if r["crop"] == crop and r["date"] == date and r["hv_over_hh_db"]]
            assert polarization["series"][crop]["fields_measured"][k] == len(values)
            expected = round(statistics.median(values), 4) if values else None
            assert polarization["series"][crop]["hv_over_hh_db"][k] == expected
    coverage = read_json(APP / "radar/coverage.json")
    checks = rows(results / "matched-radar-coverage-by-field.csv")
    for sensor, key in (("NISAR", "nisar"), ("Sentinel-1", "s1")):
        selected = [r for r in checks if r["sensor"] == sensor]
        assert coverage["totals"][key] == {"checks": len(selected), "usable": sum(r["usable"] == "True" for r in selected)}
        assert sum(p[f"{key}_usable"] for p in coverage["pairs"]) == coverage["totals"][key]["usable"]


def test_opera_quality_rejection_and_disconnected_segments_remain_missing():
    from context.history.opera_history import build_history

    def pair(ref, sec, station_mask=1, ref_mask=1, value=0.03):
        return [{"point_type": "station", "point_id": name, "ref_date": ref, "sec_date": sec,
                 "recommended_mask": str(mask), "displacement_m": str(v)}
                for name, mask, v in (("P304", ref_mask, 0.01), ("TEST", station_mask, value))]
    data = pair("2020-01-01", "2020-01-13")
    data += pair("2020-01-01", "2020-01-25", station_mask=0)
    data += pair("2020-01-25", "2020-02-06")  # cannot bridge rejected reference
    data += pair("2020-01-01", "2020-02-18", ref_mask=0)
    data += pair("2020-01-01", "2020-03-01", value=float("nan"))
    station = build_history(data, min_dates=2)["stations"]["TEST"]
    assert station["los_m"] == [0.0, 0.02, None, None, None, None]


def test_published_opera_history_is_reproducible():
    from context.history.opera_history import build_history

    expected = build_history(rows(ROOT / "data/processed/opera_disp_s1_f36542.csv"))
    assert read_json(APP / "context/opera_history.json") == expected
    p300 = expected["stations"]["P300"]
    assert p300["los_m"][p300["dates"].index("2024-11-27")] is None
