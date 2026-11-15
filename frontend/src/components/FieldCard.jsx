import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CROP_COLORS, loadRadar } from "../lib/radar.js";
import { fmtShort } from "../lib/fmt.js";

// Crop-field layer on the live map: a legend while it's on, and the clicked field's record.
export default function FieldCard({ field, onClose }) {
  const [R, setR] = useState(null);
  useEffect(() => { loadRadar().then(setR); }, []);
  if (!R) return (
    <div className="absolute top-[66px] right-16 z-10 rounded-lg border border-hair-2 bg-space/90 px-3 py-2 text-[13px] text-mute">Radar field results not found in public/radar.</div>
  );
  const f = field && R.fields.features.find((x) => x.properties.field_id === field.field_id)?.properties;
  const dates = R.pol.dates;
  return (
    <div className="absolute top-[66px] right-16 z-10 w-[300px] max-w-[calc(100%-6rem)] rounded-xl border border-hair-2 bg-space/92 backdrop-blur p-4 shadow-[0_16px_50px_rgba(0,0,0,.5)] [animation:rise-in_.35s_both]">
      {!f ? (
        <>
          <p className="font-display text-[16px] font-semibold">{R.pol.fields} crop fields</p>
          <ul className="mt-2 space-y-1 text-[13.5px]">
            {R.pol.crops.map((c) => (
              <li key={c} className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: CROP_COLORS[c] }} />{c}<span className="ml-auto font-mono text-[12px] text-mute">HV/HH {R.pol.median_hv_over_hh_db[c].toFixed(1)} dB</span></li>
            ))}
          </ul>
          <p className="text-[12.5px] text-mute mt-3 leading-snug">Click a field to see its radar echo and how often each radar kept a usable signal there. Crop labels: USDA 2025.</p>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-[18px] font-semibold flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: CROP_COLORS[f.crop] }} />{f.crop}</p>
              <p className="font-mono text-[11.5px] text-mute mt-0.5">field {f.field_id} · {Math.round(f.acres)} acres</p>
            </div>
            <button onClick={onClose} aria-label="Back to the field legend" className="p-1 rounded text-mute hover:text-ink hover:bg-deck-2"><X size={16} /></button>
          </div>
          <Spark values={f.hv_over_hh_db} dates={dates} color={CROP_COLORS[f.crop]} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-[13px]">
            <div><dt className="text-mute">Median HV/HH</dt><dd className="font-mono">{f.hv_over_hh_db_median?.toFixed(1)} dB</dd></div>
            <div><dt className="text-mute">Crop median</dt><dd className="font-mono">{R.pol.median_hv_over_hh_db[f.crop].toFixed(1)} dB</dd></div>
            <div><dt className="text-mute">NISAR usable</dt><dd className="font-mono">{f.nisar_usable} of {f.pairs} pairs</dd></div>
            <div><dt className="text-mute">Sentinel-1 usable</dt><dd className="font-mono">{f.s1_usable} of {f.pairs} pairs</dd></div>
          </dl>
          <p className="text-[12px] text-mute mt-3 leading-snug">Usable means at least half the field's pixels valid and a median coherence of at least {R.cov.threshold_median_coherence.toFixed(2)}. Crop structure, moisture and field management all change the echo.</p>
        </>
      )}
    </div>
  );
}

function Spark({ values, dates, color }) {
  const W = 268, H = 82, ok = values.map((v, k) => [k, v]).filter(([, v]) => v != null);
  const lo = Math.min(...ok.map(([, v]) => v)) - 0.3, hi = Math.max(...ok.map(([, v]) => v)) + 0.3;
  const X = (k) => 4 + (k / (values.length - 1)) * (W - 8), Y = (v) => 18 + ((hi - v) / (hi - lo)) * (H - 34);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-3" role="img" aria-label="HV relative to HH at this field over the year">
      <polyline points={ok.map(([k, v]) => `${X(k)},${Y(v)}`).join(" ")} fill="none" stroke={color} strokeWidth="2" />
      {ok.map(([k, v]) => <circle key={k} cx={X(k)} cy={Y(v)} r="2" fill={color} />)}
      <text x="4" y={H - 3} fontSize="10" fill="#A79C8A" style={{ fontFamily: "IBM Plex Mono" }}>{fmtShort(new Date(dates[0] + "T00:00:00Z"))}</text>
      <text x={W - 4} y={H - 3} fontSize="10" fill="#A79C8A" textAnchor="end" style={{ fontFamily: "IBM Plex Mono" }}>{fmtShort(new Date(dates[dates.length - 1] + "T00:00:00Z"))}</text>
      <text x="4" y="10" fontSize="10" fill="#A79C8A" style={{ fontFamily: "IBM Plex Mono" }}>HV/HH, dB</text>
    </svg>
  );
}
