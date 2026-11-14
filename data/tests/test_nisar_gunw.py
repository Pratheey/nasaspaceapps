"""Tests for data/scripts/nisar_gunw.py on a small synthetic GUNW-shaped HDF5 file.

Run from the repo root:  python -m pytest data/tests -q
The file is fake and only mimics the layer layout; it checks the arithmetic (sign, units,
corrections, masking, referencing), not NISAR itself.
"""
from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path

import h5py
import numpy as np
import pytest
from pyproj import Transformer

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import common  # noqa: E402
import nisar_gunw as ng  # noqa: E402

EPSG = 32611
FREQ_HZ = 1_239_000_000.0
WAVELENGTH_M = ng.SPEED_OF_LIGHT_M_PER_S / FREQ_HZ
REF_LON_LAT = (-120.3566, 36.7390)
NY, NX = 120, 140
WINDOW = ng.Window(lon_min=-120.41, lon_max=-120.31, lat_min=36.70, lat_max=36.78)


def _truth_disp_m(xx, yy, x0, y0):
    """Displacement toward the satellite: a smooth bowl, exactly 0 at the reference."""
    r2 = (xx - x0 - 2000.0) ** 2 + (yy - y0 + 1500.0) ** 2
    bowl = -0.04 * np.exp(-r2 / (2 * 1500.0**2))
    return bowl - (-0.04 * np.exp(-(2000.0**2 + 1500.0**2) / (2 * 1500.0**2)))


