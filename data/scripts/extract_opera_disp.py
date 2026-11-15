"""Extract OPERA L3 DISP-S1 (v1.0) UNFILTERED displacement at GPS stations and along the
California Aqueduct, one CSV per frame.   (handoff H-20, historical context only)

STATUS: the CMR query, granule list, dedupe, resume and CSV logic are tested. The HDF5 reading
part could NOT be tested against a real file when this was written, because the Earthdata
account had not accepted the ASF EULA ("EULA Acceptance Failure", HTTP 403 on every range
request). Layer names follow the OPERA spec; they are checked at run time and the granule is
rejected (logged to the failed file) if `displacement` is missing. Verify with --limit first.

Values are written exactly as stored in the file: no re-referencing, no sign change, no
chaining across reference dates. Never mixed with NISAR values.

Run from the repo root:
    data/.venv/Scripts/python data/scripts/extract_opera_disp.py --frames F09155 F11116
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / "data" / "processed"
STATIONS_CSV = PROC / "stations_ngl.csv"
CANAL_JSON = ROOT / "frontend" / "public" / "data" / "canal_profile_california_aqueduct.json"
GRANULE_CSV = PROC / "opera_disp_s1_granules.csv"
FAILED_CSV = PROC / "opera_disp_s1_failed.csv"

COLLECTION = "C3294057315-ASF"
BBOX = "-120.80,35.95,-119.40,37.12"
CMR = "https://cmr.earthdata.nasa.gov/search/granules.json"
# datapool.asf.alaska.edu/DISP/OPERA-S1/<name>.nc (the CMR link) does not resolve; this one does.
URL_FMT = "https://cumulus.asf.alaska.edu/DISP/OPERA-S1/OPERA_L3_DISP-S1_V1/{n}/{n}.nc"

DISP_LAYER = "displacement"  # unfiltered. NOT short_wavelength_displacement.
QUALITY_LAYERS = {
    "recommended_mask": "recommended_mask",
    "temporal_coherence": "temporal_coherence",
    "connected_component": "connected_component_labels",
}
OUT_COLS = ["frame_id", "version", "ref_date", "sec_date", "point_type", "point_id", "lat", "lon",
            "canal_distance_km", "displacement_m", "recommended_mask", "temporal_coherence",
            "connected_component", "granule_id", "download_date_utc"]
ROW_BYTES = 205  # rough average, for the size estimate


# ---------------------------------------------------------------- CMR / granule list
def parse_name(name: str) -> dict:
    p = name.split("_")  # OPERA L3 DISP-S1 IW F09155 VV ref sec vX.Y proc
    d = lambda s: dt.datetime.strptime(s[:8], "%Y%m%d").date().isoformat()
    return {"frame": p[4], "ref_date": d(p[6]), "sec_date": d(p[7]), "version": p[8].lstrip("v"),
            "processing_datetime": p[9], "ref_key": p[6], "sec_key": p[7]}


def query_cmr() -> list:
    out, page = [], 1
    while True:
        q = urllib.parse.urlencode({"collection_concept_id": COLLECTION, "bounding_box": BBOX,
                                    "page_size": 2000, "page_num": page})
        with urllib.request.urlopen(f"{CMR}?{q}", timeout=120) as r:
            entries = json.load(r)["feed"]["entry"]
        if not entries:
            return out
        out += entries
        page += 1


def build_granule_list() -> tuple:
    best, dups = {}, {}
    for e in query_cmr():
        n = e["title"]
        g = parse_name(n)
        key = (g["frame"], g["ref_key"], g["sec_key"])
        g.update(granule_id=n, url=URL_FMT.format(n=n), cmr_concept_id=e["id"])
        if key in best:
            dups[g["frame"]] = dups.get(g["frame"], 0) + 1
            if g["processing_datetime"] <= best[key]["processing_datetime"]:
                continue
        best[key] = g
    rows = sorted(best.values(), key=lambda g: (g["frame"], g["ref_date"], g["sec_date"]))
    cols = ["frame", "ref_date", "sec_date", "version", "processing_datetime", "granule_id", "url",
            "cmr_concept_id"]
    with open(GRANULE_CSV, "w", newline="") as f:
        w = csv.DictWriter(f, cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    return rows, dups


# ---------------------------------------------------------------- points
def load_points(canal_step: int) -> list:
    pts = []
    with open(STATIONS_CSV, newline="") as f:
        for r in csv.DictReader(f):
            pts.append(dict(point_type="station", point_id=r["station"], lat=float(r["lat"]),
                            lon=float(r["lon"]), canal_distance_km=""))
    c = json.load(open(CANAL_JSON))
    for i in range(0, len(c["distance_km"]), canal_step):
        d = c["distance_km"][i]
        pts.append(dict(point_type="canal", point_id=f"canal_km_{d:.1f}", lat=float(c["lat"][i]),
                        lon=float(c["lon"][i]), canal_distance_km=d))
    return pts


# ---------------------------------------------------------------- HDF5 reading (worker side)
_SESSION = None
_PTS = None


def _init_worker(pts):
    global _SESSION, _PTS
    import earthaccess
    earthaccess.login(strategy="netrc")
    _SESSION = earthaccess.get_fsspec_https_session()
    _PTS = pts


def _clean(v, ds):
    """Raw array value -> float/int or None, honouring _FillValue and NaN."""
    fill = ds.attrs.get("_FillValue")
    if fill is not None:
        fill = np.asarray(fill).ravel()[0]
    out = []
    for x in np.asarray(v).ravel():
        if (isinstance(x, (float, np.floating)) and not np.isfinite(x)) or (fill is not None and x == fill):
            out.append(None)
        else:
            out.append(x.item() if hasattr(x, "item") else x)
    return out


def _read_pixels(ds, rows, cols):
    """Read the pixels (rows[i], cols[i]) touching each HDF5 chunk once. Returns raw values."""
    ch = ds.chunks or ds.shape
    groups = {}
    for i, (r, c) in enumerate(zip(rows, cols)):
        groups.setdefault((r // ch[0], c // ch[1]), []).append(i)
    vals = np.empty(len(rows), dtype=ds.dtype)
    for (cr, cc), idx in groups.items():
        r0, c0 = cr * ch[0], cc * ch[1]
        block = ds[r0:min(r0 + ch[0], ds.shape[0]), c0:min(c0 + ch[1], ds.shape[1])]
        for i in idx:
            vals[i] = block[rows[i] - r0, cols[i] - c0]
    return vals


def _find(f, name):
    if name in f:
        return f[name]
    hits = []
    f.visit(lambda p: hits.append(p) if p.split("/")[-1] == name else None)
    return f[hits[0]] if hits else None


def process_granule(g: dict) -> list:
    import h5py
    from pyproj import Transformer

    fobj = _SESSION.open(g["url"], "rb", block_size=2 * 1024 * 1024, cache_type="blockcache")
    f = h5py.File(fobj, "r")
    disp = _find(f, DISP_LAYER)
    if disp is None:
        raise RuntimeError(f"no '{DISP_LAYER}' dataset in {g['granule_id']}")
    x, y = _find(f, "x")[:], _find(f, "y")[:]
    sr = _find(f, "spatial_ref")
    wkt = None
    if sr is not None:
        for k in ("crs_wkt", "spatial_ref"):
            if k in sr.attrs:
                wkt = sr.attrs[k]
                wkt = wkt.decode() if isinstance(wkt, bytes) else str(wkt)
                break
    if wkt is None:
        raise RuntimeError("no CRS (spatial_ref crs_wkt) found")
    tr = Transformer.from_crs("EPSG:4326", wkt, always_xy=True)
    dx, dy = float(x[1] - x[0]), float(y[1] - y[0])
    keep, rows, cols = [], [], []
    for i, p in enumerate(_PTS):
        px, py = tr.transform(p["lon"], p["lat"])
        c, r = int(round((px - x[0]) / dx)), int(round((py - y[0]) / dy))
        if 0 <= r < disp.shape[0] and 0 <= c < disp.shape[1]:  # inside the file's grid
            keep.append(i); rows.append(r); cols.append(c)
    if not keep:
        return []
    dv = _clean(_read_pixels(disp, rows, cols), disp)
    q = {}
    for col, lname in QUALITY_LAYERS.items():
        ds = _find(f, lname)
        q[col] = _clean(_read_pixels(ds, rows, cols), ds) if ds is not None else [None] * len(keep)
    today = dt.datetime.utcnow().date().isoformat()
    fmt = lambda v: "" if v is None else v
    out = []
    for j, i in enumerate(keep):
        p = _PTS[i]
        out.append([g["frame"], g["version"], g["ref_date"], g["sec_date"], p["point_type"], p["point_id"],
                    f"{p['lat']:.6f}", f"{p['lon']:.6f}", p["canal_distance_km"], fmt(dv[j]),
                    fmt(q["recommended_mask"][j]), fmt(q["temporal_coherence"][j]),
                    fmt(q["connected_component"][j]), g["granule_id"], today])
    f.close()
    return out


def run_one(g):
    t0, err = time.time(), ""
    for attempt in range(3):
        try:
            return g, process_granule(g), time.time() - t0, ""
        except Exception as e:  # noqa: BLE001
            err = f"{type(e).__name__}: {str(e)[:200]}"
            time.sleep(2 * 3 ** attempt)
    return g, None, time.time() - t0, err


# ---------------------------------------------------------------- driver
def sort_csv(path: Path):
    with open(path, newline="") as f:
        rd = csv.reader(f)
        header = next(rd)
        rows = list(rd)
    rows.sort(key=lambda r: (r[2], r[3], r[4], r[5]))
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--frames", nargs="+", default=["F09155", "F11116"])
    ap.add_argument("--start", default="2016-01-01")
    ap.add_argument("--end", default="2026-12-31")
    ap.add_argument("--limit", type=int, default=0, help="only N granules per frame, spread over time")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--canal-step", type=int, default=5,
                    help="use every Nth canal point (500 m spacing); 5 keeps a ~390-granule frame under 4.5 MB")
    ap.add_argument("--refresh-list", action="store_true", help="re-query CMR even if the list exists")
    a = ap.parse_args()

    if a.refresh_list or not GRANULE_CSV.exists():
        grans, dups = build_granule_list()
        print(f"CMR: {len(grans)} unique granules; duplicate processing versions dropped per frame: {dups}")
    else:
        with open(GRANULE_CSV, newline="") as f:
            grans = list(csv.DictReader(f))
        print(f"read {len(grans)} granules from {GRANULE_CSV.name} (use --refresh-list to re-query CMR)")
    pts = load_points(a.canal_step)
    print(f"{sum(p['point_type']=='station' for p in pts)} stations + "
          f"{sum(p['point_type']=='canal' for p in pts)} canal points (canal step {a.canal_step})")

    for frame in a.frames:
        fg = [g for g in grans if g["frame"] == frame and a.start <= g["ref_date"] <= a.end
              and g["sec_date"] <= a.end]
        fg.sort(key=lambda g: (g["ref_date"], g["sec_date"]))
        if a.limit and len(fg) > a.limit:
            step = (len(fg) - 1) / (a.limit - 1) if a.limit > 1 else 0
            fg = [fg[round(i * step)] for i in range(a.limit)]
        out = PROC / f"opera_disp_s1_{frame.lower()}.csv"
        done_f = PROC / f"opera_disp_s1_{frame.lower()}.done.txt"
        done = set(done_f.read_text().split()) if done_f.exists() else set()
        todo = [g for g in fg if g["granule_id"] not in done]
        print(f"[{frame}] {len(fg)} granules, {len(done)} already done, {len(todo)} to do")
        if not out.exists():
            with open(out, "w", newline="") as f:
                csv.writer(f).writerow(OUT_COLS)
        t0, n_done, per = time.time(), 0, []
        with ProcessPoolExecutor(a.workers, initializer=_init_worker, initargs=(pts,)) as ex, \
                open(out, "a", newline="") as fo, open(done_f, "a") as fd:
            w = csv.writer(fo)
            for fut in as_completed([ex.submit(run_one, g) for g in todo]):
                g, rows, secs, err = fut.result()
                n_done += 1
                if rows is None:
                    new = not FAILED_CSV.exists()
                    with open(FAILED_CSV, "a", newline="") as ff:
                        wf = csv.writer(ff)
                        if new:
                            wf.writerow(["frame", "granule_id", "error", "utc"])
                        wf.writerow([frame, g["granule_id"], err, dt.datetime.utcnow().isoformat()])
                    print(f"  FAILED {g['granule_id']}: {err}", flush=True)
                else:
                    w.writerows(rows)
                    fd.write(g["granule_id"] + "\n")
                    fo.flush(); fd.flush()
                    per.append(secs)
                if n_done % 25 == 0 or n_done == len(todo):
                    el = time.time() - t0
                    print(f"  {n_done}/{len(todo)}  elapsed {el:.0f}s  ETA {el/n_done*(len(todo)-n_done):.0f}s"
                          f"  mean {np.mean(per) if per else 0:.1f}s/granule (per worker)", flush=True)
        rows = sort_csv(out)
        print(f"[{frame}] {len(rows)} rows, {out.stat().st_size/1e6:.2f} MB, "
              f"{len({r[2] for r in rows})} distinct reference dates -> {out}")
        if per:
            print(f"[{frame}] mean {np.mean(per):.1f} s/granule/worker")


if __name__ == "__main__":
    sys.exit(main())
