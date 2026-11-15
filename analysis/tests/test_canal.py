import numpy as np

from analysis import canal, regrid


def test_densify_known_length():
    # 0.1 deg of longitude at 36 N is about 9.0 km
    lon, lat, d = canal.densify(np.array([[-120.0, 36.0], [-119.9, 36.0]]), spacing_m=500)
    assert abs(d[-1] - 9.0) < 0.1
    assert np.all(np.diff(d) > 0) and np.all(np.diff(d) <= 0.5 + 1e-9)
    assert np.allclose(np.diff(d)[:-1], 0.5)           # even spacing, except the last step to the end


def test_densify_many_vertices_gives_even_samples():
    lon = np.linspace(-120.0, -119.9, 400); line = np.column_stack([lon, np.full_like(lon, 36.0)])
    _, _, d = canal.densify(line, spacing_m=500)
    assert len(d) == int(np.ceil(d[-1] / 0.5)) + 1     # ~19 samples, not 400


def test_duplicate_vertices_and_actual_gradient_distance():
    from pytest import raises

    line = np.array([[-120.0, 36.0], [-120.0, 36.0], [-119.9, 36.0]])
    for actual, expected in zip(canal.densify(line), canal.densify(line[1:])):
        np.testing.assert_allclose(actual, expected)
    with raises(ValueError, match="line length"):
        canal.densify(line[:2])

    grid = regrid.AppGrid()
    values = np.linspace(0, 0.1, grid.ncells)
    sigma = np.full(grid.ncells, 0.005)
    p = canal.profile("test", line, grid, net=values, net_sigma=sigma, trend=values,
                      trend_sigma=sigma, label=np.zeros(grid.ncells, int), is_synthetic=True, source="test")
    # At the line end the two samples span 1 km, half the nominal full baseline.
    assert p["distance_km"][2] == 1.0
    assert p["net_change_gradient_sigma_m_per_km"][0] == round(np.hypot(0.005, 0.005), 5)


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
