#!/usr/bin/env python3
"""Chain OPERA DISP-S1 segments into one series per point, relative to P304 (H-20, gps/context lane).

    python context/scripts/chain_opera.py --in data/processed --out context/opera

Input : data/processed/opera_disp_s1_f11116.csv and opera_disp_s1_f36542.csv (data lane; values as stored).
Method: every granule is motion from ref_date to sec_date, and its spatial reference point differs from
        file to file. So each point's value is first differenced against P304 in the SAME granule. Segments
        are then chained: the value at a segment's last date (= the next segment's ref_date, checked) is
        added to everything in the next segment. A point where the link value is missing (OPERA mask 0 or no
        data) starts a new `chain_id`; values with different chain_id are NOT comparable.
Units : metres, line of sight, positive toward the satellite. C-band (Sentinel-1). Never mixed with NISAR.
"""
import argparse, csv, math
import pandas as pd
ap = argparse.ArgumentParser(); ap.add_argument("--in", dest="inp", default="data/processed"); ap.add_argument("--out", default="context/opera")
a = ap.parse_args()
REF = "P304"
for fr in ("f11116", "f36542"):
    d = pd.read_csv(f"{a.inp}/opera_disp_s1_{fr}.csv", dtype={"granule_id": str})
    d.loc[d.recommended_mask != 1, "displacement_m"] = float("nan")
    p = d[d.point_id == REF].set_index(["ref_date", "sec_date"]).displacement_m.rename("ref_disp")
    d = d.join(p, on=["ref_date", "sec_date"])
    d["rel"] = d.displacement_m - d.ref_disp          # NaN if the point or P304 is missing in that granule
    d = d[d.point_id != REF]
    refs = sorted(d.ref_date.unique())
    # last sec_date of each segment must equal the next ref_date (all true in the files read on 2026-11-15)
    for r0, r1 in zip(refs, refs[1:]):
        assert d[d.ref_date == r0].sec_date.max() == r1, (fr, r0, r1)
    out = []
    for pid, g in d.groupby("point_id", sort=False):
        meta = g.iloc[0]
        cum, chain, started = 0.0, 1, False
        out.append((meta.frame_id, meta.version, meta.point_type, pid, meta.lat, meta.lon, meta.canal_distance_km, refs[0], 0.0, 1, refs[0]))
        for r0, r1 in zip(refs, refs[1:] + [None]):
            s = g[g.ref_date == r0].sort_values("sec_date")
            for _, row in s.iterrows():
                if math.isnan(row.rel): continue
                out.append((row.frame_id, row.version, row.point_type, pid, row.lat, row.lon, row.canal_distance_km, row.sec_date, round(cum + row.rel, 6), chain, r0))
            if r1 is None: break
            link = s[s.sec_date == r1]
            if len(link) and not math.isnan(link.rel.iloc[0]):
                cum = cum + float(link.rel.iloc[0])
            else:                                       # break: restart from zero at the next reference date
                cum, chain = 0.0, chain + 1
                out.append((meta.frame_id, meta.version, meta.point_type, pid, meta.lat, meta.lon, meta.canal_distance_km, r1, 0.0, chain, r1))
    cols = ["frame_id", "version", "point_type", "point_id", "lat", "lon", "canal_distance_km", "date", "los_rel_p304_m", "chain_id", "segment_ref_date"]
    res = pd.DataFrame(out, columns=cols)
    # a chain that is only its zero starting row carries no data: drop it (CAKC, P303, P307 have no F11116 data)
    res = res[res.groupby(["point_id", "chain_id"]).date.transform("size") > 1]
    res.to_csv(f"{a.out}/opera_disp_s1_{fr}_chained_rel_p304.csv", index=False)
    print(fr, "points", res.point_id.nunique(), "rows", len(res))
