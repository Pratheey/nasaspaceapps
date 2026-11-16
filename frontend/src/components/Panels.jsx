import { useEffect, useMemo, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Radar, Route } from "lucide-react";
import { sampleLine, sampleCanal, distKm } from "../lib/profile.js";
import { cm, fmtDate } from "../lib/fmt.js";
import { cellAt } from "../lib/data.js";
import { AGREEMENT, isDraft } from "../lib/demo.js";

/* ---------------- cross-section ---------------- */
const PH = 190, PP = { l: 54, r: 14, t: 12, b: 26 };
export function ProfilePanel({ D, S, valueAt, onClose, onProbe, onPick }) {
  const P = S.profile;
  const smp = useMemo(() => (P?.canal ? (D.canal ? sampleCanal(D.canal, valueAt) : null)
    : P?.b ? sampleLine(P.a, P.b, D.meta.grid.step_deg, valueAt) : null), [P, valueAt, D]);
  const [readFrac, setReadFrac] = useState(null);
  // The chart is drawn at its real pixel size, so text and lines are never stretched.
  const box = useRef(null);
  const [PW, setPW] = useState(900);
  const open = !!P;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setPW(Math.max(320, Math.round(el.clientWidth - 32)));
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [open]);
  if (!P) return null;

  let body;
  if (!smp && P.canal) body = <p className="text-[14px] text-ink/85">The canal profile is not available with this data.</p>;
  else if (!smp) body = <p className="text-[14px] text-ink/85">Click two points on the map to draw a line. A canal, a road, a levee: anything you want to see in cross-section.</p>;
  else if (!smp.L) body = <p className="text-mute">Drag one end to a different spot to see a cross-section.</p>;
  else {
    const ok = smp.pts.filter((s) => s.v != null);
    if (!ok.length) body = <p className="text-mute">No measurements along this line.</p>;
    else {
      const vs = ok.map((s) => s.v * 100);
      let lo = Math.min(0, ...vs), hi = Math.max(0, ...vs);
      const pad = Math.max(0.5, (hi - lo) * 0.12); lo -= pad; hi += pad;
      const X = (km) => PP.l + (km / smp.L) * (PW - PP.l - PP.r);
      const Y = (v) => PP.t + ((hi - v) / (hi - lo)) * (PH - PP.t - PP.b);
      const step = hi - lo > 12 ? 4 : hi - lo > 5 ? 2 : 1;
      const grid = []; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) grid.push(v);
      const kmStep = smp.L > 60 ? 20 : smp.L > 25 ? 10 : 5;
      const kms = []; for (let k = 0; k <= smp.L; k += kmStep) kms.push(k);
      const segs = []; let seg = [];
      smp.pts.forEach((p) => { if (p.v == null) { if (seg.length) segs.push(seg); seg = []; } else seg.push(p); });
      if (seg.length) segs.push(seg);
      const frac = (e) => { const r = e.currentTarget.getBoundingClientRect(); return Math.max(0, Math.min(1, (((e.clientX - r.left) / r.width) * PW - PP.l) / (PW - PP.l - PP.r))); };
      const at = (f) => smp.pts[Math.round(f * (smp.pts.length - 1))];
      const read = readFrac == null ? null : at(readFrac);
      body = (
        <>
          <p className="text-[13px] text-mute mb-1 min-h-[1.4em]" aria-live="polite">
            {read ? <>{read.km.toFixed(1)} km along the {P.canal ? "Aqueduct" : "line"}: <span className="text-ink">{read.v == null ? "no measurement" : cm(read.v)}</span></>
              : P.canal ? "North to south along the California Aqueduct. Point along the profile to find that spot on the map. A screening tool: where to look closer, not damage or capacity."
              : "Point along the profile to find that spot on the map. Drag the numbered ends to move the line."}
          </p>
          <svg viewBox={`0 0 ${PW} ${PH}`} width={PW} height={PH} className="chart block max-w-full"
            onMouseMove={(e) => { const f = frac(e); setReadFrac(f); onProbe(at(f).p); }}
            onMouseLeave={() => { setReadFrac(null); onProbe(null); }}
            onClick={(e) => { const p = at(frac(e)); const i = cellAt(D, ...p.p); if (i >= 0) onPick(i); }}>
            <defs>
              <linearGradient id="profFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#D08B5B" stopOpacity="0.05" />
                <stop offset="1" stopColor="#D08B5B" stopOpacity="0.4" />
              </linearGradient>
            </defs>
            {grid.map((v) => (
              <g key={v}>
                <line x1={PP.l} x2={PW - PP.r} y1={Y(v)} y2={Y(v)} className={v === 0 ? "zero" : "grid"} vectorEffect="non-scaling-stroke" />
                <text x={PP.l - 6} y={Y(v) + 4} textAnchor="end">{v > 0 ? "+" : v < 0 ? "−" : ""}{Math.abs(v)} cm</text>
              </g>
            ))}
            {kms.map((k) => <text key={k} x={X(k)} y={PH - 6} textAnchor="middle">{k} km</text>)}
            {segs.map((g, n) => {
              const top = g.map((p) => `${X(p.km).toFixed(1)},${Y(p.v * 100).toFixed(1)}`);
              return (
                <g key={n}>
                  <polygon points={`${X(g[0].km)},${Y(0)} ${top.join(" ")} ${X(g[g.length - 1].km)},${Y(0)}`} fill="url(#profFill)" />
                  <polyline points={top.join(" ")} fill="none" stroke="#D08B5B" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
                </g>
              );
            })}
            {read && <line x1={X(read.km)} x2={X(read.km)} y1={PP.t} y2={PH - PP.b} stroke="#9DB08A" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
          </svg>
        </>
      );
    }
  }
  return (
    <section ref={box} aria-label="Cross-section" className="relative shrink-0 border-t border-hair bg-deck px-4 pt-3 pb-2">
      <button onClick={onClose} aria-label="Close cross-section" className="absolute right-3 top-2.5 p-1.5 rounded-md text-mute hover:text-ink hover:bg-deck-2"><X size={16} /></button>
      <h3 className="font-display text-[16px] font-semibold flex items-center gap-2 mb-1 pr-10">
        <Route size={16} className="text-accent" />
        {P.canal ? `California Aqueduct${smp ? `, ${smp.L.toFixed(0)} km` : ""}` : <>Cross-section{smp ? `, ${distKm(P.a, P.b).toFixed(1)} km` : ""}</>}
      </h3>
      {body}
    </section>
  );
}

