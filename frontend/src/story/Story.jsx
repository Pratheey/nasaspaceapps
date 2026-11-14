import { useEffect, useMemo, useRef, useState } from "react";
import Lenis from "lenis";
import { ArrowDown, Map as MapIcon, Radar, Satellite, Waves, CalendarRange, Activity, Route, Box } from "lucide-react";
import { NasaImage, Starfield, SatelliteArt, IMAGES } from "./art.jsx";
import Globe from "./Globe.jsx";
import { InsarExplainer, AquiferExplainer, Term } from "./Explainers.jsx";
import { useInView, useProgress, useScrollY, seg, ease, reduceMotion } from "./hooks.js";
import { fitAt, mostMisleadingPair } from "../lib/data.js";
import { cm, fmtShort, fmtDate } from "../lib/fmt.js";
import { fringe } from "../lib/colors.js";

/* ------------------------------------------------------------------ */
export default function Story({ D, onExplore }) {
  useEffect(() => {
    if (reduceMotion) return;
    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
    let raf;
    const loop = (t) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);
  const demo = useMemo(() => ({
    sink: D.stations.find((s) => s.station === "P307") || D.stations[0],
    calm: D.stations.find((s) => s.station === "P302") || D.stations[1] || D.stations[0],
  }), [D]);

  return (
    <div className="bg-space text-ink overflow-x-clip">
      <TopBar D={D} onExplore={onExplore} />
      <Hero D={D} onExplore={onExplore} />
      <PoleScene />
      <AquiferScene />
      <BreatheScene D={D} demo={demo} />
      <LieScene D={D} st={demo.sink} />
      <OrbitScene />
      <InstrumentScene D={D} />
      <MeasureScene />
      <GpsScene D={D} />
      <MattersScene />
      <Finale D={D} onExplore={onExplore} />
      <Credits D={D} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
function TopBar({ D, onExplore }) {
  const y = useScrollY();
  return (
    <header className={`fixed top-0 inset-x-0 z-40 transition-colors duration-500 ${y > 40 ? "bg-space/80 backdrop-blur-md border-b border-hair" : ""}`}>
      {D.synthetic && (
        <div className="text-[12px] font-semibold text-[#0B1830] px-6 py-1 bg-[repeating-linear-gradient(-45deg,#6FA8FF_0_14px,#4F8BEA_14px_28px)]">
          Charts on this page use synthetic data while the real NISAR results are processed. They are not NASA measurements.
        </div>
      )}
      <div className="flex items-center gap-4 px-6 md:px-10 h-16">
        <Mark />
        <span className="font-display font-semibold text-[17px] tracking-wide max-sm:hidden">The Breathing Ground</span>
        <nav className="ml-auto hidden md:flex items-center gap-7 text-[14px] text-ink/75">
          {[["Story", "#breathe"], ["The radar", "#radar"], ["Why it matters", "#matters"]].map(([t, h]) => (
            <a key={t} href={h} onClick={(e) => { e.preventDefault(); document.querySelector(h)?.scrollIntoView({ behavior: "smooth" }); }} className="hover:text-accent-2 transition-colors">{t}</a>
          ))}
        </nav>
        <button onClick={onExplore} className="ml-auto md:ml-4 inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-accent text-space font-semibold text-[14px] px-4 py-2 hover:bg-accent-2 shadow-[0_0_24px_rgba(111,168,255,.35)] transition">
          <MapIcon size={15} /> Open the live map
        </button>
      </div>
    </header>
  );
}

export function Mark({ size = 30 }) {
  return (
    <span className="relative grid place-items-center rounded-full border border-accent/60 shadow-[0_0_16px_rgba(111,168,255,.35)]" style={{ width: size, height: size }} aria-hidden="true">
      <span className="absolute inset-[22%] rounded-full border border-accent/40" />
      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
function Hero({ D, onExplore }) {
  const y = useScrollY();
  const fade = Math.max(0, 1 - y / 700);
  return (
    <section className="relative h-[100svh] min-h-[640px] overflow-hidden">
      <div className="absolute inset-0" style={{ transform: `translate3d(0, ${y * 0.35}px, 0) scale(${1.08 + y * 0.0002})` }}>
        <NasaImage srcs={IMAGES.orbitCalifornia} alt="Artist's concept of the NISAR satellite in orbit over central and Northern California"
          className="absolute inset-0 w-full h-full object-cover object-[65%_40%]"
          fallback={<div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_70%_120%,#1d3a5c_0%,#0F1420_60%)]"><SatelliteArt className="w-[70%] max-w-[760px] opacity-90 translate-x-[18%]" /></div>} />
      </div>
      <Starfield className="absolute inset-0 w-full h-full opacity-60 mix-blend-screen" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#0F1420_0%,rgba(15,20,32,.86)_34%,rgba(15,20,32,.25)_70%,rgba(15,20,32,.1)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-space to-transparent" />

      <div className="relative h-full flex flex-col justify-center pt-24 max-sm:pt-36 pb-10 px-6 md:px-14 max-w-[1400px] mx-auto" style={{ opacity: fade }}>
        <div className="intro-in max-w-[780px]">
          <p className="font-display text-accent-2 text-[15px] flex items-center gap-2"><Radar size={16} /> NASA Space Apps 2026, Dancing with the SARs</p>
          <h1 className="font-display font-bold leading-[0.92] tracking-[-0.01em] text-[clamp(46px,6.6vw,104px)] mt-4">
            The ground breathes.
            <span className="block">It also sinks.</span>
          </h1>
          <p className="text-[clamp(16px,1.5vw,19px)] leading-relaxed text-ink/80 mt-7 max-w-[600px]">
            Every winter California's San Joaquin Valley rises a little. Every summer it settles. Underneath that rhythm,
            parts of it keep going down. We used the first year of NISAR radar to separate the two, and to show how sure we are.
          </p>
          <div className="flex flex-wrap gap-3 mt-9">
            <button onClick={onExplore} className="inline-flex items-center gap-2 rounded-full bg-accent text-space font-semibold px-6 py-3 hover:bg-accent-2 shadow-[0_0_34px_rgba(111,168,255,.45)] transition">
              <MapIcon size={17} /> Open the live map
            </button>
            <button onClick={() => document.querySelector("#pole")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center gap-2 rounded-full border border-hair-2 bg-space/40 backdrop-blur px-6 py-3 hover:border-accent/60 hover:text-accent-2 transition">
              <ArrowDown size={17} /> Read the story
            </button>
          </div>
        </div>
        <dl className="shrink-0 mt-12 grid grid-cols-2 md:grid-cols-4 gap-px bg-hair rounded-xl overflow-hidden max-w-[880px] border border-hair">
          {[["Launched", "30 July 2025"], ["Antenna reflector", "12 metres"], ["Radar wavelength", "24 cm, L-band"], ["Revisit", "Every 12 days"]].map(([k, v]) => (
            <div key={k} className="bg-space/75 backdrop-blur px-4 py-3">
              <dt className="text-[12px] text-mute">{k}</dt>
              <dd className="font-display text-[19px] font-semibold mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[11.5px] text-mute">Image: NISAR over California, artist's concept. NASA/JPL-Caltech.</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
// A pole near Mendota, with signs where the ground stood in 1925, 1955 and 1977.
function PoleScene() {
  const [ref, p] = useProgress();
  const t = ease(seg(p, 0.12, 0.72));
  const year = Math.round(1925 + t * 52);
  const metres = (t * 9).toFixed(1);
  const H = 520, top = 70, drop = 360; // pixels for 9 m
  const ground = top + t * drop;
  const signs = [[1925, 0], [1955, 0.55], [1977, 1]];
  return (
    <section id="pole" ref={ref} className="relative h-[260vh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden grid md:grid-cols-2 items-center gap-10 px-6 md:px-14 max-w-[1400px] mx-auto">
        <div className="max-w-[560px]">
          <p className="font-display text-accent-2 text-[15px]">It has happened here before</p>
          <h2 className="font-display font-bold text-[clamp(40px,5.5vw,84px)] leading-[0.95] mt-3">
            {year < 1977 ? <>{year}.</> : <>Nine metres.</>}
          </h2>
          <p className="text-[18px] leading-relaxed text-ink/80 mt-6">
            Southwest of Mendota, pumping groundwater for irrigation lowered the land surface by about 9 metres between 1925 and 1977.
            Surveyors marked where the ground used to be on a utility pole.
          </p>
          <p className={`text-[18px] leading-relaxed text-ink/80 mt-4 transition-opacity duration-700 ${p > 0.75 ? "opacity-100" : "opacity-0"}`}>
            Surface water from new canals slowed it down. In dry years the pumps came back, and so did the sinking.
          </p>
          <p className="text-[12.5px] text-mute mt-6">Figures: USGS. Published measurements, not ours.</p>
        </div>
        <div className="relative h-[540px] max-md:h-[420px]">
          <svg viewBox={`0 0 420 ${H}`} className="h-full w-auto mx-auto" role="img" aria-label={`Pole with signs for 1925, 1955 and 1977; the ground has dropped ${metres} metres`}>
            <defs>
              <linearGradient id="earth" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#5a3b24" /><stop offset="1" stopColor="#1a120c" /></linearGradient>
              <linearGradient id="poleg" x1="0" x2="1"><stop offset="0" stopColor="#3b2e22" /><stop offset="0.5" stopColor="#6b5640" /><stop offset="1" stopColor="#2d241b" /></linearGradient>
            </defs>
            <rect x="196" y="20" width="22" height={H} fill="url(#poleg)" />
            <rect x="150" y="34" width="114" height="8" fill="#3b2e22" />
            {signs.map(([yr, f]) => {
              const sy = top + f * drop - 30;
              const lit = t >= f - 0.001;
              return (
                <g key={yr} style={{ opacity: lit ? 1 : 0.25, transition: "opacity .5s" }}>
                  <rect x="222" y={sy} width="84" height="30" rx="2" fill={lit ? "#6FA8FF" : "#2A3346"} />
                  <text x="264" y={sy + 21} textAnchor="middle" fontFamily="Saira Semi Condensed" fontWeight="700" fontSize="19" fill="#0F1420">{yr}</text>
                </g>
              );
            })}
            <rect x="0" y={ground} width="420" height={H - ground} fill="url(#earth)" />
            <line x1="0" x2="420" y1={ground} y2={ground} stroke="#F0705A" strokeWidth="2.5" />
            <line x1="40" x2="40" y1={top} y2={ground} stroke="#A9CBFF" strokeDasharray="4 4" />
            <text x="48" y={(top + ground) / 2} fontFamily="Saira Semi Condensed" fontWeight="600" fontSize="22" fill="#A9CBFF">{metres} m</text>
          </svg>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function AquiferScene() {
  const [ref, seen] = useInView(0.2);
  return (
    <section ref={ref} className="relative py-[14vh] px-6 md:px-14 max-w-[1400px] mx-auto">
      <div className={`grid lg:grid-cols-[1fr_1.2fr] gap-14 items-center transition-all duration-1000 ${seen ? "opacity-100" : "opacity-0 translate-y-8"}`}>
        <div>
          <p className="font-display text-accent-2 text-[15px]">Why the ground breathes</p>
          <h2 className="font-display font-bold text-[clamp(36px,4.4vw,64px)] leading-[0.98] mt-3">The valley floor sits on a sponge.</h2>
          <p className="text-[18px] leading-relaxed text-ink/80 mt-6">
            Beneath the farms is an <Term t="aquifer" />: sand and gravel full of water, interleaved with clay. Water pressure helps hold up
            the ground above. Pump in summer and the pressure drops. Recharge in winter and it comes back.
          </p>
          <p className="text-[18px] leading-relaxed text-ink/80 mt-4">Try it. Then keep scrolling to see what the radar actually measured.</p>
        </div>
        <AquiferExplainer />
      </div>
    </section>
  );
}

function OrbitScene() {
  const [ref, seen] = useInView(0.2);
  return (
    <section ref={ref} className="relative py-[14vh] overflow-hidden">
      <Starfield className="absolute inset-0 w-full h-full opacity-40" density={160} />
      <div className={`relative grid lg:grid-cols-[1fr_1.1fr] gap-10 items-center px-6 md:px-14 max-w-[1400px] mx-auto transition-all duration-1000 ${seen ? "opacity-100" : "opacity-0 translate-y-8"}`}>
        <div>
          <p className="font-display text-accent-2 text-[15px]">Every 12 days, almost everywhere</p>
          <h2 className="font-display font-bold text-[clamp(36px,4.4vw,64px)] leading-[0.98] mt-3">One satellite, circling pole to pole.</h2>
          <p className="text-[18px] leading-relaxed text-ink/80 mt-6">
            NISAR flies about 747 km up on a near-polar orbit, so Earth turns beneath it and each pass covers a new strip. Every 12 days it
            comes back over the same ground from the same angle. That repeat is what lets us compare passes.
          </p>
          <p className="text-[15px] text-mute mt-5">The globe simulates the orbit's shape. It is not NISAR's live position.</p>
        </div>
        <Globe className="max-w-[640px] w-full mx-auto" />
      </div>
    </section>
  );
}

function MeasureScene() {
  const [ref, seen] = useInView(0.2);
  return (
    <section ref={ref} className="relative py-[12vh] px-6 md:px-14 max-w-[1400px] mx-auto">
      <div className={`grid lg:grid-cols-[1fr_1.2fr] gap-14 items-center transition-all duration-1000 ${seen ? "opacity-100" : "opacity-0 translate-y-8"}`}>
        <div>
          <p className="font-display text-accent-2 text-[15px]">How a radar measures a centimetre</p>
          <h2 className="font-display font-bold text-[clamp(36px,4.4vw,64px)] leading-[0.98] mt-3">It counts the wave, not the picture.</h2>
          <p className="text-[18px] leading-relaxed text-ink/80 mt-6">
            When the ground sinks, the radar pulse has a little farther to travel, there and back, so the wave comes home slightly later in
            its cycle. That shift in phase can be measured to a small fraction of a wavelength, which is how a 24 cm radar sees millimetres.
            Drag the slider.
          </p>
          <p className="text-[15px] text-mute mt-5">Each full <Term t="fringe" /> of color is 11.9 cm of motion.</p>
        </div>
        <InsarExplainer />
      </div>
    </section>
  );
}
/* ------------------------------------------------------------------ */
// Scroll drives time. Two stations draw themselves, then split into trend and seasonal.
function BreatheScene({ D, demo }) {
  const [ref, p] = useProgress();
  const draw = seg(p, 0.08, 0.55);
  const split = seg(p, 0.62, 0.85);
  const W = 760, H = 420, P = { l: 50, r: 20, t: 30, b: 40 };
  const N = D.dates.length;
  const series = [
    { st: demo.calm, color: "#5FC9E0" },
    { st: demo.sink, color: "#F0705A" },
  ].map(({ st, color }) => ({ st, color, v: D.values[st.cell_index] || [] }));
  const all = series.flatMap((s) => s.v.filter((x) => x != null).map((x) => x * 100));
  const lo = Math.min(0, ...all) - 1, hi = Math.max(0, ...all) + 1;
  const X = (k) => P.l + (k / (N - 1)) * (W - P.l - P.r);
  const Y = (v) => P.t + ((hi - v) / (hi - lo)) * (H - P.t - P.b);
  const shown = Math.max(1, Math.round(draw * (N - 1)));
  const captions = [
    "Two GPS stations, one radar. Scroll to play eleven months of NISAR passes.",
    "One stays almost level. The other drops, pass after pass.",
    "Both rise and fall with the seasons by a few millimetres. Under that, one keeps sinking.",
  ];
  const cap = split > 0.1 ? 2 : draw > 0.6 ? 1 : 0;
  return (
    <section id="breathe" ref={ref} className="relative h-[320vh]">
      <div className="sticky top-0 h-[100svh] grid lg:grid-cols-[1fr_1.35fr] items-center gap-10 px-6 md:px-14 max-w-[1400px] mx-auto">
        <div className="max-w-[520px]">
          <p className="font-display text-accent-2 text-[15px]">The valley breathes</p>
          <h2 className="font-display font-bold text-[clamp(38px,4.8vw,72px)] leading-[0.98] mt-3">Every pass tells you where the ground is today.</h2>
          <p key={cap} className="text-[18px] leading-relaxed text-ink/85 mt-6 min-h-[5.5em] [animation:rise-in_.6s_both]">{captions[cap]}</p>
          <div className="mt-4 flex gap-5 text-[14px]">
            {series.map((s) => (
              <span key={s.st.station} className="inline-flex items-center gap-2"><span className="w-5 h-[3px] rounded" style={{ background: s.color }} />GPS station {s.st.station}</span>
            ))}
          </div>
          <p className="mt-6 font-display text-[44px] font-bold leading-none tabular-nums">{fmtShort(D.dates[Math.min(N - 1, shown)])}</p>
          <p className="text-[13px] text-mute">Pass {Math.min(N, shown + 1)} of {N}{D.synthetic ? ". Synthetic data." : "."}</p>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto chart" role="img" aria-label="Ground motion at two stations over the NISAR record">
          {[-8, -6, -4, -2, 0, 2].filter((v) => v > lo && v < hi).map((v) => (
            <g key={v}><line x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} className={v === 0 ? "zero" : "grid"} /><text x={P.l - 8} y={Y(v) + 4} textAnchor="end">{v > 0 ? "+" : v < 0 ? "−" : ""}{Math.abs(v)} cm</text></g>
          ))}
          {series.map((s) => {
            const pts = s.v.slice(0, shown + 1).map((x, k) => (x == null ? null : `${X(k)},${Y(x * 100)}`)).filter(Boolean).join(" ");
            const f0 = fitAt(D, s.st.cell_index, D.tYears[0]);
            const trend = f0 && D.tYears.map((t, k) => `${k ? "L" : "M"}${X(k)},${Y((fitAt(D, s.st.cell_index, t).trend - f0.trend) * 100)}`).join("");
            return (
              <g key={s.st.station}>
                <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2.5" style={{ filter: `drop-shadow(0 0 6px ${s.color}88)`, opacity: 1 - split * 0.55 }} />
                {s.v.slice(0, shown + 1).map((x, k) => x != null && <circle key={k} cx={X(k)} cy={Y(x * 100)} r="3.2" fill="#0F1420" stroke={s.color} strokeWidth="1.5" style={{ opacity: 1 - split * 0.5 }} />)}
                {trend && <path d={trend} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray="8 6" pathLength="1" style={{ strokeDasharray: `${split} 1`, opacity: split }} />}
              </g>
            );
          })}
          {split > 0.05 && <text x={W - P.r} y={P.t - 8} textAnchor="end" style={{ opacity: split }}>dashed: the trend underneath the seasons</text>}
        </svg>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
// Drag the two markers. The comparison you'd make with two satellite images.
function LieScene({ D, st }) {
  const i = st.cell_index, v = D.values[i] || [], N = D.dates.length;
  const lie = useMemo(() => mostMisleadingPair(D, i), [D, i]);
  const [a, setA] = useState(lie?.k1 ?? 2);
  const [b, setB] = useState(lie?.k2 ?? 10);
  const svg = useRef(null);
  const drag = useRef(null);
  const [inRef, seen] = useInView(0.3);
  const W = 760, H = 300, P = { l: 50, r: 20, t: 46, b: 34 };
  const ok = v.filter((x) => x != null).map((x) => x * 100);
  const lo = Math.min(0, ...ok) - 1, hi = Math.max(0, ...ok) + 1;
  const X = (k) => P.l + (k / (N - 1)) * (W - P.l - P.r);
  const Y = (x) => P.t + ((hi - x) / (hi - lo)) * (H - P.t - P.b);
  const diff = v[a] != null && v[b] != null ? v[b] - v[a] : null;
  const days = Math.round((D.dates[b] - D.dates[a]) / 864e5);
  const B = D.grid.trend_m_per_yr[i];
  const exp = B == null ? null : B * (days / 365.25);
  const pick = (e) => {
    const r = svg.current.getBoundingClientRect();
    const k = Math.round(((((e.clientX - r.left) / r.width) * W - P.l) / (W - P.l - P.r)) * (N - 1));
    return Math.max(0, Math.min(N - 1, k));
  };
  const misleading = diff != null && exp != null && diff > -(D.meta.sigma_net_m || 0.01) && exp < -2 * (D.meta.sigma_net_m || 0.01);
  return (
    <section ref={inRef} className="relative py-[18vh] px-6 md:px-14 max-w-[1400px] mx-auto">
      <div className={`grid lg:grid-cols-[1fr_1.35fr] gap-12 items-center transition-all duration-1000 ${seen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="max-w-[520px]">
          <p className="font-display text-accent-2 text-[15px]">Two dates can lie</p>
          <h2 className="font-display font-bold text-[clamp(38px,4.8vw,72px)] leading-[0.98] mt-3">Compare the wrong two days and the sinking disappears.</h2>
          <p className="text-[18px] leading-relaxed text-ink/80 mt-6">
            The quickest way to read satellite data is before and after. Here that can mislead. Drag A and B along the record at GPS station {st.station}.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-px bg-hair rounded-xl overflow-hidden border border-hair">
            <div className="bg-deck px-5 py-4">
              <p className="text-[13px] text-mute">A to B says</p>
              <p className={`font-display text-[40px] font-bold leading-none mt-1 ${misleading ? "text-accent-2" : ""}`}>{cm(diff)}</p>
            </div>
            <div className="bg-deck px-5 py-4">
              <p className="text-[13px] text-mute">The trend over {days} days says</p>
              <p className="font-display text-[40px] font-bold leading-none mt-1 text-sink">{cm(exp)}</p>
            </div>
          </div>
          <p className="text-[15px] mt-4 min-h-[3em] text-ink/85">{misleading ? "These two dates hide the sinking." : "Try dates a few months apart, one in a dry month and one after winter."}</p>
          {lie && <button onClick={() => { setA(lie.k1); setB(lie.k2); }} className="mt-1 text-[14px] text-accent-2 underline underline-offset-4 decoration-accent/40 hover:decoration-accent">Show the most misleading pair</button>}
        </div>
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto chart touch-none select-none"
          onPointerDown={(e) => { svg.current.setPointerCapture(e.pointerId); const k = pick(e); drag.current = Math.abs(k - a) <= Math.abs(k - b) ? "a" : "b"; (drag.current === "a" ? setA : setB)(drag.current === "a" ? Math.min(k, b - 1) : Math.max(k, a + 1)); }}
          onPointerMove={(e) => { if (!drag.current) return; const k = pick(e); drag.current === "a" ? setA(Math.min(k, b - 1)) : setB(Math.max(k, a + 1)); }}
          onPointerUp={() => (drag.current = null)} role="img" aria-label="Record at one station with two draggable dates">
          <rect x={X(a)} y={P.t} width={X(b) - X(a)} height={H - P.t - P.b} fill="#6FA8FF" opacity="0.07" />
          <polyline points={v.map((x, k) => (x == null ? null : `${X(k)},${Y(x * 100)}`)).filter(Boolean).join(" ")} fill="none" stroke="#F0705A" strokeWidth="2" opacity="0.8" />
          {v.map((x, k) => x != null && <circle key={k} cx={X(k)} cy={Y(x * 100)} r={k === a || k === b ? 6 : 3} fill={k === a || k === b ? "#6FA8FF" : "#0F1420"} stroke={k === a || k === b ? "#A9CBFF" : "#F0705A"} strokeWidth="1.5" />)}
          {[["A", a], ["B", b]].map(([n, k]) => (
            <g key={n} className="cursor-grab">
              <line x1={X(k)} x2={X(k)} y1={P.t - 14} y2={H - P.b} stroke="#6FA8FF" strokeWidth="2" />
              <rect x={X(k) - 13} y={P.t - 38} width="26" height="24" rx="5" fill="#6FA8FF" />
              <text x={X(k)} y={P.t - 21} textAnchor="middle" style={{ fill: "#0F1420", font: "700 15px 'Saira Semi Condensed', sans-serif" }}>{n}</text>
              <text x={X(k)} y={H - 12} textAnchor="middle">{fmtShort(D.dates[k])}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function InstrumentScene({ D }) {
  const [ref, seen] = useInView(0.2);
  return (
    <section id="radar" ref={ref} className="relative py-[16vh] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(111,168,255,.10),transparent_55%)]" />
      <div className="relative px-6 md:px-14 max-w-[1400px] mx-auto">
        <div className={`grid lg:grid-cols-2 gap-14 items-center transition-all duration-1000 ${seen ? "opacity-100" : "opacity-0 translate-y-8"}`}>
          <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-hair-2 bg-deck">
            <NasaImage srcs={IMAGES.orbit} alt="Artist's concept of NISAR in orbit" className="absolute inset-0 w-full h-full object-cover"
              fallback={<div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_50%_120%,#1d3a5c,#0F1420_65%)]"><SatelliteArt className="w-[85%]" /></div>} />
            <div className="absolute inset-0 bg-gradient-to-t from-space/70 to-transparent" />
            <p className="absolute left-4 bottom-3 text-[11.5px] text-ink/70">NISAR in orbit, artist's concept. NASA/JPL-Caltech.</p>
          </div>
          <div>
            <p className="font-display text-accent-2 text-[15px]">How NISAR sees it</p>
            <h2 className="font-display font-bold text-[clamp(36px,4.4vw,64px)] leading-[0.98] mt-3">Radar that measures the ground to the centimetre, through cloud, day and night.</h2>
            <p className="text-[18px] leading-relaxed text-ink/80 mt-6">
              NISAR is a joint mission of NASA and ISRO. Its <Term t="L-band" /> radar bounces 24 cm microwaves off the ground from a 12-metre gold mesh reflector,
              the largest NASA has deployed in space. Comparing two passes makes an <Term t="interferogram" />: how far the ground moved along the radar's <Term t="line of sight" />.
            </p>
            <dl className="grid grid-cols-2 gap-px bg-hair rounded-xl overflow-hidden border border-hair mt-8">
              {[["Satellite", "NASA and ISRO"], ["Orbit", "About 747 km up"], ["Wavelength", "24 cm, L-band"], ["Same spot again", "Every 12 days"]].map(([k, v]) => (
                <div key={k} className="bg-deck px-4 py-3"><dt className="text-[12px] text-mute">{k}</dt><dd className="font-display text-[19px] font-semibold">{v}</dd></div>
              ))}
            </dl>
          </div>
        </div>
        <FringeStrip D={D} />
      </div>
    </section>
  );
}

// The data as a radar scientist sees it: fringes multiply as sinking accumulates.
function FringeStrip({ D }) {
  const ref = useRef(null);
  const [wrap, seen] = useInView(0.3);
  useEffect(() => {
    if (!seen) return;
    const c = ref.current, x = c.getContext("2d");
    const g = D.meta.grid;
    c.width = g.ncols; c.height = g.nrows;
    const img = x.createImageData(g.ncols, g.nrows);
    let raf, t0 = performance.now();
    const frame = (now) => {
      const t = reduceMotion ? 1 : Math.min(1, (now - t0) / 6000);
      for (let i = 0; i < D.n; i++) {
        const v = D.grid.net_change_m[i];
        const col = v == null ? [22, 28, 42] : fringe(v * t);
        img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [seen, D]);
  return (
    <div ref={wrap} className="mt-20 grid lg:grid-cols-[1.3fr_1fr] gap-10 items-center">
      <div className="relative rounded-2xl overflow-hidden border border-hair-2 shadow-[0_30px_80px_rgba(0,0,0,.5)]">
        <canvas ref={ref} className="w-full h-auto [image-rendering:pixelated] block" aria-label="The study area drawn as radar fringes, building up as the sinking accumulates" />
        <div className="absolute inset-0 ring-1 ring-inset ring-white/5 pointer-events-none" />
      </div>
      <div>
        <h3 className="font-display text-[30px] font-semibold leading-tight">Each rainbow is 11.9 centimetres.</h3>
        <p className="text-[17px] leading-relaxed text-ink/80 mt-4">
          This is our study area the way radar scientists look at it. One full cycle of color is half the radar's wavelength of motion.
          As the year's sinking adds up, the bands crowd together over the places that sink fastest.{D.synthetic ? " Synthetic data until the real results are in." : ""}
        </p>
        <p className="text-[14px] text-mute mt-4 flex items-center gap-2"><Waves size={15} className="text-accent" /> In the live map: Radar fringes view.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function GpsScene({ D }) {
  const [ref, seen] = useInView(0.25);
  return (
    <section ref={ref} className="relative py-[14vh] px-6 md:px-14 max-w-[1400px] mx-auto">
      <div className={`grid lg:grid-cols-2 gap-14 items-center transition-all duration-1000 ${seen ? "opacity-100" : "opacity-0 translate-y-8"}`}>
        <div>
          <p className="font-display text-accent-2 text-[15px]">How sure are we</p>
          <h2 className="font-display font-bold text-[clamp(36px,4.4vw,64px)] leading-[0.98] mt-3">We check the radar against instruments it has never seen.</h2>
          <p className="text-[18px] leading-relaxed text-ink/80 mt-6">
            Four GPS stations sit in the study area. One, {D.meta.reference_station}, ties the radar to the ground. The other three,
            {" "}{D.meta.held_out_stations.join(", ")}, are <Term t="held out" /> and used only to test it. Each pass is also corrected for the <Term t="ionosphere" />. Every number in the map comes with its uncertainty,
            and where the evidence is too thin, the map says so instead of guessing.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {D.stations.map((st, n) => (
            <div key={st.station} className="rounded-xl border border-hair-2 bg-deck/70 p-5" style={{ transitionDelay: `${n * 120}ms` }}>
              <div className="flex items-center justify-between">
                <span className="font-display text-[24px] font-bold">{st.station}</span>
                <Satellite size={18} className={st.role === "reference" ? "text-accent" : "text-rise"} />
              </div>
              <p className={`text-[13px] mt-1 ${st.role === "reference" ? "text-accent-2" : "text-rise"}`}>{st.role === "reference" ? "Reference: ties the radar down" : "Held out: an independent check"}</p>
              {st.residuals && st.residuals.net_m != null && <p className="text-[13px] text-mute mt-3">Radar minus GPS over the record: <span className="text-ink">{cm(st.residuals.net_m)}</span></p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function MattersScene() {
  const [ref, seen] = useInView(0.2);
  const items = [
    ["195 → 188 ft", "Corcoran's flood levee, built in 1983, had sunk 7 feet by 2017. Rebuilt to 192 ft, it was back at 188 ft by 2023.", "SJV Water, 2023"],
    ["Up to 60%", "of capacity lost in sinking sections of the Friant-Kern Canal, which carries water to more than a million acres of farmland.", "SJV Conveyance Study summary, 2026; Ag Alert, 2025"],
    ["The law", "California's groundwater law treats subsidence from pumping as an undesirable result that local agencies must monitor.", "Sustainable Groundwater Management Act"],
  ];
  return (
    <section id="matters" ref={ref} className="relative py-[16vh] border-y border-hair bg-[linear-gradient(180deg,#0F1420,#121a2a)]">
      <div className="px-6 md:px-14 max-w-[1400px] mx-auto">
        <p className="font-display text-accent-2 text-[15px]">Why it matters</p>
        <h2 className="font-display font-bold text-[clamp(36px,4.4vw,64px)] leading-[0.98] mt-3 max-w-[900px]">Sinking ground breaks the things built on it.</h2>
        <div className="grid md:grid-cols-3 gap-px bg-hair rounded-2xl overflow-hidden border border-hair mt-12">
          {items.map(([big, text, src], n) => (
            <div key={big} className={`bg-space p-7 transition-all duration-1000 ${seen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ transitionDelay: `${n * 140}ms` }}>
              <p className="font-display text-[clamp(34px,3.6vw,52px)] font-bold leading-none text-sink">{big}</p>
              <p className="text-[16px] leading-relaxed text-ink/85 mt-5">{text}</p>
              <p className="text-[12px] text-mute mt-4">{src}. Published figures, not ours.</p>
            </div>
          ))}
        </div>
        <p className="text-[18px] leading-relaxed text-ink/80 mt-12 max-w-[760px]">
          Once NISAR's validated data arrives in 2027, the same method can watch every pumped farm basin it covers, every 12 days:
          the San Joaquin Valley, Punjab, Mexico City, Tehran.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function Finale({ D, onExplore }) {
  const feats = [
    [Activity, "Watch the valley breathe", "Play the record pass by pass, in 2D or 3D."],
    [CalendarRange, "Catch the misleading dates", "Every pair of dates at any spot, and the ones that hide the sinking."],
    [Route, "Cut a cross-section", "Draw a line along a canal or levee and see it move."],
    [Box, "Check the evidence", "GPS comparison, uncertainty and the data behind every number."],
  ];
  return (
    <section className="relative py-[18vh] overflow-hidden">
      <Starfield className="absolute inset-0 w-full h-full opacity-50" density={180} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(111,168,255,.16),transparent_60%)]" />
      <div className="relative px-6 md:px-14 max-w-[1100px] mx-auto text-center">
        <h2 className="font-display font-bold text-[clamp(44px,7vw,110px)] leading-[0.92]">See it for yourself.</h2>
        <p className="text-[19px] text-ink/80 mt-6 max-w-[620px] mx-auto">{D.dates.length} radar passes from {fmtDate(D.dates[0])} to {fmtDate(D.dates[D.dates.length - 1])}, over Corcoran and Mendota. Click any spot.</p>
        <button onClick={onExplore} className="mt-10 inline-flex items-center gap-2 rounded-full bg-accent text-space font-semibold text-[17px] px-8 py-4 hover:bg-accent-2 shadow-[0_0_50px_rgba(111,168,255,.5)] transition">
          <MapIcon size={19} /> Open the live map
        </button>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-16 text-left">
          {feats.map(([Icon, t, d]) => (
            <div key={t} className="rounded-xl border border-hair bg-deck/60 p-5">
              <Icon size={20} className="text-accent" />
              <p className="font-display text-[18px] font-semibold mt-3">{t}</p>
              <p className="text-[14px] text-mute mt-1 leading-snug">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Credits({ D }) {
  return (
    <footer className="border-t border-hair px-6 md:px-14 py-12 text-[13px] text-mute">
      <div className="max-w-[1400px] mx-auto grid md:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-3"><Mark size={26} /><span className="font-display text-ink text-[16px] font-semibold">The Breathing Ground</span></div>
          <p className="mt-3 leading-relaxed">A NASA Space Apps 2026 project for the Dancing with the SARs challenge.</p>
        </div>
        <div>
          <p className="text-ink font-semibold mb-2">Data</p>
          <p className="leading-relaxed">NISAR L2 GUNW, {D.synthetic ? "synthetic stand-in" : D.meta.product_maturity}, track {D.meta.track} {D.meta.direction}, frame {D.meta.frame} (NASA/ISRO, via ASF DAAC). GPS: Nevada Geodetic Laboratory. Historical figures: USGS, SJV Water, Friant Water Authority, California DWR.</p>
        </div>
        <div>
          <p className="text-ink font-semibold mb-2">Images</p>
          <p className="leading-relaxed">NISAR artist's concepts: NASA/JPL-Caltech (public domain). Illustrations and charts: our own. Basemap: OpenStreetMap contributors, CARTO.</p>
        </div>
      </div>
    </footer>
  );
}
