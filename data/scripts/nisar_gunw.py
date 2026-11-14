"""NISAR L2 GUNW: granule search, HTTPS subset reads and single-pair processing.

Library used by find_granules.py, process_pairs.py and build_stack.py. Nothing here is
specific to one track or frame: track, frame, direction and the lon/lat window are inputs
(Steven reuses this for Track 042 / Frame 070, see data/README.md).

What one pair goes through (docs/PROPOSAL.md section 6, contracts/stack.md):
  1. read only the lon/lat window of the needed layers (HTTP range requests)
  2. subtract the ionospheric phase screen (and, optionally, the troposphere and solid
     Earth tide screens the product also carries)
  3. mask: coherence threshold, valid sub-swath samples, water, anomaly flags, and the
     connected component that contains the reference station
  4. reference: subtract the median corrected phase in a small window at the reference station
  5. convert radians to metres of line-of-sight displacement, positive toward the satellite

Layer names and conventions were read from a real provisional granule (release P05023,
product specification 1.5.0) on 2026-11-14; see data/README.md.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
import json
import re
import urllib.parse
import urllib.request
from typing import Iterable

import numpy as np

SPEED_OF_LIGHT_M_PER_S = 299_792_458.0

GUNW_ROOT = "science/LSAR/GUNW"
IDENT_ROOT = "science/LSAR/identification"

# CMR collection of the provisional GUNW products at ASF. Other maturity levels (beta,
# validated) live in other collections and are never mixed in (docs/PROPOSAL.md section 3).
PROVISIONAL_GUNW_COLLECTION = "C2854335566-ASF"
CMR_GRANULES_URL = "https://cmr.earthdata.nasa.gov/search/granules.json"

# Sign of the conversion from interferometric phase to displacement toward the satellite.
# The processor forms reference x conj(secondary), so phase = +4*pi/lambda * (range_sec -
# range_ref): a positive phase is a range increase, i.e. motion AWAY from the satellite.
# Decision D3 wants positive = toward the satellite, hence -1. Confirmed against GPS: see
# "Sign convention" in data/README.md.
PHASE_SIGN_TOWARD_SATELLITE = -1.0

MASK_FILL = 255


@dataclasses.dataclass(frozen=True)
class Window:
    """Geographic window to read, in WGS84 decimal degrees."""

    lon_min: float
    lon_max: float
    lat_min: float
    lat_max: float


# App bbox (lon -120.60..-119.40, lat 35.95..36.95) widened west and north so that all four
# GPS stations are inside: P302 is at lon -120.619 and P303 at lat 37.054, lon -120.705.
DEFAULT_WINDOW = Window(lon_min=-120.80, lon_max=-119.40, lat_min=35.95, lat_max=37.12)


# --------------------------------------------------------------------------------------
# Granule search (public CMR metadata, no login needed)
# --------------------------------------------------------------------------------------

_NAME_RE = re.compile(
    r"NISAR_L2_PR_GUNW_(?P<ref_cycle>\d{3})_(?P<track>\d{3})_(?P<direction>[AD])_"
    r"(?P<frame>\d{3})_(?P<sec_cycle>\d{3})_(?P<mode>\w{4})_(?P<pol>\w{2})_"
    r"(?P<ref_start>\d{8}T\d{6})_(?P<ref_end>\d{8}T\d{6})_"
    r"(?P<sec_start>\d{8}T\d{6})_(?P<sec_end>\d{8}T\d{6})_(?P<release>[A-Z]\d{5})_"
    r"(?P<tail>.+)$"
)


def parse_granule_name(name: str) -> dict:
    """Split a GUNW granule name into its fields. Raises ValueError if it does not match."""
    m = _NAME_RE.match(name)
    if not m:
        raise ValueError(f"not a NISAR L2 GUNW granule name: {name}")
    d = m.groupdict()

    def iso(stamp: str) -> str:
        return dt.datetime.strptime(stamp[:8], "%Y%m%d").date().isoformat()

    return {
        "granule_id": name,
        "track": int(d["track"]),
        "direction": d["direction"],
        "frame": int(d["frame"]),
        "polarization": d["pol"],
        "ref_date": iso(d["ref_start"]),
        "sec_date": iso(d["sec_start"]),
        "ref_start_utc": d["ref_start"],
        "sec_start_utc": d["sec_start"],
        "release": d["release"],
        "tail": d["tail"],
    }


def find_granules(
    track: int,
    frame: int,
    direction: str,
    point_lon_lat: tuple[float, float],
    collection: str = PROVISIONAL_GUNW_COLLECTION,
    timeout_s: float = 60.0,
) -> list[dict]:
    """Query CMR for the GUNW granules of one track/frame, sorted by reference date.

    `point_lon_lat` is any point inside the frame; it only narrows the search. If CMR holds
    more than one granule for the same date pair (reprocessing), the one that sorts last by
    name (highest release, then product counter) is kept.
    """
    query = urllib.parse.urlencode(
        {
            "collection_concept_id": collection,
            "point": f"{point_lon_lat[0]},{point_lon_lat[1]}",
            "page_size": 2000,
            "sort_key": "start_date",
        }
    )
    with urllib.request.urlopen(f"{CMR_GRANULES_URL}?{query}", timeout=timeout_s) as resp:
        entries = json.load(resp)["feed"]["entry"]

    by_pair: dict[tuple[str, str], dict] = {}
    for e in entries:
        try:
            g = parse_granule_name(e["title"])
        except ValueError:
            continue
        if (g["track"], g["frame"], g["direction"]) != (track, frame, direction):
            continue
        urls = [
            link["href"]
            for link in e.get("links", [])
            if link.get("href", "").startswith("https://") and link["href"].endswith(g["granule_id"] + ".h5")
        ]
        if not urls:
            continue
        g["cmr_concept_id"] = e["id"]
        g["hdf5_url"] = urls[0]
        key = (g["ref_date"], g["sec_date"])
        if key not in by_pair or g["granule_id"] > by_pair[key]["granule_id"]:
            by_pair[key] = g
    granules = sorted(by_pair.values(), key=lambda g: (g["ref_date"], g["sec_date"]))
    for i, g in enumerate(granules, start=1):
        g["pair"] = i
    return granules


def chain_breaks(granules: list[dict]) -> list[str]:
    """Return a description of every place where the pairs do not form date i -> date i+1."""
    problems = []
    for a, b in zip(granules, granules[1:]):
        if a["sec_date"] != b["ref_date"]:
            problems.append(
                f"pair {a['pair']} ends {a['sec_date']} but pair {b['pair']} starts {b['ref_date']}"
            )
    return problems


# --------------------------------------------------------------------------------------
# Opening a granule
# --------------------------------------------------------------------------------------

_HTTPS_SESSION = None


def open_gunw(url_or_path: str):
    """Open a GUNW as an h5py.File. URLs are read with HTTP range requests (no download).

    Needs an Earthdata login in ~/.netrc for URLs (`earthaccess.login(persist=True)` once).
    """
    import h5py

    if not str(url_or_path).startswith("http"):
        return h5py.File(url_or_path, "r")

    global _HTTPS_SESSION
    if _HTTPS_SESSION is None:
        import earthaccess

        earthaccess.login(strategy="netrc")
        _HTTPS_SESSION = earthaccess.get_fsspec_https_session()
    fobj = _HTTPS_SESSION.open(url_or_path, block_size=4 * 1024 * 1024, cache_type="blockcache")
    return h5py.File(fobj, "r")


def _text(value) -> str:
    if isinstance(value, bytes):
        return value.decode()
    if isinstance(value, np.ndarray):
        return ",".join(_text(v) for v in value.tolist())
    return str(value)


def unwrapped_group(pol: str, frequency: str = "A") -> str:
    return f"{GUNW_ROOT}/grids/frequency{frequency}/unwrappedInterferogram/{pol}"


def describe(f) -> dict:
    """Identification and processing facts worth recording for each granule."""
    ident = f[IDENT_ROOT]
    pols = [_text(p) for p in f[f"{GUNW_ROOT}/grids/frequencyA/listOfPolarizations"][:]]
    out = {
        "polarizations": pols,
        "center_frequency_hz": float(f[f"{GUNW_ROOT}/grids/frequencyA/centerFrequency"][()]),
    }
    for key in (
        "trackNumber",
        "frameNumber",
        "orbitPassDirection",
        "lookDirection",
        "productVersion",
        "productSpecificationVersion",
        "compositeReleaseId",
        "processingDateTime",
        "productDoi",
        "referenceZeroDopplerStartTime",
        "secondaryZeroDopplerStartTime",
    ):
        if key in ident:
            out[key] = _text(ident[key][()])
    return out


# --------------------------------------------------------------------------------------
# Grid helpers
# --------------------------------------------------------------------------------------

def window_slices(x: np.ndarray, y: np.ndarray, epsg: int, window: Window) -> tuple[slice, slice]:
    """Row and column slices of the projected grid that cover a lon/lat window.

    The grid is UTM, so a lon/lat rectangle is slightly rotated in it; the returned slices
    are the bounding rectangle of the window's outline. `y` may be descending (north up).
    """
    from pyproj import Transformer

    tr = Transformer.from_crs(4326, epsg, always_xy=True)
    lons = np.linspace(window.lon_min, window.lon_max, 50)
    lats = np.linspace(window.lat_min, window.lat_max, 50)
    edge_lon = np.concatenate([lons, lons, np.full(50, window.lon_min), np.full(50, window.lon_max)])
    edge_lat = np.concatenate([np.full(50, window.lat_min), np.full(50, window.lat_max), lats, lats])
    ex, ey = tr.transform(edge_lon, edge_lat)

    cols = np.nonzero((x >= ex.min()) & (x <= ex.max()))[0]
    rows = np.nonzero((y >= ey.min()) & (y <= ey.max()))[0]
    if cols.size == 0 or rows.size == 0:
        raise ValueError("the requested window does not overlap this granule")
    return slice(int(rows[0]), int(rows[-1]) + 1), slice(int(cols[0]), int(cols[-1]) + 1)


def nearest_index(coords: np.ndarray, value: float) -> int:
    """Index of the grid coordinate nearest `value`; ValueError if it is off the grid."""
    i = int(np.argmin(np.abs(coords - value)))
    spacing = abs(float(coords[1] - coords[0])) if coords.size > 1 else np.inf
    if abs(float(coords[i]) - value) > spacing:
        raise ValueError(f"coordinate {value} is outside the grid")
    return i


def decode_mask(mask: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Decode the GUNW `mask` layer into (water, valid_samples, anomaly) boolean arrays.

    Bits 0-7 hold a decimal number WRS: W = water flag, R and S = sub-swath number of the
    reference and secondary image (0 = invalid sample). Bits 8-23 are anomaly flags of the
    two images. Bit 24 marks pixels where the ionosphere screen was interpolated; that is
    true for most pixels and is not treated as a problem. 255 is the fill value.
    """
    mask = np.asarray(mask).astype(np.uint32)
    fill = mask == MASK_FILL
    low = mask & 0xFF
    water = (low // 100) == 1
    valid_samples = ((low // 10) % 10 > 0) & (low % 10 > 0) & ~fill
    anomaly = ((mask >> 8) & 0xFFFF) != 0
    return water & ~fill, valid_samples, anomaly & ~fill


def interp_cube(f, name: str, xw: np.ndarray, yw: np.ndarray, height_m: float) -> np.ndarray:
    """Interpolate a metadata/radarGrid cube (height, y, x) onto grid (yw, xw) at one height.

    Bilinear in x/y and linear in height. Reads only the two height levels and the part of
    the 500 m cube that covers the target grid.
    """
    from scipy.interpolate import RegularGridInterpolator

    grp = f[f"{GUNW_ROOT}/metadata/radarGrid"]
    cx, cy, cz = grp["xCoordinates"][:], grp["yCoordinates"][:], grp["heightAboveEllipsoid"][:]
    k = int(np.clip(np.searchsorted(cz, height_m) - 1, 0, cz.size - 2))
    w = (height_m - cz[k]) / (cz[k + 1] - cz[k])

    def cover(coords: np.ndarray, lo: float, hi: float) -> slice:
        inside = np.nonzero((coords >= lo) & (coords <= hi))[0]
        if inside.size == 0:
            raise ValueError(f"{name}: target grid is outside the radarGrid cube")
        return slice(max(int(inside[0]) - 1, 0), min(int(inside[-1]) + 2, coords.size))

    sx, sy = cover(cx, xw.min(), xw.max()), cover(cy, yw.min(), yw.max())
    block = grp[name][k : k + 2, sy, sx].astype(np.float64)
    level = (1.0 - w) * block[0] + w * block[1]

    suby, subx = cy[sy], cx[sx]
    if suby[0] > suby[-1]:  # the interpolator needs ascending axes
        suby, level = suby[::-1], level[::-1, :]
    interp = RegularGridInterpolator((suby, subx), level, bounds_error=False, fill_value=np.nan)
    yy, xx = np.meshgrid(yw, xw, indexing="ij")
    return interp(np.stack([yy, xx], axis=-1))


def los_unit_vector(f, xw: np.ndarray, yw: np.ndarray, height_m: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """East, north, up components of the unit vector from the ground to the satellite."""
    east = interp_cube(f, "losUnitVectorX", xw, yw, height_m)
    north = interp_cube(f, "losUnitVectorY", xw, yw, height_m)
    up = np.sqrt(np.clip(1.0 - east**2 - north**2, 0.0, None))
    return east, north, up


# --------------------------------------------------------------------------------------
# One pair
# --------------------------------------------------------------------------------------

def phase_to_los_m(phase_rad: np.ndarray, wavelength_m: float) -> np.ndarray:
    """Radians of two-way interferometric phase -> metres of LOS motion toward the satellite."""
    return PHASE_SIGN_TOWARD_SATELLITE * wavelength_m / (4.0 * np.pi) * phase_rad


def _block(arr: np.ndarray, r: int, c: int, half: int) -> tuple[slice, slice]:
    return (
        slice(max(r - half, 0), min(r + half + 1, arr.shape[0])),
        slice(max(c - half, 0), min(c + half + 1, arr.shape[1])),
    )


def sample_station(pair: dict, x_m: float, y_m: float, half: int = 1) -> dict:
    """Median of the valid pixels in a (2*half+1)^2 block centred on the nearest pixel."""
    r, c = nearest_index(pair["y"], y_m), nearest_index(pair["x"], x_m)
    blk = _block(pair["valid"], r, c, half)
    ok = pair["valid"][blk].astype(bool)
    n = int(ok.sum())

    def med(name: str):
        return float(np.median(pair[name][blk][ok])) if n else None

    coh = pair["coherence"][blk]
    return {
        "row": r,
        "col": c,
        "anomaly": int(pair["anomaly"][blk].any()),
        "n_valid_px": n,
        "valid": int(n > 0),
        "los_disp_ref_m": med("los_disp_ref_m"),
        "los_disp_iono_only_ref_m": med("los_disp_iono_only_ref_m"),
        "coherence": float(np.nanmean(coh)) if np.isfinite(coh).any() else None,
        "los_east": float(pair["los_east"][r, c]),
        "los_north": float(pair["los_north"][r, c]),
        "los_up": float(pair["los_up"][r, c]),
    }


def process_pair(
    f,
    ref_lon_lat: tuple[float, float],
    window: Window = DEFAULT_WINDOW,
    coherence_threshold: float = 0.3,
    pol: str | None = None,
    ref_half_window_px: int = 2,
    ref_min_px: int = 5,
    geometry_height_m: float = 50.0,
    apply_troposphere: bool = True,
    apply_solid_earth_tides: bool = True,
    mask_anomalies: bool = False,
) -> dict:
    """Read, correct, mask and reference one GUNW pair over `window`.

    Returns a dict with 2-D arrays on the native grid window (`y` north to south):
      los_disp_ref_m            LOS displacement, all enabled corrections, zero at the
                                reference station, positive toward the satellite, NaN if masked
      los_disp_iono_only_ref_m  same but with only the ionosphere screen removed
      coherence, valid, los_east, los_north, los_up, x, y
      anomaly                   1 where the product flags an input-data anomaly in either
                                image (so far only "qFSP-H1 sample slip", a range stripe)
    and scalars describing the pair. The displacement is NOT yet tied to the reference
    station's GPS motion; build_stack.py adds that, so the tie can be changed without
    reading the granules again.

    Anomaly-flagged pixels are kept by default and reported in `anomaly`: on the flagged
    dates of Track 034 / Frame 020 the phase step at the stripe edge is about 2 mm, and
    masking the stripe would remove a quarter of the window from every later cumulative
    value (see "Anomaly flag" in data/README.md). `mask_anomalies=True` masks them.

    Raises ValueError if the reference station is not usable in this pair.
    """
    from pyproj import Transformer

    info = describe(f)
    pol = pol or info["polarizations"][0]
    grp = f[unwrapped_group(pol)]
    epsg = int(grp["projection"][()])
    x_full, y_full = grp["xCoordinates"][:], grp["yCoordinates"][:]
    rs, cs = window_slices(x_full, y_full, epsg, window)
    x, y = x_full[cs], y_full[rs]
    wavelength_m = SPEED_OF_LIGHT_M_PER_S / info["center_frequency_hz"]

    phase = grp["unwrappedPhase"][rs, cs].astype(np.float64)
    iono = grp["ionospherePhaseScreen"][rs, cs].astype(np.float64)
    coherence = grp["coherenceMagnitude"][rs, cs].astype(np.float32)
    conncomp = grp["connectedComponents"][rs, cs]
    mask = f[f"{unwrapped_group(pol).rsplit('/', 1)[0]}/mask"][rs, cs]
    cc_fill = grp["connectedComponents"].attrs.get("_FillValue", 65535)

    water, valid_samples, anomaly = decode_mask(mask)
    usable = (
        np.isfinite(phase)
        & np.isfinite(iono)
        & (coherence >= coherence_threshold)
        & (conncomp > 0)
        & (conncomp != cc_fill)
        & valid_samples
        & ~water
    )
    if mask_anomalies:
        usable &= ~anomaly

    # Corrections. All screens are in radians of interferometric phase, to be subtracted.
    phase_iono = phase - iono
    extra = np.zeros_like(phase)
    if apply_troposphere:
        extra += interp_cube(f, "wetTroposphericPhaseScreen", x, y, geometry_height_m)
        extra += interp_cube(f, "hydrostaticTroposphericPhaseScreen", x, y, geometry_height_m)
    if apply_solid_earth_tides:
        extra += interp_cube(f, "slantRangeSolidEarthTidesPhase", x, y, geometry_height_m)
    phase_full = phase_iono - extra

    # Reference: the connected component and median phase in a small block at the station.
    tr = Transformer.from_crs(4326, epsg, always_xy=True)
    ref_x, ref_y = tr.transform(*ref_lon_lat)
    r0, c0 = nearest_index(y, ref_y), nearest_index(x, ref_x)
    blk = _block(phase, r0, c0, ref_half_window_px)
    ok = usable[blk]
    if int(ok.sum()) < ref_min_px:
        raise ValueError(
            f"reference station unusable in this pair: {int(ok.sum())} usable pixels "
            f"of {ok.size} (need {ref_min_px})"
        )
    labels, counts = np.unique(conncomp[blk][ok], return_counts=True)
    ref_cc = int(labels[np.argmax(counts)])
    ok &= conncomp[blk] == ref_cc
    if int(ok.sum()) < ref_min_px:
        raise ValueError("reference block is split across connected components")

    valid = usable & (conncomp == ref_cc)

    def referenced(ph: np.ndarray) -> np.ndarray:
        out = phase_to_los_m(ph - np.median(ph[blk][ok]), wavelength_m)
        out[~valid] = np.nan
        return out.astype(np.float32)

    east, north, up = los_unit_vector(f, x, y, geometry_height_m)

    return {
        "x": x,
        "y": y,
        "epsg": epsg,
        "los_disp_ref_m": referenced(phase_full),
        "los_disp_iono_only_ref_m": referenced(phase_iono),
        "coherence": coherence,
        "valid": valid.astype(np.uint8),
        "anomaly": anomaly.astype(np.uint8),
        "anomalies_masked": int(mask_anomalies),
        "los_east": east.astype(np.float32),
        "los_north": north.astype(np.float32),
        "los_up": up.astype(np.float32),
        "wavelength_m": wavelength_m,
        "polarization": pol,
        "ref_connected_component": ref_cc,
        "ref_n_px": int(ok.sum()),
        "ref_row": r0,
        "ref_col": c0,
        "iono_applied": 1,
        "tropo_applied": int(apply_troposphere),
        "set_applied": int(apply_solid_earth_tides),
        "coherence_threshold": coherence_threshold,
        "geometry_height_m": geometry_height_m,
        "valid_fraction": float(valid.mean()),
        "water_fraction": float(water.mean()),
        "anomaly_fraction": float(anomaly.mean()),
        "info": info,
    }


# --------------------------------------------------------------------------------------
# GPS tie for the reference station (NGL tenv3)
# --------------------------------------------------------------------------------------

def read_tenv3(path) -> dict:
    """Read an NGL .tenv3 file. Returns dates and east/north/up in metres (absolute)."""
    dates, east, north, up = [], [], [], []
    with open(path) as fh:
        header = fh.readline().split()
        col = {name.strip("_"): i for i, name in enumerate(header)}
        need = ["YYMMMDD", "e0(m)", "east(m)", "n0(m)", "north(m)", "u0(m)", "up(m)"]
        missing = [n for n in need if n not in col]
        if missing:
            raise ValueError(f"{path}: unexpected tenv3 header, missing {missing}")
        for line in fh:
            p = line.split()
            if len(p) < len(header):
                continue
            dates.append(dt.datetime.strptime(p[col["YYMMMDD"]].title(), "%y%b%d").date())
            east.append(float(p[col["e0(m)"]]) + float(p[col["east(m)"]]))
            north.append(float(p[col["n0(m)"]]) + float(p[col["north(m)"]]))
            up.append(float(p[col["u0(m)"]]) + float(p[col["up(m)"]]))
    return {"dates": dates, "east_m": np.array(east), "north_m": np.array(north), "up_m": np.array(up)}


def gps_los_at(series: dict, los_enu: Iterable[float], date: dt.date, half_window_days: int = 3):
    """Median GPS position projected on the LOS within +-half_window_days of `date`.

    Returns (los_m, n_days). A median over a week keeps the millimetre-level daily GPS noise
    out of every pixel of the pair. Returns (None, 0) if no solution falls in the window.
    """
    e, n, u = los_enu
    los = series["east_m"] * e + series["north_m"] * n + series["up_m"] * u
    days = np.array([(d - date).days for d in series["dates"]])
    sel = np.abs(days) <= half_window_days
    if not sel.any():
        return None, 0
    return float(np.median(los[sel])), int(sel.sum())