/* ---------------- walkthrough card ---------------- */
export function TourCard({ step, k, n, onPrev, onNext, onClose }) {
  if (!step) return null;
  return (
    <div role="dialog" aria-label="Guided walkthrough"
      className="absolute top-16 left-4 z-20 w-[380px] max-w-[calc(100%-2rem)] rounded-xl border border-accent/40 bg-space/95 backdrop-blur p-5 shadow-[0_20px_60px_rgba(0,0,0,.55),0_0_0_1px_rgba(157,176,138,.08)]">
      <div className="flex items-center gap-2 text-[12.5px] text-accent-2">
        <span className="font-display font-semibold">Step {k + 1} of {n}</span>
        <span className="flex gap-1 ml-1" aria-hidden="true">{Array.from({ length: n }, (_, j) => <span key={j} className={`h-1 w-5 rounded-full ${j <= k ? "bg-accent" : "bg-hair-2"}`} />)}</span>
      </div>
      <h2 className="font-display text-[23px] font-semibold leading-tight mt-2">{step.title}</h2>
      <div className="mt-2 text-[14.5px] leading-relaxed text-ink/90 space-y-2.5">{step.body}</div>
      <div className="flex items-center gap-2 mt-4">
        <button onClick={onPrev} disabled={k === 0} className="inline-flex items-center gap-1 text-sm text-mute hover:text-ink disabled:opacity-30 px-2 py-1.5"><ChevronLeft size={15} /> Back</button>
        <button onClick={onNext} autoFocus className="inline-flex items-center gap-1 rounded-md bg-accent text-space font-semibold text-sm px-3.5 py-1.5 hover:bg-accent-2">
          {k === n - 1 ? "Explore on your own" : <>Next <ChevronRight size={15} /></>}
        </button>
        <button onClick={onClose} className="ml-auto text-sm text-mute hover:text-ink px-2 py-1.5">Close</button>
      </div>
    </div>
  );
}

