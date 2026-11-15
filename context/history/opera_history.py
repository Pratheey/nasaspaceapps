"""Build the app's 'before NISAR' history at the GPS stations from OPERA DISP-S1 (context only).

Reads data/processed/opera_disp_s1_f36542.csv (Sentinel-1 ascending, all 14 stations; see data/README.md
section 'opera_disp_s1'). For each granule the station value is re-referenced to P304 in the same granule
(as the NISAR stack is), and segments that share a new reference date are chained onto the running series.
Writes frontend/public/context/opera_history.json. Never mixed with NISAR values.

    python3 context/history/opera_history.py
"""
import csv, json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "processed" / "opera_disp_s1_f36542.csv"
OUT = ROOT / "frontend" / "public" / "context" / "opera_history.json"
REF = "P304"

rows = [r for r in csv.DictReader(open(SRC, encoding="utf-8")) if r["point_type"] == "station" and r["displacement_m"]]
by_gran = defaultdict(dict)
for r in rows:
    by_gran[(r["ref_date"], r["sec_date"])][r["point_id"]] = float(r["displacement_m"])
stations = sorted({r["point_id"] for r in rows} - {REF})
out = {}
for st in stations:
    cum = {}
    for (ref, sec) in sorted(by_gran, key=lambda k: (k[1], k[0])):
        g = by_gran[(ref, sec)]
        if st not in g or REF not in g:
            continue
        d = g[st] - g[REF]
        if not cum:
            cum[ref] = 0.0
        if ref not in cum:
            continue  # cannot chain this segment
        cum[sec] = cum[ref] + d
    dates = sorted(cum)
    if len(dates) > 20:
        out[st] = {"dates": dates, "los_m": [round(cum[t], 4) for t in dates]}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({
    "is_synthetic": False, "context_only": True,
    "product": "OPERA L3 DISP-S1 v1.0 (Sentinel-1 C-band), frame F36542 ascending, unfiltered displacement",
    "reference_station": REF,
    "sign": "positive = toward the satellite (Sentinel-1 line of sight, not NISAR's)",
    "note": "Context only. Different satellite, wavelength and viewing direction from NISAR; never compared value for value.",
    "stations": out}, separators=(",", ":")), encoding="utf-8")
for st, v in out.items():
    print(st, v["dates"][0], v["dates"][-1], len(v["dates"]), round(v["los_m"][-1] * 100, 1), "cm")
