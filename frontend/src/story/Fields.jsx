// Polarization and NISAR vs Sentinel-1 coverage over 30 fields near Corcoran (radar lane, Steven).
import { useEffect, useState } from "react";
import { useInView } from "./hooks.js";
import { Chapter } from "./Media.jsx";
import { CROP_COLORS, loadRadar } from "../lib/radar.js";

const d = (s) => new Date(s + "T00:00:00Z");
const short = (s) => d(s).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const pct = (u, n) => `${((100 * u) / n).toFixed(1)}%`;

export default function FieldsScene() {
  const [R, setR] = useState(null);
  const [ref, seen] = useInView(0.12);
  useEffect(() => { loadRadar().then(setR); }, []);
  if (!R) return <section id="fields" ref={ref} />;
  const { pol, cov } = R, t = cov.totals;
  return (
    <section id="fields" ref={ref} className="relative py-[14vh] px-6 md:px-14 max-w-[1400px] mx-auto">
      <div className={`transition-all duration-1000 ${seen ? "opacity-100" : "opacity-0 translate-y-8"}`}>
        <Chapter n={12} title="The fields" />
        <div className="grid lg:grid-cols-[0.9fr_1.4fr] gap-12 items-start mt-4">
          <div>
            <h2 className="font-display font-bold tracking-[-0.015em] leading-[1.02] text-[clamp(36px,4.6vw,68px)]">Two echoes from the same field.</h2>
            <p className="text-[18px] leading-relaxed text-ink/80 mt-6">
              NISAR sends its radar wave out horizontal and listens twice: for the echo that comes back horizontal (HH),
              and for the part that comes back turned on its side (HV). Leaves and branches scatter the wave many times
              and turn more of it, so the mix changes with what is growing.
            </p>
            <p className="text-[18px] leading-relaxed text-ink/80 mt-4">
              Over {pol.fields} fields near Corcoran and {pol.dates.length} passes ({pol.measurements} measurements),
              almond orchards sent back the most HV for their HH. The median HV/HH was{" "}
              {pol.crops.map((c, k) => <span key={c}>{k ? (k === pol.crops.length - 1 ? " and " : ", ") : ""}<span style={{ color: CROP_COLORS[c] }}>{c.toLowerCase()} {pol.median_hv_over_hh_db[c].toFixed(1)} dB</span></span>)}.
            </p>
            <p className="text-[14px] text-mute mt-4 leading-relaxed">{pol.caveat} This describes the sampled fields and dates; telling crops apart from radar alone would need a separate test. Crop labels: {pol.crop_labels}. NISAR L2 GCOV, provisional.</p>
          </div>
          <PolChart pol={pol} />
        </div>

        <div className="grid lg:grid-cols-[0.9fr_1.4fr] gap-12 items-start mt-[12vh]">
          <div>
            <h3 className="font-display font-bold tracking-[-0.01em] leading-[1.05] text-[clamp(28px,3vw,44px)]">Does the longer wave keep more fields usable?</h3>
            <p className="text-[18px] leading-relaxed text-ink/80 mt-5">
              Not over these fields. We matched {cov.pairs.length} NISAR pairs with Sentinel-1 pairs of the same length, starting at most six days apart,
              and counted a field as usable when at least half its pixels had a valid coherence and the median was at least {cov.threshold_median_coherence.toFixed(2)}.
            </p>
            <div className="mt-7 flex flex-wrap gap-x-10 gap-y-5">
              <div><p className="font-mono text-[44px] leading-none text-rise">{pct(t.nisar.usable, t.nisar.checks)}</p><p className="text-[14px] text-mute mt-2">NISAR, {t.nisar.usable} of {t.nisar.checks} field checks</p></div>
              <div><p className="font-mono text-[44px] leading-none text-[#A98BF0]">{pct(t.s1.usable, t.s1.checks)}</p><p className="text-[14px] text-mute mt-2">Sentinel-1, {t.s1.usable} of {t.s1.checks}</p></div>
            </div>
            <p className="text-[14px] text-mute mt-6 leading-relaxed">{cov.caveat} A few pairs span 24 days where a pass was missing.</p>
          </div>
          <CovChart cov={cov} />
        </div>
      </div>
    </section>
  );
}

