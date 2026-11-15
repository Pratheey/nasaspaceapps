import struct, json, csv, sys, datetime as dt
import pandas as pd
BB=(-120.60,35.95,-119.40,36.95)  # lon_min, lat_min, lon_max, lat_max
def read_dbf(p):
    f=open(p,'rb').read(); n=struct.unpack('<I',f[4:8])[0]; hl=struct.unpack('<H',f[8:10])[0]; rl=struct.unpack('<H',f[10:12])[0]
    fields=[]; i=32
    while f[i]!=0x0D:
        fields.append((f[i:i+11].split(b'\0')[0].decode(), f[i+16])); i+=32
    rows=[]
    for k in range(n):
        rec=f[hl+k*rl:hl+(k+1)*rl]; pos=1; d={}
        for name,ln in fields:
            d[name]=rec[pos:pos+ln].decode('latin1').strip(); pos+=ln
        rows.append(d)
    return rows
def read_shp(p):
    f=open(p,'rb').read(); pos=100; out=[]
    while pos<len(f):
        _,clen=struct.unpack('>ii',f[pos:pos+8]); body=f[pos+8:pos+8+clen*2]; pos+=8+clen*2
        t=struct.unpack('<i',body[:4])[0]
        if t==0: out.append(None); continue
        assert t==5, t
        bbox=struct.unpack('<4d',body[4:36]); npart,npts=struct.unpack('<2i',body[36:44])
        parts=list(struct.unpack('<%di'%npart,body[44:44+4*npart])); o=44+4*npart
        pts=[struct.unpack('<2d',body[o+16*i:o+16*i+16]) for i in range(npts)]
        parts.append(npts); rings=[pts[parts[i]:parts[i+1]] for i in range(npart)]
        out.append((bbox,rings))
    return out
shp=read_shp('/tmp/h8/pl/tl_2025_06_place.shp'); dbf=read_dbf('/tmp/h8/pl/tl_2025_06_place.dbf'); assert len(shp)==len(dbf)
feats=[]
for g,a in zip(shp,dbf):
    if g is None: continue
    (x0,y0,x1,y1),rings=g
    if x1<BB[0] or x0>BB[2] or y1<BB[1] or y0>BB[3]: continue
    # outer rings are clockwise in shapefiles; keep ring order, flag holes by orientation
    def area(r): return sum((r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1]) for i in range(len(r)-1))/2
    polys=[];cur=None
    for r in rings:
        r=[[round(x,5),round(y,5)] for x,y in r]
        if area(r)<0: cur=[r]; polys.append(cur)      # clockwise = outer
        elif cur is not None: cur.append(r)           # counter-clockwise = hole
    feats.append({"type":"Feature","properties":{"name":a['NAME'],"geoid":a['GEOID'],"type":a['NAMELSAD'].replace(a['NAME'],'').strip(),"lsad":a['LSAD'],"land_km2":round(int(a['ALAND'])/1e6,2),
        "source":"U.S. Census Bureau TIGER/Line 2025 Places, California (tl_2025_06_place)","download_date":"2026-11-14","datum":"NAD83 (treated as WGS84)"},
        "geometry":{"type":"MultiPolygon","coordinates":polys}})
import os; os.makedirs('/home/claude/pr_gps_new/context/communities',exist_ok=True)
json.dump({"type":"FeatureCollection","name":"places_overlapping_app_bbox","features":feats},open('/home/claude/pr_gps_new/context/communities/places_bbox.geojson','w'),separators=(',',':'))
print('places',len(feats),sorted(f['properties']['name'] for f in feats))
# groundwater
st=pd.read_csv('/tmp/h8/gw/stations_fresno_kings_tulare.csv',dtype={'site_code':str})
m=st[(st.longitude>=BB[0])&(st.longitude<=BB[2])&(st.latitude>=BB[1])&(st.latitude<=BB[3])]
print('wells in bbox',len(m))
ms=pd.read_csv('/tmp/h8/gw/measurements_fresno_kings_tulare.csv',usecols=['site_code','msmt_date','gwe','gse_gwe','wlm_qa_desc','source'],dtype={'site_code':str})
ms=ms[ms.site_code.isin(set(m.site_code))]; ms['date']=pd.to_datetime(ms.msmt_date.str[:10]).dt.date
ms=ms[ms.gwe.notna()]
print('rows with level in bbox wells',len(ms), ms.date.min(), ms.date.max())
ms.to_pickle('/tmp/h8/ms.pkl'); m.to_pickle('/tmp/h8/wells.pkl')
for y in (2015,2020,2024,2025): print(y,'rows since',(ms.date>=dt.date(y,1,1)).sum(),'wells',ms[ms.date>=dt.date(y,1,1)].site_code.nunique())
print(ms.wlm_qa_desc.value_counts().to_dict(), ms.source.value_counts().to_dict())
