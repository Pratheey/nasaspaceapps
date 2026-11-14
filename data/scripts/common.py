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
    """Station coordinates. Daniel's gps/processed/stations.csv wins once it exists (H-1);
    until then data/processed/stations_ngl.csv, which holds the same NGL coordinates."""
    official = REPO_ROOT / "gps" / "processed" / "stations.csv"
    path = official if official.exists() else PROCESSED / "stations_ngl.csv"
    return [
        {
            "station": r["station"],
            "lat": float(r["lat"]),
            "lon": float(r["lon"]),
            "height_m": float(r["height_m"]),
            "source_file": path.relative_to(REPO_ROOT).as_posix(),
        }
        for r in read_csv(path)
    ]


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
