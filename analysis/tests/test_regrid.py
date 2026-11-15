import numpy as np

from analysis import regrid


def test_cell_index_of_centres_is_identity():
    g = regrid.AppGrid()
    lat, lon = g.centres()
    assert np.array_equal(regrid.cell_index(lat, lon, g), np.arange(g.ncells))


def test_outside_points_are_minus_one():
    g = regrid.AppGrid()
    assert regrid.cell_index([40.0, 36.5], [-119.9, -125.0], g).tolist() == [-1, -1]


def test_median_and_min_valid_fraction():
    values = np.array([[1.0, 2.0, 30.0, np.nan],     # cell 0 gets 1, 2, 30 -> median 2
                       [np.nan, np.nan, 5.0, 7.0]])  # cell 0: 1 of 3 valid -> dropped
    idx = np.array([0, 0, 0, 1])
    out, counts = regrid.aggregate(values, idx, ncells=2, min_valid_fraction=0.5)
    assert counts.tolist() == [3, 1]
    assert out[0, 0] == 2.0 and np.isnan(out[0, 1])
    assert np.isnan(out[1, 0]) and out[1, 1] == 7.0


def test_projected_coordinates_round_trip():
    from pyproj import Transformer

    fwd = Transformer.from_crs("EPSG:4326", "EPSG:32611", always_xy=True)
    x, y = fwd.transform(-119.6, 36.1)
    lat, lon = regrid.pixel_latlon([x], [y], "EPSG:32611")
    assert abs(lat[0, 0] - 36.1) < 1e-6 and abs(lon[0, 0] + 119.6) < 1e-6