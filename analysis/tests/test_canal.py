import numpy as np

from analysis import canal, regrid


def test_densify_known_length():
    # 0.1 deg of longitude at 36 N is about 9.0 km
    lon, lat, d = canal.densify(np.array([[-120.0, 36.0], [-119.9, 36.0]]), spacing_m=500)
    assert abs(d[-1] - 9.0) < 0.1
    assert np.all(np.diff(d) > 0) and np.all(np.diff(d) <= 0.5 + 1e-9)


def test_profile_samples_the_right_cells_and_outside_is_null():
    g = regrid.AppGrid()
    net = np.arange(g.ncells, dtype=float) * 1e-4
    line = np.array([[-119.905, 36.505], [-119.855, 36.505], [-118.0, 36.505]])  # runs off the grid
    p = canal.profile("t", line, g, net=net, net_sigma=np.full(g.ncells, 0.005), trend=net,
                      trend_sigma=net, label=np.zeros(g.ncells, int), is_synthetic=True, source="test")
    first = p["cell_index"][0]
    assert first == regrid.cell_index([36.505], [-119.905], g)[0]
    assert abs(p["net_change_m"][0] - round(net[first], 4)) < 1e-9
    assert p["cell_index"][-1] is None and p["net_change_m"][-1] is None


def test_gradient_of_a_ramp():
    d = np.linspace(0, 10, 21)
    v = -0.002 * d                     # sinks 2 mm per km
    g = canal.gradient(v, d, baseline_km=2.0)
    assert np.allclose(g[np.isfinite(g)], -0.002)


def test_read_multilinestring(tmp_path):
    import json
    p = tmp_path / "c.geojson"
    p.write_text(json.dumps({"type": "Feature", "properties": {"name": "X"},
                             "geometry": {"type": "MultiLineString",
                                          "coordinates": [[[0, 0], [1, 1]], [[2, 2], [3, 3]]]}}))
    lines = canal.read_lines(p)
    assert [n for n, _ in lines] == ["X part 1", "X part 2"]