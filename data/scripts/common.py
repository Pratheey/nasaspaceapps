"""Paths and small helpers shared by the data/ command-line scripts."""
from __future__ import annotations

import csv
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = DATA_DIR.parent
PROCESSED = DATA_DIR / "processed"
INTERIM = DATA_DIR / "interim"
RAW = DATA_DIR / "raw"

REFERENCE_STATION = "P304"  # decision D3


def tag(track: int, frame: int) -> str:
    return f"t{track:03d}_f{frame:03d}"


def granule_csv(track: int, frame: int) -> Path:
    return PROCESSED / f"granules_{tag(track, frame)}.csv"


def pair_dir(track: int, frame: int) -> Path:
    return INTERIM / tag(track, frame)


def read_csv(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def write_csv(path: Path, rows: list[dict], columns: list[str]) -> None:
    """Write rows with exactly `columns`; None becomes an empty cell (never -999)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=columns, extrasaction="ignore")
        w.writeheader()
        for row in rows:
            w.writerow({k: ("" if row.get(k) is None else row[k]) for k in columns})


def load_stations() -> list[dict]:
    """Station coordinates: every station in data/processed/stations_ngl.csv, with the
    coordinates from Daniel's gps/processed/stations.csv (H-1) wherever he lists the
    station. His file wins on coordinates but does not shrink the list, so the station
    table keeps all stations while his file still covers only some of them."""
    stations: dict[str, dict] = {}
    for path in (PROCESSED / "stations_ngl.csv", REPO_ROOT / "gps" / "processed" / "stations.csv"):
        if not path.exists():
            continue
        for r in read_csv(path):
            stations[r["station"]] = {
                "station": r["station"],
                "lat": float(r["lat"]),
                "lon": float(r["lon"]),
                "height_m": float(r["height_m"]),
                "source_file": path.relative_to(REPO_ROOT).as_posix(),
            }
    return list(stations.values())


def parse_pairs(spec: str, n: int) -> list[int]:
    """'all', '3', '1-5' or '1,4,7-9' -> sorted pair numbers within 1..n."""
    if spec == "all":
        return list(range(1, n + 1))
    out: set[int] = set()
    for part in spec.split(","):
        if "-" in part:
            a, b = part.split("-")
            out.update(range(int(a), int(b) + 1))
        else:
            out.add(int(part))
    bad = [p for p in out if not 1 <= p <= n]
    if bad:
        raise ValueError(f"pair numbers out of range 1..{n}: {sorted(bad)}")
    return sorted(out)


def sample_stations(ds, stations: list[dict]) -> list[dict | None]:
    """Values of one per-pair file (an open xarray Dataset) at each station.

    Sampling is done here, from the grids, so the station list can grow without reading
    the granules again. Returns one dict per station (see nisar_gunw.sample_station), or
    None for a station outside the window.
    """
    from pyproj import Transformer

    import nisar_gunw as ng

    names = ["valid", "anomaly", "coherence", "los_disp_ref_m", "los_disp_iono_only_ref_m",
             "los_east", "los_north", "los_up"]
    pair = {name: ds[name].values for name in names}
    pair["x"], pair["y"] = ds.x.values, ds.y.values
    tr = Transformer.from_crs(4326, int(ds.attrs["epsg"]), always_xy=True)
    out = []
    for st in stations:
        sx, sy = tr.transform(st["lon"], st["lat"])
        try:
            out.append(ng.sample_station(pair, sx, sy))
        except ValueError:
            out.append(None)
    return out
