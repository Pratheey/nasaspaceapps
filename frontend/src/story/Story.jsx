import { useEffect, useMemo, useRef, useState } from "react";
import Lenis from "lenis";
import { ArrowDown, AudioLines, Map as MapIcon, Radar, Satellite, Waves, CalendarRange, Activity, Route, Box } from "lucide-react";
import { NasaImage, Starfield, SatelliteArt, IMAGES } from "./art.jsx";
import { PreviewTag } from "../components/Panels.jsx";
import { InsarExplainer, AquiferExplainer, Term } from "./Explainers.jsx";
import { Numbers } from "./Game.jsx";
import { MEDIA, NasaVideo, MaybeImage, Telemetry } from "./Space.jsx";
import FieldsScene from "./Fields.jsx";
import { demoStations, lieStation, AGREEMENT } from "../lib/demo.js";
import { Chapter, MissionTimeline, WatchNasa, SeenWall } from "./Media.jsx";
import { useInView, useProgress, useSmooth, useScrollY, seg, ease, reduceMotion } from "./hooks.js";
import { fitAt, mostMisleadingPair } from "../lib/data.js";
import { cm, fmtShort, fmtDate } from "../lib/fmt.js";
import { fringe, rgb, FRINGE_M } from "../lib/colors.js";
import { linePath } from "../lib/chart.js";

