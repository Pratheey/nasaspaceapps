"""Build context-only OPERA history. Run: python3 context/history/opera_history.py.

Use unfiltered displacement only where recommended_mask == 1, at both the station
and P304. Keep rejected dates as gaps; never join disconnected reference segments.
See data/README.md and https://docs.asf.alaska.edu/datasets/disp_usage/.
"""
import csv
import json
import math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "processed" / "opera_disp_s1_f36542.csv"
OUT = ROOT / "frontend" / "public" / "context" / "opera_history.json"
REF = "P304"


def build_history(rows, min_dates=21):
    by_gran = defaultdict(dict)
    stations = set()
    for row in rows:
        if row["point_type"] != "station":
            continue
        stations.add(row["point_id"])
        granule = by_gran[(row["ref_date"], row["sec_date"])]
        try:
            value = float(row["displacement_m"])
            good = float(row["recommended_mask"]) == 1 and math.isfinite(value)
        except (ValueError, TypeError):
            good = False
        if good:
            granule[row["point_id"]] = value
    out = {}
    for station in sorted(stations - {REF}):
        cum, attempted = {}, set()
        for ref, sec in sorted(by_gran, key=lambda pair: (pair[1], pair[0])):
            granule = by_gran[(ref, sec)]
            attempted.add(sec)
            if station not in granule or REF not in granule:
                continue
            if not cum:
                cum[ref] = 0.0
            if ref in cum:
                cum[sec] = cum[ref] + granule[station] - granule[REF]
        if len(cum) >= min_dates:
            dates = sorted(set(cum) | {d for d in attempted if d >= min(cum)})
            out[station] = {"dates": dates, "los_m": [round(cum[d], 4) if d in cum else None for d in dates]}
    return {
        "is_synthetic": False, "context_only": True,
        "product": "OPERA L3 DISP-S1 v1.0 (Sentinel-1 C-band), frame F36542 ascending, unfiltered displacement",
        "quality_filter": "recommended_mask == 1 at both the station and P304; rejected or unconnected dates stay null",
        "reference_station": REF,
        "sign": "positive = toward the satellite (Sentinel-1 line of sight, not NISAR's)",
        "note": "Context only. Different satellite, wavelength and viewing direction from NISAR; never compared value for value.",
        "stations": out,
    }


def main():
    with SRC.open(encoding="utf-8", newline="") as source:
        result = build_history(csv.DictReader(source))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    print(f"Wrote quality-filtered history for {len(result['stations'])} stations")


if __name__ == "__main__":
    main()
