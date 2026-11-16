import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { fringe, rgb, FRINGE_M } from "../lib/colors.js";
import { reduceMotion, useSmooth, seg } from "./hooks.js";

/* ---------------- glossary ---------------- */
export const GLOSSARY = {
  "line of sight": "The slanted direction from the ground up to the satellite. Radar only measures motion along this line, so we compare GPS in the same direction.",
  "L-band": "Radar with a 24 cm wavelength. It passes through clouds and much of the vegetation, and keeps working over fields that change from week to week.",
  "interferogram": "An image made by comparing two radar passes over the same place. Its colors show how far the ground moved between them.",
  "fringe": "One full cycle of color in an interferogram. For NISAR's L-band radar, one fringe is 11.9 cm of motion toward or away from the satellite.",
  "aquifer": "Layers of sand and gravel underground that hold water between the grains, mixed with layers of clay.",
  "ionosphere": "A layer of charged gas high in the atmosphere. It slows radar signals a little and can fake ground motion unless it is corrected.",
  "held out": "Kept back on purpose. A held-out GPS station is never used to tune the radar, so it can test it honestly.",
};
export function Term({ t, children }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button type="button" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        className="underline decoration-dotted decoration-accent/70 underline-offset-[5px] hover:text-accent-2 cursor-help">{children || t}</button>
      {open && (
        <span role="tooltip" className="absolute z-30 left-1/2 -translate-x-1/2 bottom-full mb-2 w-[280px] rounded-lg border border-accent/30 bg-deck px-3.5 py-2.5 text-[13.5px] leading-snug text-ink shadow-[0_12px_40px_rgba(0,0,0,.5)] [animation:rise-in_.2s_both]">
          <span className="font-semibold text-accent-2 capitalize">{t}. </span>{GLOSSARY[t]}
        </span>
      )}
    </span>
  );
}

/* ---------------- how radar measures a centimetre ---------------- */
// Drag the ground down. The round trip gets longer by twice the motion; the wave's phase
// shifts; the fringe color follows. One full color cycle = half a wavelength of motion.
export function InsarExplainer() {
  const [distance, setDistance] = useState(3);
  // Direct manipulation: keep the geometry and readouts in sync with the thumb.
  const d = distance;
  const phase = 4 * Math.PI * d / 23.84;
  const ground = 205 + d * 4;
  const wave = (shift) => Array.from({ length: 241 }, (_, i) => `${i ? "L" : "M"}${24 + i * 2.3},${55 - 17 * Math.sin(i / 240 * Math.PI * 6 - shift)}`).join(" ");
  return (
    <div className="rounded-2xl border border-hair-2 bg-deck/70 p-5 md:p-6">
      <svg viewBox="0 0 600 310" className="w-full h-auto" role="img" aria-label={`First and second radar passes. The ground moves ${d.toFixed(1)} centimetres away along the radar viewing direction, adding ${(2*d).toFixed(1)} centimetres to the return journey.`}>
        <defs><marker id="radar-direction" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#a8b99a"/></marker></defs>
        {[0, 1].map(pass => {
          const x = pass * 300, y = pass ? ground : 205;
          return <g key={pass} transform={`translate(${x} 0)`}>
            <text x="150" y="22" textAnchor="middle" fill="#eae8df" fontSize="16" fontWeight="600">{pass ? "2 · After the ground moves" : "1 · First measurement"}</text>
            <g transform="translate(150 65)"><rect x="-16" y="-12" width="32" height="24" rx="3" fill="#b4b9a7"/><path d="M-61 -8h40v16h-40Zm82 0h40v16H21Z" fill="#54676b" stroke="#8ea5a6"/><path d="M-12 17Q0 31 12 17" fill="none" stroke="#c8b580" strokeWidth="4"/></g>
            <path d={`M127 100V${y-5}`} stroke="#a8b99a" strokeWidth="2" markerEnd="url(#radar-direction)"/>
            <path d={`M173 ${y-5}V100`} stroke="#a8b99a" strokeWidth="2" markerEnd="url(#radar-direction)"/>
            <text x="110" y="151" textAnchor="end" fill="#aaa79b" fontSize="12">Send</text><text x="190" y="151" fill="#aaa79b" fontSize="12">Return</text>
            {pass === 1 && <><path d="M25 205H275" stroke="#aaa79b" strokeDasharray="4 5"/><text x="27" y="197" fill="#aaa79b" fontSize="11">Original ground</text><path d={`M127 205V${y}M173 205V${y}`} stroke="#d5ab7e" strokeWidth="5"/></>}
            <path d={`M25 ${y}H275v25H25Z`} fill="#414b37"/><path d={`M25 ${y}H275`} stroke="#a8b99a" strokeWidth="2"/>
            <text x="150" y="296" textAnchor="middle" fill={pass ? "#dfbd96" : "#aaa79b"} fontSize="13">{pass ? `Extra travel: ${(2*d).toFixed(1)} cm total` : "Reference journey"}</text>
          </g>;
        })}
      </svg>
      <div className="aquifer-pressure mt-4"><label htmlFor="radar-distance" className="flex justify-between gap-3"><span>Move the ground away</span><strong className="text-accent-2">{distance.toFixed(1)} cm</strong></label><input id="radar-distance" type="range" min="0" max="12" step="0.1" value={distance} onChange={e => setDistance(+e.target.value)}/><span className="aquifer-pressure-ends"><span>No movement</span><span>12 cm away</span></span></div>
      <div className="mt-6 pt-4 border-t border-hair">
        <p className="text-[15px] font-semibold">The returning wave shifts</p>
        <div className="flex flex-wrap gap-4 mt-2 text-[12px] text-mute"><span>Dashed: first pass</span><span className="text-accent-2">Solid: second pass</span></div>
        <svg viewBox="0 0 600 95" className="w-full" role="img" aria-label="Comparison of returning radar waves: moving the slider shifts the second wave relative to the first.">
          <path d="M24 55H576" stroke="#47483f"/>
          <path d={wave(0)} fill="none" stroke="#aaa79b" strokeWidth="2" strokeDasharray="5 5"/>
          <path d={wave(phase)} fill="none" stroke="#bdcda8" strokeWidth="3"/>
        </svg>
        <p className="text-[13px] leading-relaxed text-ink/75">{distance < .05 ? "No movement: the two waves line up." : `${distance.toFixed(1)} cm farther away adds ${(2*distance).toFixed(1)} cm to the journey—out and back. That changes where the returning wave is in its cycle.`}</p>
      </div>
      <p className="text-[11px] text-mute mt-4">Concept illustration · AI-assisted · distances exaggerated. Movement is along the radar’s viewing direction.</p>
    </div>
  );
}