function PolChart({ pol }) {
  const [view, setView] = useState("hv_over_hh_db");
  const [hk, setHk] = useState(null);
  const W = 760, H = 380, P = { l: 52, r: 18, t: 20, b: 34 };
  const N = pol.dates.length;
  const all = pol.crops.flatMap((c) => pol.series[c][view]).filter((v) => v != null);
  const lo = Math.floor(Math.min(...all)) - 0.5, hi = Math.ceil(Math.max(...all)) + 0.5;
  const X = (k) => P.l + (k / (N - 1)) * (W - P.l - P.r);
  const Y = (v) => P.t + ((hi - v) / (hi - lo)) * (H - P.t - P.b);
  const step = hi - lo > 12 ? 4 : hi - lo > 6 ? 2 : 1;
  const ticks = []; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const months = pol.dates.map((s, k) => [k, d(s)]).filter(([k, dt], n, a) => !n || dt.getUTCMonth() !== a[n - 1][1].getUTCMonth()).filter((_, n) => n % 2 === 0);
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    setHk(Math.max(0, Math.min(N - 1, Math.round(((x - P.l) / (W - P.l - P.r)) * (N - 1)))));
  };
  return (
    <div>
      <div role="tablist" aria-label="Which echo" className="inline-flex rounded-full border border-hair-2 bg-space/70 p-1 text-[13px]">
        {[["hv_over_hh_db", "HV relative to HH"], ["hh_db", "HH"], ["hv_db", "HV"]].map(([id, t]) => (
          <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}
            className={`rounded-full px-4 py-1.5 transition ${view === id ? "bg-accent text-space font-semibold" : "text-ink/70 hover:text-ink"}`}>{t}</button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto chart mt-4 touch-none" role="img" aria-label="Radar echo per crop over the year"
        onPointerMove={onMove} onPointerLeave={() => setHk(null)}>
        {ticks.map((v) => <g key={v}><line x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} className="grid" /><text x={P.l - 8} y={Y(v) + 4} textAnchor="end">{v}</text></g>)}
        <text x={P.l - 8} y={P.t - 6} textAnchor="end">dB</text>
        {months.map(([k, dt]) => <text key={k} x={X(k)} y={H - 10} textAnchor="middle">{dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}</text>)}
        {pol.crops.map((c) => {
          const v = pol.series[c][view];
          return (
            <g key={c}>
              <polyline points={v.map((y, k) => (y == null ? null : `${X(k)},${Y(y)}`)).filter(Boolean).join(" ")} fill="none" stroke={CROP_COLORS[c]} strokeWidth="2.4" />
              {v.map((y, k) => y != null && <circle key={k} cx={X(k)} cy={Y(y)} r={hk === k ? 4.5 : 2.6} fill={CROP_COLORS[c]} />)}
            </g>
          );
        })}
        {hk != null && <line x1={X(hk)} x2={X(hk)} y1={P.t} y2={H - P.b} stroke="#A9CBFF" strokeOpacity=".5" strokeDasharray="3 3" />}
      </svg>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2 text-[14px] min-h-[28px]">
        {hk != null && <span className="font-mono text-[13px] text-accent-2">{short(pol.dates[hk])}</span>}
        {pol.crops.map((c) => {
          const v = pol.series[c][view][hk ?? -1];
          return <span key={c} className="inline-flex items-center gap-2"><span className="w-4 h-[3px] rounded" style={{ background: CROP_COLORS[c] }} />{c}{hk != null && <span className="font-mono text-[13px] text-ink/80">{v == null ? "no value" : `${v.toFixed(1)} dB`}</span>}</span>;
        })}
      </div>
    </div>
  );
}

function CovChart({ cov }) {
  const [hk, setHk] = useState(null);
  const W = 760, H = 340, P = { l: 44, r: 10, t: 16, b: 40 };
  const N = cov.pairs.length, bw = (W - P.l - P.r) / N;
  const Y = (p) => P.t + (1 - p) * (H - P.t - P.b);
  const h = hk != null ? cov.pairs[hk] : null;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto chart" role="img" aria-label="Share of fields with a usable signal, NISAR and Sentinel-1, per matched pair"
        onPointerLeave={() => setHk(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map((p) => <g key={p}><line x1={P.l} x2={W - P.r} y1={Y(p)} y2={Y(p)} className="grid" /><text x={P.l - 8} y={Y(p) + 4} textAnchor="end">{p * 100}%</text></g>)}
        {cov.pairs.map((p, k) => {
          const x = P.l + k * bw, a = p.nisar_usable / p.fields, b = p.s1_usable / p.fields;
          return (
            <g key={p.nisar_start} onPointerEnter={() => setHk(k)} onClick={() => setHk(k)}>
              <rect x={x} y={P.t} width={bw} height={H - P.t - P.b} fill={hk === k ? "rgba(111,168,255,.08)" : "transparent"} />
              <rect x={x + bw * 0.12} y={Y(a)} width={bw * 0.36} height={Y(0) - Y(a)} rx="1.5" fill="#5FC9E0" />
              <rect x={x + bw * 0.52} y={Y(b)} width={bw * 0.36} height={Y(0) - Y(b)} rx="1.5" fill="#A98BF0" />
              {k % 3 === 0 && <text x={x + bw / 2} y={H - 16} textAnchor="middle">{short(p.nisar_start)}</text>}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 text-[14px] min-h-[46px]">
        {h ? (
          <p><span className="font-mono text-[13px] text-accent-2">{short(h.nisar_start)} → {short(h.nisar_end)}</span>
            <span className="text-rise ml-3">NISAR {h.nisar_usable} of {h.fields}</span>
            <span className="text-[#A98BF0] ml-3">Sentinel-1 {h.s1_usable} of {h.fields}</span>
            <span className="block text-mute text-[12.5px] mt-0.5">Sentinel-1 pair {short(h.s1_start)} → {short(h.s1_end)}</span></p>
        ) : (
          <p className="flex gap-6"><span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-rise" />NISAR</span><span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#A98BF0]" />Sentinel-1</span><span className="text-mute">Point at a pair for its dates.</span></p>
        )}
      </div>
    </div>
  );
}