/* ------------------------------------------------------------------ */
export default function Story({ D, onExplore, onDance }) {
  useEffect(() => {
    if (reduceMotion) return;
    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
    let raf;
    const loop = (t) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const syncLayout = (event) => { lenis.resize(); lenis.scrollTo(event.detail, { immediate: true, force: true }); };
    window.addEventListener("story-layout-scroll", syncLayout);
    return () => { window.removeEventListener("story-layout-scroll", syncLayout); cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);
  const demo = useMemo(() => ({ ...demoStations(D), lie: lieStation(D) }), [D]);

  return (
    <div className="bg-space text-ink overflow-x-clip">
      <TopBar D={D} onExplore={onExplore} />
      <Hero D={D} onExplore={onExplore} onDance={onDance} />
      <Telemetry items={[["mission", "NASA–ISRO NISAR"], ["launched", "2025-07-30"], ["orbit", "~747 km, sun-synchronous"], ["inclination", "98.4°"], ["reflector", "12 m gold mesh"], ["L-band", "λ 24 cm"], ["revisit", "12 days"], ["fringe", "11.9 cm"], ["study area", "36.45° N 120.0° W"], ["passes", `${D.dates.length}`], ["reference", `GPS ${D.meta.reference_station}`]]} />
      <PoleScene />
      <AquiferScene />
      {demo.calm && demo.sinking.length > 0 && <BreatheScene D={D} demo={demo} />}
      {demo.lie && <LieScene D={D} st={demo.lie} />}
      <Numbers D={D} />
      <MissionTimeline />
      <OrbitScene />
      <InstrumentScene D={D} />
      <SeenWall />
      <MeasureScene />
      <WatchNasa />
      <GpsScene D={D} />
      <FieldsScene />
      <MattersScene />
      <Finale D={D} onExplore={onExplore} />
      <Team />
      <Credits D={D} />
      {D.synthetic && <PreviewTag D={D} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function TopBar({ D, onExplore }) {
  const y = useScrollY();
  return (
    <header className={`fixed top-0 inset-x-0 z-40 transition-colors duration-500 ${y > 40 ? "bg-space/80 backdrop-blur-md border-b border-hair" : ""}`}>
      <div className="flex items-center gap-4 px-6 md:px-10 h-16">
        <Mark />
        <span className="font-display font-semibold text-[17px] tracking-wide max-sm:hidden">The Breathing Ground</span>
        <nav className="ml-auto hidden md:flex items-center gap-7 text-[14px] text-ink/75">
          {[["Story", "#breathe"], ["The radar", "#radar"], ["Why it matters", "#matters"], ["Team", "#team"]].map(([t, h]) => (
            <a key={t} href={h} onClick={(e) => { e.preventDefault(); document.querySelector(h)?.scrollIntoView({ behavior: "smooth" }); }} className="hover:text-accent-2 transition-colors">{t}</a>
          ))}
        </nav>
        <button onClick={onExplore} className="ml-auto md:ml-4 inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-accent text-space font-semibold text-[14px] px-4 py-2 hover:bg-accent-2 shadow-[0_0_24px_rgba(157,176,138,.35)] transition">
          <MapIcon size={15} /> Open the live map
        </button>
      </div>
    </header>
  );
}

export function Mark({ size = 30 }) {
  return (
    <span className="relative grid place-items-center rounded-full border border-accent/60 shadow-[0_0_16px_rgba(157,176,138,.35)]" style={{ width: size, height: size }} aria-hidden="true">
      <span className="absolute inset-[22%] rounded-full border border-accent/40" />
      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
function Hero({ D, onExplore, onDance }) {
  const y = useScrollY();
  const fade = Math.max(0, 1 - y / 700);
  return (
    <section className="relative min-h-[max(100svh,640px)] overflow-hidden">
      <div className="absolute inset-0" style={{ transform: `translate3d(0, ${y * 0.35}px, 0) scale(${1.08 + y * 0.0002})` }}>
        <NasaImage srcs={IMAGES.orbitCalifornia} alt="Artist's concept of the NISAR satellite in orbit over central and Northern California"
          className="absolute inset-0 w-full h-full object-cover object-[65%_40%]"
          fallback={<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_120%,#1d3a5c_0%,#0F1420_60%)]"><SatelliteArt className="absolute right-[1%] top-[18%] w-[44%] max-w-[640px] opacity-95 max-lg:hidden" moving /></div>} />
      </div>
      <Starfield className="absolute inset-0 w-full h-full opacity-60 mix-blend-screen" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#161514_0%,rgba(22,21,20,.86)_34%,rgba(22,21,20,.25)_70%,rgba(22,21,20,.1)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-space to-transparent" />

      <div className="relative min-h-[max(100svh,640px)] flex flex-col justify-center pt-24 max-sm:pt-36 pb-10 px-6 md:px-14 max-w-[1400px] mx-auto" style={{ opacity: fade }}>
        <div className="intro-in relative z-10 max-w-[720px]">
          <p className="text-[15px] text-mute flex items-center gap-2"><Radar size={16} /> NASA Space Apps 2026, Dancing with the SARs</p>
          <h1 className="font-display font-bold leading-[1] tracking-[-0.015em] text-[clamp(38px,5vw,76px)] mt-5">
            Seasonal ground motion and long-term sinking
            <span className="block text-ink/55">in the San Joaquin Valley</span>
          </h1>
          <p className="text-[clamp(16px,1.5vw,19px)] leading-relaxed text-ink/80 mt-7 max-w-[600px]">
            Every winter California's San Joaquin Valley rises a little. Every summer it settles. Underneath that rhythm,
            parts of it keep going down. We used the first year of NISAR radar to separate the two, and to show how sure we are.
          </p>
          <div className="flex flex-wrap gap-3 mt-9">
            <button onClick={onExplore} className="inline-flex items-center gap-2 rounded-full bg-accent text-space font-semibold px-6 py-3 hover:bg-accent-2 transition">
              <MapIcon size={17} /> Open the live map
            </button>
            <button onClick={() => document.querySelector("#pole")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center gap-2 rounded-full border border-hair-2 bg-space/40 backdrop-blur px-6 py-3 hover:border-accent/60 hover:text-accent-2 transition">
              <ArrowDown size={17} /> Read the story
            </button>
            {onDance && (
              <button onClick={onDance} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FF8232] to-[#E15F2D] text-[#161514] font-semibold px-6 py-3 shadow-[0_0_34px_rgba(255,130,50,.45)] hover:shadow-[0_0_46px_rgba(255,130,50,.7)] hover:brightness-110 transition">
                <AudioLines size={17} /> Watch the dance
              </button>
            )}
          </div>
        </div>
        <dl className="shrink-0 mt-12 grid grid-cols-2 md:grid-cols-4 gap-px bg-hair rounded-xl overflow-hidden max-w-[880px] border border-hair">
          {[["Launched", "30 July 2025"], ["Antenna reflector", "12 metres"], ["Radar wavelength", "24 cm, L-band"], ["Revisit", "Every 12 days"]].map(([k, v]) => (
            <div key={k} className="bg-space/75 backdrop-blur px-4 py-3">
              <dt className="text-[12px] text-mute">{k}</dt>
              <dd className="font-mono text-[17px] font-medium mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[11.5px] text-mute">Background: NISAR animation, NASA Scientific Visualization Studio (our AI-assisted drawing if it can't load).</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
// A pole near Mendota, with signs where the ground stood in 1925, 1955 and 1977.
function PoleScene() {
  const [ref, p] = useProgress();
  const t = reduceMotion ? 1 : ease(seg(p, 0.12, 0.72));
  const metres = (t * 9).toFixed(1);
  const ground = 120 + t * 270;
  const plane = (y) => `70,${y} 350,${y - 65} 540,${y + 15} 260,${y + 80}`;
  return (
    <section id="pole" ref={ref} className="pole-scene relative h-[260vh]">
      <div className="pole-stage sticky top-0">
        <div className="pole-copy">
          <p className="pole-eyebrow">Mendota, California · 1925–1977</p>
          <h2>The land moved.<br /><span>The marks stayed.</span></h2>
          <p className="pole-description">Groundwater pumping lowered the land near Mendota by about nine metres between 1925 and 1977. Marks on a utility pole reveal where the surface used to be.</p>
          <div className="pole-reading"><span className="pole-value">−{metres}</span><span className="pole-unit">m<span>surface change</span></span></div>
          <p className="pole-source">Source: USGS. Animation illustrates the change between historical endpoints.</p>
        </div>
        <div className="pole-visual">
          <svg viewBox="0 0 640 580" role="img" aria-label={`Illustration of land subsidence near Mendota: ${metres} metres below the 1925 reference, ending at approximately 9 metres in 1977.`}>
            <defs>
              <linearGradient id="pole-metal"><stop stopColor="#56584e"/><stop offset=".45" stopColor="#b4b4a4"/><stop offset=".6" stopColor="#858678"/><stop offset="1" stopColor="#46483f"/></linearGradient>
              <linearGradient id="pole-surface" x2="1" y2="1"><stop stopColor="#69765b"/><stop offset="1" stopColor="#424d39"/></linearGradient>
              <linearGradient id="pole-side" x2="0" y2="1"><stop stopColor="#3c4135"/><stop offset="1" stopColor="#252820"/></linearGradient>
            </defs>
            <polygon points={plane(120)} fill="#c3d0b3" fillOpacity=".025" stroke="#aaa99b" strokeOpacity=".55" strokeDasharray="4 6"/>
            <text x="75" y="76" fill="#bdbbb1" fontSize="13">1925 · original surface</text>
            <rect x="298" y="58" width="12" height="440" rx="3" fill="url(#pole-metal)"/>
            <line x1="277" x2="337" y1="84" y2="84" stroke="#c3c2b3" strokeWidth="4"/>
            <polygon points={`70,${ground} 260,${ground+80} 260,${ground+135} 70,${ground+55}`} fill="url(#pole-side)" stroke="#606550"/>
            <polygon points={`260,${ground+80} 540,${ground+15} 540,${ground+70} 260,${ground+135}`} fill="#30362b" stroke="#606550"/>
            <polygon points={plane(ground)} fill="url(#pole-surface)" stroke="#a9b996" strokeWidth="1.5"/>
            <path d={`M70 ${ground}L260 ${ground+80} 540 ${ground+15}`} fill="none" stroke="#b9c9a5" strokeWidth="1.5"/>
            <line x1="44" x2="44" y1="120" y2={ground} stroke="#a9b996"/>
            <path d={`M37 120h14M37 ${ground}h14`} stroke="#a9b996"/>
            <text x="280" y={ground+112} fill="#d3d8c8" fontSize="13">{t > .99 ? "1977 · lowered surface" : "Land surface"}</text>
          </svg>
        </div>
      </div>
    </section>
  );
}

function AquiferScene() {
  return (
    <section className="aquifer-scene">
      <div className="aquifer-stage">
        <div className="aquifer-copy">
          <Chapter n={2} title="The aquifer" />
          <h2>Water falls.<br /><span>The ground follows.</span></h2>
          <p>Pumping lowers the groundwater level and water pressure. The sand and clay above carry more weight and compress, so the land settles.</p>
          <p>Drag the slider to lower the water. The land moves less. When water returns, only part of that sinking reverses.</p>
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
          <Chapter n={6} title="The orbit" />
          <h2 className="font-display font-bold tracking-[-0.015em] leading-[1.02] text-[clamp(36px,4.6vw,68px)] mt-4">Orbit and repeat coverage</h2>
          <p className="text-[18px] leading-relaxed text-ink/80 mt-6">
            NISAR flies about 747 km up on a near-polar orbit, so Earth turns beneath it and each pass covers a new strip. Every 12 days it
            comes back over the same ground from the same angle. That repeat is what lets us compare passes.
          </p>
        </div>
        <OrbitViews />
      </div>
    </section>
  );
}

function OrbitViews() {
  return (
    <figure className="max-w-[720px] w-full mx-auto">
      <div className="relative aspect-video rounded-xl overflow-hidden border border-hair-2 bg-deck">
        <NasaVideo srcs={MEDIA.fleetVideo} className="absolute inset-0 w-full h-full object-cover"
          fallback={<MaybeImage srcs={MEDIA.fleetStill} alt="NISAR's orbit among NASA's Earth satellites" className="absolute inset-0 w-full h-full object-cover" />} />
      </div>
      <figcaption className="text-[13px] text-mute mt-3">NASA visualization of NISAR's orbit (swath in orange) among NASA's other Earth satellites (cyan). NASA Scientific Visualization Studio.</figcaption>
    </figure>
  );
}

function MeasureScene() {
  const [ref, seen] = useInView(0.2);
  return (
    <section ref={ref} className="relative py-[12vh] px-6 md:px-14 max-w-[1400px] mx-auto">
      <div className={`grid lg:grid-cols-[1fr_1.2fr] gap-14 items-center transition-all duration-1000 ${seen ? "opacity-100" : "opacity-0 translate-y-8"}`}>
        <div>
          <Chapter n={9} title="The physics" />
          <h2 className="font-display font-bold tracking-[-0.015em] leading-[1.02] text-[clamp(36px,4.6vw,68px)] mt-4">A longer journey.
            A shifted wave.</h2>
          <p className="text-[18px] leading-relaxed text-ink/80 mt-6">
            NISAR compares radar echoes from repeated passes. If the ground moves away, the signal travels farther to reach it—and farther to return.
            Drag the slider to see the added distance and how it shifts the returning wave. That shift is called phase.
          </p>
          <p className="text-[15px] text-mute mt-5">Each full <Term t="fringe" /> of color is about 11.9 cm of motion along the radar’s viewing direction.</p>
        </div>
        <InsarExplainer />
      </div>
    </section>
  );
}
/* ------------------------------------------------------------------ */
// Scroll drives time. Two stations draw themselves, then split into trend and seasonal.
function BreatheScene({ D, demo }) {
  const [ref, pRaw] = useProgress();
  const p = useSmooth(pRaw);
  const draw = seg(p, 0.08, 0.55);
  const split = seg(p, 0.62, 0.85);
  const W = 760, H = 420, P = { l: 50, r: 20, t: 30, b: 40 };
  const N = D.dates.length;
  const series = [
    { st: demo.calm, color: "#6FA8C4" },
    ...demo.sinking.map((st, n) => ({ st, color: n ? "#E8D3A8" : "#D08B5B" })),
  ].filter((s, n, a) => s.st && a.findIndex((x) => x.st === s.st) === n).map(({ st, color }) => ({ st, color, v: D.values[st.cell_index] || [] }));
  const all = series.flatMap((s) => s.v.filter((x) => x != null).map((x) => x * 100));
  const lo = Math.min(0, ...all) - 1, hi = Math.max(0, ...all) + 1;
  const X = (k) => P.l + ((D.dates[k] - D.dates[0]) / (D.dates[N - 1] - D.dates[0])) * (W - P.l - P.r);
  const Y = (v) => P.t + ((hi - v) / (hi - lo)) * (H - P.t - P.b);
  const head = draw * (N - 1);           // fractional: the line grows smoothly between passes
  const shown = Math.floor(head);
  const grow = (v) => {
    const pts = v.slice(0, shown + 1).map((x, k) => x == null ? null : [X(k), Y(x * 100)]);
    const f = head - shown, a = v[shown], b = v[shown + 1];
    if (f > 0 && a != null && b != null) pts.push([X(shown) + (X(shown + 1) - X(shown)) * f, Y((a + (b - a) * f) * 100)]);
    return pts;
  };
  const captions = [
    `${series.length} GPS stations, one radar. Scroll to play eleven months of NISAR passes.`,
    D.grid.net_change_m[demo.calm.cell_index] == null
      ? `${demo.calm.station} has gaps in its radar record. ${demo.sinking.map((st) => st.station).join(" and ")} show the ground sinking over the full record.`
      : `${demo.calm.station} changes little over the full record. ${demo.sinking.length > 1 ? "The others sink" : "The other station sinks"}.`,
    "The ground rises a little in winter and settles in the dry months. Under that, the sinking keeps going.",
  ];
  const cap = split > 0.1 ? 2 : draw > 0.6 ? 1 : 0;
  return (
    <section id="breathe" ref={ref} className="relative h-[320vh]">
      <div className="sticky top-0 h-[100svh] grid lg:grid-cols-[1fr_1.35fr] items-center gap-10 px-6 md:px-14 max-w-[1400px] mx-auto">
        <div className="max-w-[520px]">
          <Chapter n={3} title="The record" />
          <h2 className="font-display font-bold text-[clamp(38px,4.8vw,72px)] leading-[0.98] mt-3">Eleven months of NISAR measurements</h2>
          <p key={cap} className="text-[18px] leading-relaxed text-ink/85 mt-6 min-h-[5.5em] [animation:rise-in_.6s_both]">{captions[cap]}</p>
          <div className="mt-4 flex gap-5 text-[14px]">
            {series.map((s) => (
              <span key={s.st.station} className="inline-flex items-center gap-2"><span className="w-5 h-[3px] rounded" style={{ background: s.color }} />GPS station {s.st.station}</span>
            ))}
          </div>
          <p className="text-[13px] text-mute mt-2 leading-snug">Dots: one NISAR pass each, at the 1 km map cell around the station. Solid line: the measured record. Dashed, as you scroll on: the fitted trend.</p>
          <p className="mt-6 font-mono text-[40px] font-medium leading-none tracking-tight">{fmtShort(D.dates[Math.min(N - 1, shown)])}</p>
          <p className="font-mono text-[12.5px] text-mute mt-1">pass {String(Math.min(N, shown + 1)).padStart(2, "0")}/{N}{D.synthetic ? ". Synthetic data." : "."}</p>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto chart" role="img" aria-label="Ground motion near GPS stations over the NISAR record">
          {[-8, -6, -4, -2, 0, 2].filter((v) => v > lo && v < hi).map((v) => (
            <g key={v}><line x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} className={v === 0 ? "zero" : "grid"} /><text x={P.l - 8} y={Y(v) + 4} textAnchor="end">{v > 0 ? "+" : v < 0 ? "−" : ""}{Math.abs(v)} cm</text></g>
          ))}
          {series.map((s) => {
            const path = linePath(grow(s.v));
            const f0 = fitAt(D, s.st.cell_index, D.tYears[0]);
            const trend = f0 && D.tYears.map((t, k) => `${k ? "L" : "M"}${X(k)},${Y((fitAt(D, s.st.cell_index, t).trend - f0.trend) * 100)}`).join("");
            return (
              <g key={s.st.station}>
                <path d={path} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" style={{ opacity: 1 - split * 0.55 }} />
                {s.v.slice(0, shown + 1).map((x, k) => x != null && <circle key={k} cx={X(k)} cy={Y(x * 100)} r="3.2" fill="#161514" stroke={s.color} strokeWidth="1.5" style={{ opacity: 1 - split * 0.5 }} />)}
                {trend && <path d={trend} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray="8 6" pathLength="1" style={{ strokeDasharray: `${split} 1`, opacity: split }} />}
              </g>
            );
          })}
          {split > 0.05 && <text x={W - P.r} y={P.t - 8} textAnchor="end" style={{ opacity: split }}>dashed: the trend underneath the seasons</text>}
          <text x={P.l - 44} y={P.t - 12} textAnchor="start">ground motion since {fmtShort(D.dates[0])}, cm (radar line of sight)</text>
          <text x={X(0)} y={H - 12} textAnchor="start">{fmtShort(D.dates[0])}</text>
          <text x={X(N - 1)} y={H - 12} textAnchor="end">{fmtShort(D.dates[N - 1])}</text>
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
  const [a, setA] = useState(lie?.k1 ?? Math.min(2, N - 2));
  const [b, setB] = useState(lie?.k2 ?? Math.min(10, N - 1));
  const svg = useRef(null);
  const drag = useRef(null);
  const [inRef, seen] = useInView(0.3);
  const W = 760, H = 300, P = { l: 50, r: 20, t: 46, b: 34 };
  const ok = v.filter((x) => x != null).map((x) => x * 100);
  const lo = Math.min(0, ...ok) - 1, hi = Math.max(0, ...ok) + 1;
  const X = (k) => P.l + ((D.dates[k] - D.dates[0]) / (D.dates[N - 1] - D.dates[0])) * (W - P.l - P.r);
  const Y = (x) => P.t + ((hi - x) / (hi - lo)) * (H - P.t - P.b);
  const diff = v[a] != null && v[b] != null ? v[b] - v[a] : null;
  const days = Math.round((D.dates[b] - D.dates[a]) / 864e5);
  const B = D.grid.trend_m_per_yr[i];
  const exp = B == null ? null : B * (days / 365.25);
  const pick = (e) => {
    const r = svg.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    return D.dates.reduce((nearest, _, k) => Math.abs(X(k) - x) < Math.abs(X(nearest) - x) ? k : nearest, 0);
  };
  const sigma = D.grid.net_change_sigma_m[i] ?? D.meta.sigma_net_m;
  const misleading = sigma != null && diff != null && exp != null && days >= 90 && diff > -sigma && exp < -2 * sigma;
  return (
    <section ref={inRef} className="relative py-[18vh] px-6 md:px-14 max-w-[1400px] mx-auto">
      <div className={`grid lg:grid-cols-[1fr_1.35fr] gap-12 items-center transition-all duration-1000 ${seen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="max-w-[520px]">
          <Chapter n={4} title="Two dates" />
          <h2 className="font-display font-bold tracking-[-0.015em] leading-[1.02] text-[clamp(36px,4.6vw,68px)] mt-4">Why two dates are not enough</h2>
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
        <div>
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto chart touch-none select-none"
          onPointerDown={(e) => { svg.current.setPointerCapture(e.pointerId); const k = pick(e); drag.current = Math.abs(k - a) <= Math.abs(k - b) ? "a" : "b"; (drag.current === "a" ? setA : setB)(drag.current === "a" ? Math.min(k, b - 1) : Math.max(k, a + 1)); }}
          onPointerMove={(e) => { if (!drag.current) return; const k = pick(e); drag.current === "a" ? setA(Math.min(k, b - 1)) : setB(Math.max(k, a + 1)); }}
          onLostPointerCapture={() => (drag.current = null)} role="img" aria-label="Record at one station with two draggable dates">
          {[-8, -6, -4, -2, 0, 2, 4].filter((t) => t > lo && t < hi).map((t) => (
            <g key={t}><line x1={P.l} x2={W - P.r} y1={Y(t)} y2={Y(t)} className={t === 0 ? "zero" : "grid"} /><text x={P.l - 8} y={Y(t) + 4} textAnchor="end">{t > 0 ? "+" : t < 0 ? "−" : ""}{Math.abs(t)}</text></g>
          ))}
          <text transform={`translate(12 ${(P.t + H - P.b) / 2}) rotate(-90)`} textAnchor="middle">cm since the first pass</text>
          <rect x={X(a)} y={P.t} width={X(b) - X(a)} height={H - P.t - P.b} fill="#9DB08A" opacity="0.07" />
          <path d={linePath(v.map((x, k) => x == null ? null : [X(k), Y(x * 100)]))} fill="none" stroke="#D08B5B" strokeWidth="2" opacity="0.8" />
          {v.map((x, k) => x != null && <circle key={k} cx={X(k)} cy={Y(x * 100)} r={k === a || k === b ? 6 : 3} fill={k === a || k === b ? "#9DB08A" : "#161514"} stroke={k === a || k === b ? "#C3D0B3" : "#D08B5B"} strokeWidth="1.5" />)}
          {[["A", a], ["B", b]].map(([n, k]) => (
            <g key={n} className="cursor-grab">
              <line x1={X(k)} x2={X(k)} y1={P.t - 14} y2={H - P.b} stroke="#9DB08A" strokeWidth="2" />
              <rect x={X(k) - 13} y={P.t - 38} width="26" height="24" rx="5" fill="#9DB08A" />
              <text x={X(k)} y={P.t - 21} textAnchor="middle" style={{ fill: "#161514", font: "700 15px 'Saira Semi Condensed', sans-serif" }}>{n}</text>
              <text x={X(k)} y={H - 12} textAnchor="middle">{fmtShort(D.dates[k])}</text>
            </g>
          ))}
        </svg>
        <p className="text-[13px] text-mute mt-2">Each dot is one NISAR pass at GPS station {st.station} (its 1 km map cell). A and B are the two dates being compared; drag them.</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function InstrumentScene({ D }) {
  const [ref, seen] = useInView(0.2);
  return (
    <section id="radar" ref={ref} className="relative py-[16vh] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(157,176,138,.10),transparent_55%)]" />
      <div className="relative px-6 md:px-14 max-w-[1400px] mx-auto">
        <div className={`grid lg:grid-cols-2 gap-14 items-center transition-all duration-1000 ${seen ? "opacity-100" : "opacity-0 translate-y-8"}`}>
          <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-hair-2 bg-deck">
            <NasaImage srcs={IMAGES.orbit} alt="Artist's concept of NISAR in orbit" className="absolute inset-0 w-full h-full object-cover"
              fallback={<div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_50%_120%,#1d3a5c,#0F1420_65%)]"><SatelliteArt className="w-[85%]" /></div>} />
            <div className="absolute inset-0 bg-gradient-to-t from-space/70 to-transparent" />
            <p className="absolute left-4 bottom-3 text-[11.5px] text-ink/70">NISAR in orbit: NASA/JPL-Caltech artist's concept (our AI-assisted drawing if the NASA image can't load).</p>
          </div>
          <div>
            <Chapter n={7} title="The instrument" />
            <h2 className="font-display font-bold text-[clamp(36px,4.4vw,64px)] leading-[0.98] mt-3">The NISAR instrument</h2>
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

// The data as a radar scientist sees it: our net-change map drawn as wrapped colour bands.
const FRINGE_TOWNS = [["Mendota", 36.754, -120.381], ["Five Points", 36.429, -120.103], ["Lemoore", 36.301, -119.783], ["Hanford", 36.327, -119.646], ["Corcoran", 36.098, -119.56]];
function FringeStrip({ D }) {
  const ref = useRef(null);
  const [wrap, seen] = useInView(0.3);
  const [run, setRun] = useState(0);
  const g = D.meta.grid;
  useEffect(() => {
    if (!seen) return;
    const c = ref.current, x = c.getContext("2d");
    c.width = g.ncols; c.height = g.nrows;
    const img = x.createImageData(g.ncols, g.nrows);
    let raf, t0 = performance.now();
    const frame = (now) => {
      const t = reduceMotion ? 1 : Math.min(1, (now - t0) / 6000);
      for (let i = 0; i < D.n; i++) {
        const v = D.grid.net_change_m[i];
        const col = v == null ? [22, 22, 24] : fringe(v * t);
        img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [seen, D, run]);
  const pos = (lat, lon) => ({ left: `${((lon - g.lon_min) / (g.step_deg * g.ncols)) * 100}%`, top: `${((g.lat_max - lat) / (g.step_deg * g.nrows)) * 100}%` });
  const kmWide = g.step_deg * g.ncols * 111.32 * Math.cos(((g.lat_max - (g.step_deg * g.nrows) / 2) * Math.PI) / 180);
  return (
    <div ref={wrap} className="mt-20 grid lg:grid-cols-[1.3fr_1fr] gap-10 items-start">
      <figure>
        <div className="relative rounded-xl overflow-hidden border border-hair-2">
          <canvas ref={ref} className="w-full h-auto [image-rendering:pixelated] block" aria-label="Map of the study area: ground motion from the first to the last radar pass, drawn as repeating colour bands" />
          {FRINGE_TOWNS.map(([n, la, lo]) => (
            <span key={n} className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none" style={pos(la, lo)}>
              <span className="w-2 h-2 rounded-full bg-white border border-black/60" />
              <span className="text-[12px] font-medium text-white bg-black/60 rounded px-1.5 py-0.5 whitespace-nowrap">{n}</span>
            </span>
          ))}
          <span className="absolute top-3 right-3 text-[12px] font-medium text-white bg-black/60 rounded px-2 py-1">N ↑</span>
          <span className="absolute bottom-3 left-3 rounded bg-black/60 px-2 pt-1 pb-1.5" style={{ width: `calc(${(20 / kmWide) * 100}% + 16px)` }}>
            <span className="block text-[11.5px] text-white">20 km</span>
            <span className="block h-[3px] bg-white mt-0.5" />
          </span>
          <button onClick={() => setRun((r) => r + 1)} className="absolute bottom-3 right-3 text-[12px] text-white bg-black/60 hover:bg-black/80 rounded px-2 py-1">Replay</button>
        </div>
        <div className="mt-3">
          <div className="h-2.5 rounded" style={{ background: `linear-gradient(90deg, ${Array.from({ length: 13 }, (_, k) => rgb(fringe(-(k / 12) * FRINGE_M))).join(",")})` }} aria-hidden="true" />
          <div className="flex justify-between text-[12px] text-mute mt-1"><span>0 cm</span><span>one full cycle = 11.9 cm of motion, then the colours repeat</span><span>11.9 cm</span></div>
        </div>
      </figure>
      <div>
        <h3 className="font-display text-[30px] font-semibold leading-tight">Reading a radar interferogram</h3>
        <p className="text-[17px] leading-relaxed text-ink/80 mt-4">
          This is the same map as the live map's net change, about {Math.round(kmWide)} km across with north at the top. Instead of one colour per
          amount, the motion from {fmtShort(D.dates[0])} to {fmtShort(D.dates[D.dates.length - 1])} is wrapped into repeating colour bands, the way radar
          scientists draw it.
        </p>
        <ul className="text-[16px] leading-relaxed text-ink/80 mt-4 space-y-2 list-disc pl-5">
          <li>Each full trip through the colours is 11.9 cm of motion along the radar's line of sight (half the 23.8 cm wavelength).</li>
          <li>Count the bands to get the total: tightly packed bands mean the ground moved a lot, wide single colours mean it barely moved.</li>
          <li>The animation adds up the motion from zero, so you can watch the bands appear where the ground sinks most.</li>
          <li>Near-black pixels have no reliable measurement.</li>
        </ul>
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
          <Chapter n={11} title="The check" />
          <h2 className="font-display font-bold tracking-[-0.015em] leading-[1.02] text-[clamp(36px,4.6vw,68px)] mt-4">Comparison with GPS</h2>
          <p className="text-[18px] leading-relaxed text-ink/80 mt-6">
            {D.stations.length} GPS stations sit on the map. One, {D.meta.reference_station}, ties the radar to the ground. The other {D.meta.held_out_stations.length} are
            {" "}<Term t="held out" /> and used only to test it. Each pass is also corrected for the <Term t="ionosphere" />. Every number in the map comes with its uncertainty,
            and where the evidence is too thin, the map says so instead of guessing.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            <div><p className="font-mono text-[44px] leading-none">{AGREEMENT.rms_cm} cm</p><p className="text-[14px] text-mute mt-2 max-w-[240px]">NISAR vs GPS per 12-day pair, root mean square, {AGREEMENT.n_stations} held-out stations</p></div>
            <div><p className="font-mono text-[44px] leading-none">{AGREEMENT.selfcheck.replace(" to ", "–")}</p><p className="text-[14px] text-mute mt-2 max-w-[240px]">Separate check at {AGREEMENT.selfcheck_n} stations. Motion smaller than this isn't resolved at a single spot.</p></div>
          </div>
        </div>
        <div className={`grid gap-3 ${D.stations.length > 6 ? "grid-cols-3 max-sm:grid-cols-2" : "grid-cols-2"}`}>
          {D.stations.map((st, n) => (
            <div key={st.station} className={`rounded-xl border border-hair-2 bg-deck/70 ${D.stations.length > 6 ? "p-4" : "p-5"}`} style={{ transitionDelay: `${n * 120}ms` }}>
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
    <section id="matters" ref={ref} className="relative py-[16vh] border-y border-hair bg-[linear-gradient(180deg,#161514,#1A1918)]">
      <div className="px-6 md:px-14 max-w-[1400px] mx-auto">
        <Chapter n={13} title="The stakes" />
        <h2 className="font-display font-bold tracking-[-0.015em] leading-[1.02] text-[clamp(36px,4.6vw,68px)] mt-4 max-w-[1000px]">Effects on canals, levees and wells</h2>
        <div className="grid md:grid-cols-3 gap-px bg-hair rounded-2xl overflow-hidden border border-hair mt-12">
          {items.map(([big, text, src], n) => (
            <div key={big} className={`bg-space p-7 transition-all duration-1000 ${seen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ transitionDelay: `${n * 140}ms` }}>
              <p className="font-display text-[clamp(34px,3.6vw,52px)] font-bold leading-none text-sink">{big}</p>
              <p className="text-[16px] leading-relaxed text-ink/85 mt-5">{text}</p>
              <p className="text-[12px] text-mute mt-4">{src}. Published figures, not ours.</p>
            </div>
          ))}
        </div>
        <div className="mt-16 grid lg:grid-cols-[1fr_1.2fr] gap-10 items-start">
          <div>
            <h3 className="font-display font-bold text-[clamp(26px,2.6vw,38px)] leading-tight">Drinking water: the wells people live on</h3>
            <p className="text-[17px] leading-relaxed text-ink/80 mt-4">
              Most rural homes in the valley drink from their own well, and those wells are shallower than farm wells, so they fail first
              when the water table falls. The same pumping that sinks the ground also lowers the water table, and compacting clay can
              buckle and collapse well casings. Where the map shows persistent sinking near towns like Huron, Riverdale or Corcoran,
              household wells are worth a closer look.
            </p>
            <p className="text-[13px] text-mute mt-4 leading-relaxed">
              Our map does not locate individual wells or measure water quality. It shows where the ground is sinking, which is one warning sign worth checking against well records.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-px bg-hair rounded-2xl overflow-hidden border border-hair">
            {[["2,027", "private drinking-water wells reported dry in the Central Valley during the 2012–2016 drought.", "Environmental Research Letters, UC Davis"],
              ["~1,400", "household wells reported dry across California in 2022, the most since reporting began in 2013. Fresno and Tulare counties were among the worst.", "California DWR dry-well reports, via Los Angeles Times, 2022"],
              ["4,000–12,000", "San Joaquin Valley wells could partly or fully dry out by 2040 under current plans, affecting about 46,000 to 127,000 people.", "Estimate reported by Los Angeles Times, 2022"]].map(([big, text, src]) => (
              <div key={big} className="bg-space p-6">
                <p className="font-display text-[clamp(28px,2.6vw,40px)] font-bold leading-none text-rise">{big}</p>
                <p className="text-[15px] leading-relaxed text-ink/85 mt-4">{text}</p>
                <p className="text-[12px] text-mute mt-3">{src}. Published figures, not ours.</p>
              </div>
            ))}
          </div>
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
    [Activity, "Play the record", "Step through every pass, in 2D or 3D."],
    [CalendarRange, "Compare two dates", "Any pair of dates at any spot, next to the full record."],
    [Route, "Draw a cross-section", "Draw a line and see how the ground along it moved."],
    [Box, "See the evidence", "GPS comparison, uncertainty and the source of every number."],
  ];
  return (
    <section className="relative py-[18vh] overflow-hidden">
      <Starfield className="absolute inset-0 w-full h-full opacity-50" density={180} />
      <div className="relative px-6 md:px-14 max-w-[1100px] mx-auto text-center">
        <h2 className="font-display font-bold tracking-[-0.015em] leading-[1.02] text-[clamp(36px,4.6vw,68px)] mt-4">Explore the map</h2>
        <p className="text-[19px] text-ink/80 mt-6 max-w-[620px] mx-auto">{D.dates.length} radar passes from {fmtDate(D.dates[0])} to {fmtDate(D.dates[D.dates.length - 1])}, over Corcoran and Mendota. Click any spot.</p>
        <button onClick={onExplore} className="mt-10 inline-flex items-center gap-2 rounded-full bg-accent text-space font-semibold text-[17px] px-8 py-4 hover:bg-accent-2 transition">
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

/* ------------------------------------------------------------------ */
const TEAM = [
  ["01", "Ryan Jian", "rjian", "ryan"],
  ["02", "Daniel Li", "danielli", "daniel"],
  ["03", "Tsz “Steven” Liang", "s1evenl_", "steven"],
  ["04", "Ismail Churaev", "ischur", "ismail"],
  ["05", "Pratheek Danam", "pratheey", "pratheek"],
  ["06", "Avinash Lee", "avilee", "avi"],
];

// Trading-card style: tilts toward the cursor, colors up on hover, holographic sheen.
function PlayerCard({ no, name, handle, img, delay, seen }) {
  const ref = useRef(null);
  const [t, setT] = useState({ x: 0, y: 0, on: false });
  const move = (e) => {
    if (reduceMotion) return;
    const r = ref.current.getBoundingClientRect();
    setT({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5, on: true });
  };
  return (
    <li className={`[perspective:900px] transition-all duration-700 ${seen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`} style={{ transitionDelay: `${delay}ms` }}>
      <div ref={ref} onMouseMove={move} onMouseLeave={() => setT({ x: 0, y: 0, on: false })}
        className="group relative aspect-[3/4.2] rounded-2xl overflow-hidden border border-hair-2 bg-deck shadow-[0_20px_60px_rgba(0,0,0,.45)] transition-transform duration-200 ease-out"
        style={{ transform: `rotateY(${t.x * 14}deg) rotateX(${-t.y * 14}deg) ${t.on ? "scale(1.03)" : ""}` }}>
        <img src={`./team/${img}.jpg`} alt={name} loading="lazy"
          className="absolute inset-0 w-full h-full object-cover grayscale contrast-[1.1] brightness-90 group-hover:grayscale-0 group-hover:brightness-100 transition-[filter] duration-500" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(22,21,20,0)_35%,rgba(22,21,20,.92)_88%)]" />
        <div className="absolute inset-0 mix-blend-color bg-accent/40 group-hover:opacity-0 transition-opacity duration-500" />
        <div className="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,.06)_0_1px,transparent_1px_3px)]" />
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mix-blend-overlay"
          style={{ background: `radial-gradient(circle at ${50 + t.x * 100}% ${50 + t.y * 100}%, rgba(255,255,255,.55), transparent 45%), linear-gradient(${115 + t.x * 60}deg, rgba(208,139,91,.35), rgba(157,176,138,.35), rgba(111,168,196,.35))` }} />
        <span className="absolute top-3 left-4 font-mono text-[13px] text-accent-2">{no}</span>
        <div className="absolute left-0 right-0 bottom-0 p-4">
          <p className="font-display text-[21px] font-bold leading-tight">{name}</p>
          <p className="font-mono text-[12px] text-ink/60 mt-0.5">@{handle}</p>
        </div>
      </div>
    </li>
  );
}

function Team() {
  const [ref, seen] = useInView(0.15);
  return (
    <section id="team" ref={ref} className="relative py-[14vh] border-t border-hair overflow-hidden">
      <Starfield className="absolute inset-0 w-full h-full opacity-30" density={120} />
      <div className="relative px-6 md:px-14 max-w-[1400px] mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Chapter n={14} title="The crew" />
            <h2 className="font-display font-bold tracking-[-0.015em] leading-[1.02] text-[clamp(36px,4.6vw,68px)] mt-4">Team</h2>
          </div>
        </div>
        <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mt-10">
          {TEAM.map(([no, name, handle, img], n) => <PlayerCard key={handle} {...{ no, name, handle, img, seen }} delay={n * 90} />)}
        </ul>
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
          <p className="leading-relaxed">NISAR videos and artist's concepts: NASA SVS and NASA/JPL-Caltech (public domain). Charts are drawn from our data. Drawings marked "AI-assisted" were coded with help from an AI assistant, as was part of this site's code; see the repository README. County lines: US Census Bureau. Basemap data: OpenStreetMap contributors.</p>
        </div>
      </div>
    </footer>
  );
}