/* ---------------- the aquifer breathes ---------------- */
// Concept diagram, not our data. Pumping lowers water pressure; the clay squeezes and the
// surface drops. Recharge lets part of it spring back; part stays down.
// A small damped response to level changes; it sleeps once the water settles.
function useWaterRipple(level) {
  const motion = useRef({ previous: level, amplitude: 0, velocity: 0, phase: 0 });
  const [ripple, setRipple] = useState({ amplitude: 0, phase: 0 });
  useEffect(() => {
    const m = motion.current;
    const delta = level - m.previous;
    m.previous = level;
    if (reduceMotion) return;
    m.velocity = Math.max(-16, Math.min(16, m.velocity + delta * 0.7));
    let raf, last = performance.now();
    const frame = (now) => {
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.035)); last = now;
      m.velocity += (-65 * m.amplitude - 7 * m.velocity) * dt;
      m.amplitude = Math.max(-2, Math.min(2, m.amplitude + m.velocity * dt));
      m.phase += dt * 3;
      if (Math.abs(m.amplitude) < .005 && Math.abs(m.velocity) < .02) {
        m.amplitude = 0; m.velocity = 0;
        setRipple({ amplitude: 0, phase: m.phase });
        return;
      }
      setRipple({ amplitude: m.amplitude, phase: m.phase });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [level]);
  return ripple;
}