/* ---------------- intro ---------------- */
export function Intro({ D, onStart, onTour }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-space/80 backdrop-blur-[3px] intro-scan overflow-hidden">
      <div className="intro-in max-w-[640px] px-8 text-center">
        <p className="font-display text-accent-2 text-[15px] tracking-wide flex items-center justify-center gap-2"><Radar size={16} /> NISAR L-band radar over California's San Joaquin Valley</p>
        <h1 className="font-display font-bold text-[clamp(44px,7vw,84px)] leading-[0.95] mt-3 bg-gradient-to-b from-ink to-ink/65 bg-clip-text text-transparent">The Breathing Ground</h1>
        <p className="text-[17px] leading-relaxed text-ink/85 mt-5">
          Every winter the valley rises a little. Every summer it settles. Underneath that seasonal cycle, parts of it keep sinking,
          and comparing only two dates can miss it. {D.dates.length} radar passes from {fmtDate(D.dates[0])} to {fmtDate(D.dates[D.dates.length - 1])}, checked against GPS.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <button onClick={onTour} className="rounded-lg bg-accent text-space font-semibold px-5 py-2.5 hover:bg-accent-2 shadow-[0_0_30px_rgba(157,176,138,.4)]">Walk me through it</button>
          <button onClick={onStart} className="rounded-lg border border-hair-2 text-ink px-5 py-2.5 hover:border-accent/60 hover:text-accent-2">Explore the map</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- limits ---------------- */
export function Limits({ D, onClose }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Limits" className="fixed inset-0 z-40 grid place-items-center bg-black/55 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="scroll-thin relative max-w-[640px] max-h-[85vh] overflow-y-auto rounded-xl border border-hair-2 bg-deck p-7 text-[15px] leading-relaxed">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 p-1.5 rounded-md text-mute hover:text-ink hover:bg-deck-2"><X size={18} /></button>
        <h2 className="font-display text-[26px] font-semibold">What this map can and can't tell you</h2>
        {[
          ["What it shows", `Ground motion measured by NISAR along the radar's line of sight, from ${fmtDate(D.dates[0])} to ${fmtDate(D.dates[D.dates.length - 1])}, tied to GPS station ${D.meta.reference_station}. Negative means moving away from the satellite, which here is mostly sinking. The main map is the change from the first to the last date. The record spans about eleven months, so its net change can still include seasonal motion between the endpoints.`],
          ["What the fit means", "Each spot is fitted with a steady trend plus a once-a-year cycle. With less than a year of data the two can trade off, so the trend is shown with its uncertainty and is never the headline. Seasonal size and timing are shown only where the cycle passes a significance test. Elsewhere the app says the seasonal term is not significant here."],
          ["What it does not mean", "It does not say how much of the sinking is permanent. It does not measure water volume, aquifer health, or where to recharge. \"Insufficient evidence\" (hatched on the map) means we could not tell, not that the ground is stable."],
          ["How we checked it", `GPS stations that were never used to calibrate the radar (${D.meta.held_out_stations.join(", ")}) are compared with NISAR in the GPS check, including the one that disagrees most. NISAR and GPS agree to about ${AGREEMENT.rms_cm} cm per pair, mostly 12 days with two 24-day gaps (root mean square, ${AGREEMENT.n_stations} held-out stations). A separate check at ${AGREEMENT.selfcheck_n} stations gives ${AGREEMENT.selfcheck}. Motion smaller than that is not resolved at a single spot. Toward the east edge of the map NISAR reads about 2 to 3 cm less sinking than GPS, so sinking there is understated, not overstated. A handful of check stations in one radar frame make a prototype check, not a valley-wide accuracy claim.`],
          ["About the data", `NISAR data here is provisional. Validated Level 0–2 products for newer acquisitions began release in November 2026; reprocessing of this older record is planned for 2027. Corrected for the ionosphere, the troposphere and solid Earth tides using the product's own correction layers, read at each spot's ground height. A second NISAR viewing direction (descending track) is used only as a cross-check of vertical vs east-west motion. It is noisier (about ${AGREEMENT.descending_cm} cm per pair) and misses Hanford. Each map cell is the median of the radar pixels inside it. Single pixels on farmland can show soil-moisture effects that look like sinking. Published figures (levee heights, canal capacity, valley-wide subsidence) are other people's measurements, credited where shown.`],
        ].map(([h, p]) => (
          <div key={h}><h3 className="font-display text-[18px] font-semibold mt-5 mb-1 text-accent-2">{h}</h3><p className="text-ink/90">{p}</p></div>
        ))}
        <p className="mt-4 text-sm"><a href="https://nisar-docs.asf.alaska.edu/availability-overview/" target="_blank" rel="noreferrer" className="text-accent-2 underline">ASF guide to NISAR product maturity and release dates</a></p>
        <h3 className="font-display text-[18px] font-semibold mt-5 mb-2 text-accent-2">Keyboard</h3>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[14px]">
          {[["1–7", "Switch views"], ["Space", "Play the record"], ["← →", "Step one pass"], ["G", "GPS check"], ["Ctrl K", "Search everything"], ["L", "Radar lens"], ["D", "3D"], ["P", "Cross-section"], ["W", "Walkthrough"], ["F", "Crop fields"], ["Shift-click", "Compare a second spot"], ["Esc", "Close or cancel"]].map(([k, d]) => (
            <li key={k} className="flex items-center gap-2"><kbd className="font-sans text-[12px] font-semibold border border-hair-2 border-b-2 rounded px-1.5 py-0.5 bg-space">{k}</kbd><span className="text-ink/85">{d}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Explorer header: says plainly when the map is not real NISAR results (D6), or is a draft.
export function DataStatus({ D }) {
  const [open, setOpen] = useState(false);
  const draft = isDraft(D);
  if (!D.synthetic && !draft) return null;
  const incomplete = D.fallback === "incomplete";
  const text = D.synthetic
    ? incomplete
      ? "The map could only load part of its NISAR dataset. It is showing synthetic sample data."
      : "NISAR displacement data is unavailable here. The map is showing synthetic sample data."
    : "First real NISAR results. Labels can still change until the checks pass: sign at the moving GPS stations, the seasonal test on stable ground, and the held-out residual table.";
  return (
    <div className="relative shrink-0">
      <button onClick={() => setOpen(!open)} aria-expanded={open}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-medium ${D.synthetic ? "border-sink/60 text-sink bg-sink/10" : "border-accent/50 text-accent-2 bg-accent/10"}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${D.synthetic ? "bg-sink" : "bg-accent"}`} />
        {incomplete ? "Incomplete NISAR data" : D.synthetic ? "Synthetic preview" : "Draft results"}
      </button>
      {open && <p className="absolute left-0 top-full mt-2 z-40 w-[300px] rounded-lg border border-hair-2 bg-deck p-3 text-[13px] leading-snug text-ink/90 shadow-xl">{text}</p>}
    </div>
  );
}

// Shown only while the app runs on the synthetic sample files. Disappears by itself when the
// real NISAR files are in public/data/ (AGENTS.md rule 6: never present placeholder data as NASA data).
export function PreviewTag({ D }) {
  const [open, setOpen] = useState(false);
  const incomplete = D.fallback === "incomplete";
  return (
    <button onClick={() => setOpen(!open)} aria-expanded={open}
      className={`fixed right-3 bottom-3 z-50 max-w-[300px] text-left ${open ? "rounded-lg" : "rounded-full"} border border-hair-2 bg-space/90 backdrop-blur px-3 py-1.5 text-[12px] text-mute hover:text-ink shadow-lg`}>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent mr-2 align-middle" />{incomplete ? "Incomplete NISAR data" : "Preview data"}
      {open && <span className="block mt-1 leading-snug text-ink/85">{incomplete ? "The app could only load part of its NISAR dataset. The ground motion charts show synthetic sample data." : "The ground motion charts show synthetic sample data."}</span>}
    </button>
  );
}