@pytest.fixture()
def fake_gunw(tmp_path):
    tr = Transformer.from_crs(4326, EPSG, always_xy=True)
    x0, y0 = tr.transform(*REF_LON_LAT)
    x0, y0 = round(x0 / 80) * 80.0, round(y0 / 80) * 80.0
    x = x0 + 80.0 * (np.arange(NX) - NX // 2)
    y = y0 - 80.0 * (np.arange(NY) - NY // 2)  # north to south, like the product
    xx, yy = np.meshgrid(x, y)

    truth = _truth_disp_m(xx, yy, x0, y0)
    iono = 10.0 + 3e-3 * (xx - x0) - 2e-3 * (yy - y0)  # a big ramp, radians
    cube_x = x0 + 500.0 * np.arange(-14, 15)
    cube_y = y0 - 500.0 * np.arange(-14, 15)
    cube_z = np.array([-500.0, 0.0, 500.0])
    cxx, cyy = np.meshgrid(cube_x, cube_y)

    def plane(a, bx, by, bz):
        return np.stack([a + bx * (cxx - x0) + by * (cyy - y0) + bz * z for z in cube_z])

    wet_c = plane(0.5, 1e-4, 5e-5, 1e-3)
    hyd_c = plane(-0.3, -2e-5, 1e-5, 2e-4)
    set_c = plane(-3.4, 1e-6, -2e-6, 0.0)
    h = 50.0
    extra = (0.5 - 0.3 - 3.4) + (1e-4 - 2e-5 + 1e-6) * (xx - x0) + (5e-5 + 1e-5 - 2e-6) * (yy - y0) + (1e-3 + 2e-4) * h

    # +phase = range increase = away from the satellite
    phase = -4 * np.pi / WAVELENGTH_M * truth + iono + extra + 7.0  # 7 rad arbitrary offset
    coh = np.full((NY, NX), 0.8, dtype="f4")
    cc = np.ones((NY, NX), dtype="u2")
    mask = np.full((NY, NX), (1 << 24) + 12, dtype="u4")  # no water, sub-swaths 1 and 2

    coh[5:15, 5:15] = 0.1            # incoherent field
    cc[80:100, 100:130] = 2          # island: a different connected component
    phase[80:100, 100:130] += 2 * np.pi * 3
    mask[100:110, 10:30] = (1 << 24) + 112   # water
    mask[0:4, :] = (1 << 24) + 10            # invalid secondary sample
    mask[110:114, 60:70] |= 1 << 9           # anomaly flag
    phase[40:44, 40:44] = np.nan

    path = tmp_path / "fake_gunw.h5"
    with h5py.File(path, "w") as f:
        fa = f.create_group(f"{ng.GUNW_ROOT}/grids/frequencyA")
        fa["centerFrequency"] = FREQ_HZ
        fa["listOfPolarizations"] = np.array([b"HH"])
        ui = fa.create_group("unwrappedInterferogram")
        ui["mask"] = mask
        g = ui.create_group("HH")
        g["unwrappedPhase"] = phase.astype("f4")
        g["ionospherePhaseScreen"] = iono.astype("f4")
        g["coherenceMagnitude"] = coh
        g.create_dataset("connectedComponents", data=cc).attrs["_FillValue"] = 65535
        g["projection"] = np.uint32(EPSG)
        g["xCoordinates"], g["yCoordinates"] = x, y
        rg = f.create_group(f"{ng.GUNW_ROOT}/metadata/radarGrid")
        rg["xCoordinates"], rg["yCoordinates"], rg["heightAboveEllipsoid"] = cube_x, cube_y, cube_z
        rg["wetTroposphericPhaseScreen"] = wet_c
        rg["hydrostaticTroposphericPhaseScreen"] = hyd_c
        rg["slantRangeSolidEarthTidesPhase"] = set_c
        rg["losUnitVectorX"] = np.full(wet_c.shape, 0.66, dtype="f4")
        rg["losUnitVectorY"] = np.full(wet_c.shape, 0.20, dtype="f4")
        ident = f.create_group(ng.IDENT_ROOT)
        ident["trackNumber"], ident["frameNumber"] = np.uint32(34), np.uint16(20)
        ident["lookDirection"] = b"Left"
    return {"path": path, "truth": truth, "x": x, "y": y, "x0": x0, "y0": y0}


def _run(fake, **kw):
    with ng.open_gunw(str(fake["path"])) as f:
        res = ng.process_pair(f, REF_LON_LAT, window=WINDOW, **kw)
    rows = np.searchsorted(-fake["y"], -res["y"])
    cols = np.searchsorted(fake["x"], res["x"])
    return res, fake["truth"][np.ix_(rows, cols)], rows, cols


def test_recovers_displacement_with_sign_units_and_reference(fake_gunw):
    res, truth, _, _ = _run(fake_gunw)
    v = res["valid"].astype(bool)
    assert v.mean() > 0.5
    # float32 phase at ~10 rad carries ~1e-6 rad of rounding; 0.1 mm is far above that
    assert np.nanmax(np.abs(res["los_disp_ref_m"][v] - truth[v])) < 1e-4
    assert abs(res["los_disp_ref_m"][res["ref_row"], res["ref_col"]]) < 1e-4
    assert np.nanmin(res["los_disp_ref_m"]) < -0.03  # the bowl sinks: negative = away
    assert res["epsg"] == EPSG and res["polarization"] == "HH"
    assert res["wavelength_m"] == pytest.approx(0.24196, abs=1e-5)


def test_iono_only_differs_by_the_troposphere_and_tide_screens(fake_gunw):
    res, truth, _, _ = _run(fake_gunw)
    v = res["valid"].astype(bool)
    assert np.nanmax(np.abs(res["los_disp_iono_only_ref_m"][v] - truth[v])) > 1e-3
    res2, truth2, _, _ = _run(fake_gunw, apply_troposphere=False, apply_solid_earth_tides=False)
    np.testing.assert_allclose(res2["los_disp_ref_m"], res2["los_disp_iono_only_ref_m"], equal_nan=True)
    assert res2["tropo_applied"] == 0 and res2["set_applied"] == 0 and res2["iono_applied"] == 1


def test_masked_pixels_are_nan_never_zero(fake_gunw):
    res, _, rows, cols = _run(fake_gunw)

    def region(r0, r1, c0, c1):
        rr = np.nonzero((rows >= r0) & (rows < r1))[0]
        cc = np.nonzero((cols >= c0) & (cols < c1))[0]
        assert rr.size and cc.size, "test region is outside the window"
        return np.ix_(rr, cc)

    for name, reg in {
        "low coherence": region(5, 15, 5, 15),
        "other connected component": region(80, 100, 100, 130),
        "water": region(100, 110, 10, 30),
        "invalid sub-swath": region(0, 4, 0, NX),
        "nan phase": region(40, 44, 40, 44),
    }.items():
        assert not res["valid"][reg].any(), name
        assert np.isnan(res["los_disp_ref_m"][reg]).all(), name
    assert np.isfinite(res["los_disp_ref_m"][res["valid"].astype(bool)]).all()

    # anomaly-flagged pixels: kept but reported by default, masked on request
    flagged = region(110, 114, 60, 70)
    assert res["valid"][flagged].all() and res["anomaly"][flagged].all()
    assert res["anomaly"].sum() == res["anomaly"][flagged].sum()
    strict, _, _, _ = _run(fake_gunw, mask_anomalies=True)
    assert not strict["valid"][flagged].any() and strict["anomaly"][flagged].all()
    assert np.isnan(strict["los_disp_ref_m"][flagged]).all()


def test_unusable_reference_raises(fake_gunw):
    with h5py.File(fake_gunw["path"], "r+") as f:
        f[f"{ng.unwrapped_group('HH')}/coherenceMagnitude"][...] = 0.05
    with ng.open_gunw(str(fake_gunw["path"])) as f:
        with pytest.raises(ValueError, match="reference station unusable"):
            ng.process_pair(f, REF_LON_LAT, window=WINDOW)


def test_window_outside_granule_raises(fake_gunw):
    with ng.open_gunw(str(fake_gunw["path"])) as f:
        with pytest.raises(ValueError, match="does not overlap"):
            ng.process_pair(f, REF_LON_LAT, window=ng.Window(-100.0, -99.0, 10.0, 11.0))


def test_sample_station_uses_only_valid_pixels(fake_gunw):
    res, truth, _, _ = _run(fake_gunw)
    s = ng.sample_station(res, fake_gunw["x0"], fake_gunw["y0"])
    assert s["valid"] == 1 and s["n_valid_px"] == 9
    assert abs(s["los_disp_ref_m"]) < 1e-4
    assert (s["los_east"], s["los_north"]) == pytest.approx((0.66, 0.20), abs=1e-6)
    assert s["los_up"] == pytest.approx(np.sqrt(1 - 0.66**2 - 0.20**2), abs=1e-6)
    res["valid"][:] = 0
    empty = ng.sample_station(res, fake_gunw["x0"], fake_gunw["y0"])
    assert empty["valid"] == 0 and empty["los_disp_ref_m"] is None


def test_one_cycle_is_half_a_wavelength_and_positive_phase_is_away():
    assert ng.phase_to_los_m(2 * np.pi, WAVELENGTH_M) == pytest.approx(-WAVELENGTH_M / 2)
    assert abs(ng.phase_to_los_m(2 * np.pi, WAVELENGTH_M)) == pytest.approx(0.121, abs=5e-4)


def test_decode_mask():
    m = np.array([12, 112, 10, 2, 255, (1 << 24) + 12, (1 << 9) + 12, (1 << 17) + 12], dtype="u4")
    water, valid_samples, anomaly = ng.decode_mask(m)
    assert water.tolist() == [False, True, False, False, False, False, False, False]
    assert valid_samples.tolist() == [True, True, False, False, False, True, True, True]
    assert anomaly.tolist() == [False, False, False, False, False, False, True, True]


def test_parse_granule_name_and_chain():
    name = ("NISAR_L2_PR_GUNW_006_034_A_020_007_4000_SH_20251124T130858_20251124T130933_"
            "20251206T130859_20251206T130933_P05023_N_F_J_001")
    g = ng.parse_granule_name(name)
    assert (g["track"], g["frame"], g["direction"]) == (34, 20, "A")
    assert (g["ref_date"], g["sec_date"], g["release"]) == ("2025-11-24", "2025-12-06", "P05023")
    with pytest.raises(ValueError):
        ng.parse_granule_name("NISAR_L2_PR_GCOV_something")
    chain = [{"pair": 1, "ref_date": "a", "sec_date": "b"}, {"pair": 2, "ref_date": "b", "sec_date": "c"},
             {"pair": 3, "ref_date": "d", "sec_date": "e"}]
    assert len(ng.chain_breaks(chain)) == 1 and not ng.chain_breaks(chain[:2])


def test_tenv3_and_gps_los(tmp_path):
    header = ("site YYMMMDD yyyy.yyyy __MJD week d reflon _e0(m) __east(m) ____n0(m) _north(m) "
              "u0(m) ____up(m) _ant(m) sig_e(m) sig_n(m) sig_u(m) __corr_en __corr_eu __corr_nu "
              "_latitude(deg) _longitude(deg) __height(m)")
    lines = [header]
    for i in range(10):
        d = dt.date(2025, 11, 20) + dt.timedelta(days=i)
        up = 0.2 - 0.001 * i + (0.5 if i == 4 else 0.0)  # one outlier day, removed by the median
        lines.append(f"P304 {d.strftime('%y%b%d').upper()} 2025.9 61000 2400 1 -120.4 3876 0.5 "
                     f"4067546 0.9 17 {up:.6f} 0.0083 0.001 0.001 0.003 0 0 0 36.739 -120.3566 16.8")
    p = tmp_path / "P304.tenv3"
    p.write_text("\n".join(lines) + "\n")
    s = ng.read_tenv3(p)
    assert s["dates"][0] == dt.date(2025, 11, 20) and len(s["dates"]) == 10
    assert s["up_m"][0] == pytest.approx(17.2)
    los, n = ng.gps_los_at(s, (0.0, 0.0, 1.0), dt.date(2025, 11, 24))
    # days 21..27: six clean values 17.199..17.193 plus the outlier; the median is 17.197,
    # where a mean would be pulled 7 cm off
    assert n == 7 and los == pytest.approx(17.197, abs=1e-9)
    assert ng.gps_los_at(s, (0.0, 0.0, 1.0), dt.date(2026, 3, 1)) == (None, 0)


def test_parse_pairs():
    assert common.parse_pairs("all", 3) == [1, 2, 3]
    assert common.parse_pairs("1,4,7-9", 10) == [1, 4, 7, 8, 9]
    with pytest.raises(ValueError):
        common.parse_pairs("26", 25)