export function AquiferExplainer() {
  const [level, setLevel] = useState(1);
  const [maxDrawdown, setMaxDrawdown] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playbackPhase = useRef(0);
  const diagramRef = useRef(null);
  const started = useRef(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      const inView = entry.isIntersecting && entry.intersectionRatio > 0;
      setVisible(inView);
      if (inView && !started.current) {
        started.current = true;
        // Initial level and phase are already at high groundwater.
        setPlaying(true);
      }
    }, { threshold: [0, .01] });
    observer.observe(diagramRef.current);
    const onVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  useEffect(() => {
    if (!playing || !visible || !pageVisible) return;
    let raf, last;
    const tick = (now) => {
      const dt = last === undefined ? 0 : Math.max(0, Math.min(.05, (now - last) / 1000));
      last = now;
      playbackPhase.current = (playbackPhase.current + dt * Math.PI / 5) % (2 * Math.PI);
      const next = (1 + Math.cos(playbackPhase.current)) / 2;
      setLevel(next);
      setMaxDrawdown(previous => Math.max(previous, 1 - next));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, visible, pageVisible]);
  const drawdown = Math.max(0, Math.min(1, useSmooth(1 - level, reduceMotion ? 1000 : 12)));
  const residual = maxDrawdown * 9;
  const surface = 112 + Math.pow(drawdown, 1.5) * 25 + residual;
  const water = 186 + drawdown * 158;
  const ripple = useWaterRipple(water);
  const waterEdge = Array.from({ length: 41 }, (_, i) => {
    const u = i / 40;
    const y = water + ripple.amplitude * Math.sin(u * Math.PI) * Math.sin(u * Math.PI * 5 + ripple.phase);
    return `${i ? "L" : "M"}${36 + u * 518} ${y}`;
  }).join(" ");
  // The broad cutaway stays readable; a left face and shallow top supply depth.
  const project = (x, y) => [80 + .9 * x, y + 20];
  const surfaceAnchor = project(554, surface);
  const waterAnchor = project(554, water);
  const recovery = maxDrawdown > 0 && 1 - level < maxDrawdown - .02;
  const phase = recovery ? "Recharge · partial recovery" : level < .98 ? "Pumping · groundwater falls" : "Drag the slider to explore";
  return (
    <div className="aquifer-model">
      <div className="aquifer-state"><span>Below the surface</span><span>{phase}</span></div>
      <svg ref={diagramRef} viewBox="0 0 720 490" role="img" aria-label={`Conceptual aquifer: ${drawdown > .5 ? "groundwater is low and the land has settled by a smaller amount" : "groundwater is high and the land is near its original level"}. Use the groundwater slider to compare.`}>
        <defs>
          <linearGradient id="aq-soil" x2="0" y2="1"><stop stopColor="#44483c"/><stop offset="1" stopColor="#292d26"/></linearGradient>
          <linearGradient id="aq-top" x2="1" y2="1"><stop stopColor="#69765b"/><stop offset="1" stopColor="#424d39"/></linearGradient>
          <linearGradient id="aq-water" x2="0" y2="1"><stop stopColor="#557f80" stopOpacity=".85"/><stop offset="1" stopColor="#345859" stopOpacity=".65"/></linearGradient>
          <pattern id="aq-grains" width="23" height="19" patternUnits="userSpaceOnUse"><circle cx="4" cy="5" r=".8" fill="#ddd9c5" opacity=".14"/><circle cx="17" cy="14" r="1.2" fill="#ddd9c5" opacity=".09"/></pattern>
          <clipPath id="aq-section"><path d={`M36 ${surface}H554V422H36Z`}/></clipPath>
        </defs>
        <g transform="matrix(.9 0 0 1 80 20)">
        <path d={`M36 ${surface}l-90 -40V382l90 40Z`} fill="#33382d" stroke="#656c56" strokeWidth=".8"/>
        <path d={`M36 ${water}l-90 -40V382l90 40Z`} fill="#456767" opacity=".7"/>
        {[0,1,2].map(i => {
          const y = 231 + i*67 + (surface-112)*(3-i)/4;
          const h = 17 - drawdown*7 - residual*.2;
          return <path key={i} d={`M36 ${y}l-90 -40v${h}l90 40Z`} fill="#938c77" opacity=".45"/>;
        })}
        <path d={`M36 ${water}l-90 -40`} stroke="#86aaa5" strokeWidth="1.4"/>
        <g clipPath="url(#aq-section)">
          <rect x="36" y={surface} width="518" height={422-surface} fill="url(#aq-soil)"/>
          <path d={`${waterEdge}L554 422H36Z`} fill="url(#aq-water)"/>
          <rect x="36" y={surface} width="518" height={422-surface} fill="url(#aq-grains)"/>
          {[0,1,2].map(i => {
            const y = 231 + i*67 + (surface-112)*(3-i)/4;
            const thickness = 17 - drawdown*7 - residual*.2;
            return <path key={i} d={`M36 ${y}C180 ${y-7} 365 ${y+8} 554 ${y-2}v${thickness}C365 ${y+8+thickness} 180 ${y-7+thickness} 36 ${y+thickness}Z`} fill="#aaa18b" opacity=".5"/>;
          })}
          <path d={waterEdge} fill="none" stroke="#9dc9c6" strokeWidth="1.8"/>
        </g>
        <path d={`M36 ${surface}l-90 -40H464l90 40Z`} fill="url(#aq-top)" stroke="#9eaf87" strokeWidth="1"/>
        <path d="M36 112l-90 -40H464l90 40H36" stroke="#a9a69a" strokeDasharray="4 6" opacity=".55" fill="none"/>
        <path d={`M36 ${surface}H554`} stroke="#afbd9b" strokeWidth="2"/>
        <g transform={`translate(150 ${surface-10})`}>
          <path d="M-10 2l-50 -23h66l50 23Z" fill="#161a13" opacity=".2"/>
          <path d="M0 0l-38 -17v-28l38 17Z" fill="#8c8c7b"/>
          <path d="M0 0v-28l27 -21 27 21V0Z" fill="#c3bdab"/>
          <path d="M-5 -27l-38 -17 32 -24 38 19Z" fill="#777c68" stroke="#afb49b" strokeWidth="1"/>
          <path d="M27 -49l-38 -19 32 24 38 17Z" fill="#9aa18a"/>
          <path d="M-5 -27l32 -22 32 22" fill="none" stroke="#e0dac8" strokeWidth="2"/>
          <rect x="22" y="-21" width="11" height="21" fill="#5c6051"/>
          <path d="M-28 -31l10 4v10l-10 -4Z" fill="#b0b7a7"/>
          <rect x="38" y="-19" width="9" height="9" fill="#8f9a87"/>
        </g>
        <g transform={`translate(463 ${surface})`}>
          <path d="M0 0v-35h22v-12" stroke="#c3bfad" strokeWidth="5" fill="none" strokeLinejoin="round"/>

        </g>
        <path d={`M463 ${surface+4}V395`} stroke="#c3bfad" strokeWidth="4"/>
        <path d={`M463 ${water+4}V395`} stroke="#8cb4b1" strokeWidth="2"/>
        </g>
        <text x="35" y="79" fill="#aaa79b" fontSize="12">Original land level</text>
        <text x={project(463,surface)[0]} y={project(463,surface)[1]-62} fill="#aaa79b" textAnchor="middle" fontSize="12">Pumping well</text>
        <path d={`M${surfaceAnchor[0]} ${surfaceAnchor[1]}h20`} stroke="#b8c6a4"/>
        <text x={surfaceAnchor[0]+30} y={surfaceAnchor[1]+5} fontSize="15" fill="#d3ddc2">Land surface</text>
        <path d={`M${waterAnchor[0]} ${waterAnchor[1]}h20`} stroke="#9dc9c6"/>
        <text x={waterAnchor[0]+30} y={waterAnchor[1]-4} fontSize="15" fill="#abd0cd">Groundwater</text>
        <text x={waterAnchor[0]+30} y={waterAnchor[1]+15} fontSize="15" fill="#abd0cd">level</text>
        {drawdown > .05 && <>
          <path d={`M${surfaceAnchor[0]+10} ${project(554,112)[1]}V${surfaceAnchor[1]}m-4 -5l4 5 4 -5`} fill="none" stroke="#b8c6a4" strokeWidth="1.5"/>
          <path d={`M${waterAnchor[0]+10} ${project(554,186)[1]}V${waterAnchor[1]}m-4 -5l4 5 4 -5`} fill="none" stroke="#9dc9c6" strokeWidth="1.5"/>
        </>}
      </svg>
      <p className="aquifer-caption">{recovery ? "Water returns. The land rises a little, but some compaction remains." : "Groundwater drops farther. The land above settles by a smaller amount."}</p>
      <div className="aquifer-pressure"><div className="aquifer-control-heading"><button type="button" className="aquifer-play" onClick={() => setPlaying(value => !value)} aria-label={playing ? "Pause groundwater animation" : "Play groundwater animation"}>{playing ? <Pause size={13} /> : <Play size={13} />}<span>{playing ? "Pause" : "Play animation"}</span></button><label htmlFor="aquifer-level">or drag the slider</label></div><input id="aquifer-level" aria-label="Groundwater level" type="range" min="0" max="1" step="0.01" value={level} onChange={(e) => { const next = +e.target.value; setPlaying(false); playbackPhase.current = Math.acos(2 * next - 1); setLevel(next); setMaxDrawdown(previous => Math.max(previous, 1 - next)); }}/><span className="aquifer-pressure-ends"><span>Lower groundwater</span><span>Higher groundwater</span></span></div>
      <p className="aquifer-note">Concept illustration · AI-assisted · motion exaggerated, not to scale. Drag the slider to compare water levels.</p>
    </div>
  );
}
