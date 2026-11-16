import json

import pytest

from analysis.export import write_all, write_json


def test_serialization_failure_keeps_the_previous_dataset(tmp_path):
    original = {"version": "previous"}
    write_all(tmp_path, original, original, original, original)
    with pytest.raises(ValueError):
        write_all(tmp_path, {"version": "next"}, {"value": float("nan")}, {}, {})
    for name in ("meta", "grid", "series", "stations"):
        assert json.loads((tmp_path / f"{name}.json").read_text()) == original


def test_failed_replacement_preserves_old_file_and_cleans_temporary(tmp_path, monkeypatch):
    target = tmp_path / "grid.json"
    target.write_text('{"version":"previous"}')

    def unavailable(*args, **kwargs):
        raise OSError("replace failed")

    monkeypatch.setattr("analysis.export.os.replace", unavailable)
    with pytest.raises(OSError, match="replace failed"):
        write_json(target, {"version": "next"})
    assert json.loads(target.read_text()) == {"version": "previous"}
    assert sorted(p.name for p in tmp_path.iterdir()) == ["grid.json"]
