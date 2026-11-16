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
  const [d, setD] = useState(3); // cm of motion away from the satellite
  const lam = 23.84;
  const phase = ((2 * d) / lam) * 360;
  const W = 640, H = 340, sat = [90, 52], g0 = 250, gy = g0 + d * 2.4;
  const tgt = [470, gy];
  const len = Math.hypot(tgt[0] - sat[0], tgt[1] - sat[1]);
  const ang = Math.atan2(tgt[1] - sat[1], tgt[0] - sat[0]);
  const waves = 7, pts = [];
  for (let k = 0; k <= 200; k++) {
    const s = (k / 200) * len;
    const off = Math.sin((s / len) * waves * 2 * Math.PI + (phase * Math.PI) / 180) * 9;
    pts.push(`${(sat[0] + Math.cos(ang) * s - Math.sin(ang) * off).toFixed(1)},${(sat[1] + Math.sin(ang) * s + Math.cos(ang) * off).toFixed(1)}`);
  }
  return (
    <div className="rounded-2xl border border-hair-2 bg-deck/70 p-6">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`The ground has moved ${d} cm; the radar phase shifts ${Math.round(phase)} degrees`}>
        <defs><linearGradient id="soil2" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#4a3424" /><stop offset="1" stopColor="#151018" /></linearGradient></defs>
        {/* NISAR in miniature: the reflector faces the ground, the radar beam leaves its centre */}
        <g transform={`translate(${sat[0]} ${sat[1]})`}>
          <line x1="0" y1="0" x2="-30" y2="-26" stroke="#C9D2E4" strokeWidth="2" />
          <g transform="translate(-30 -26)">
            <rect x="-12" y="-10" width="24" height="20" rx="2" fill="#2A3346" stroke="#8D97AB" />
            <rect x="-12" y="-10" width="24" height="5" fill="#E2B04A" opacity="0.85" />
            <rect x="-62" y="-6" width="50" height="12" fill="#2E4A7A" stroke="#5FC9E0" strokeOpacity="0.5" />
            {[1, 2, 3, 4].map((i) => <line key={i} x1={-62 + i * 10} x2={-62 + i * 10} y1="-6" y2="6" stroke="#5FC9E0" strokeOpacity="0.4" />)}
          </g>
          <g transform={`rotate(${(ang * 180) / Math.PI - 90})`}>
            <ellipse rx="30" ry="9" fill="#E2B04A" fillOpacity="0.8" stroke="#F5CF7A" />
            <ellipse rx="15" ry="4.5" fill="none" stroke="#FBE3A8" strokeOpacity="0.5" />
          </g>
        </g>
        <line x1="0" x2={W} y1={g0} y2={g0} stroke="rgba(230,234,242,.35)" strokeDasharray="5 5" />
        <text x={W - 6} y={g0 - 8} textAnchor="end" fontSize="13" fill="#8D97AB">ground on the first pass</text>
        <rect x="0" y={gy} width={W} height={H - gy} fill="url(#soil2)" />
        <line x1="0" x2={W} y1={gy} y2={gy} stroke="#F0705A" strokeWidth="2.5" />
        <polyline points={pts.join(" ")} fill="none" stroke="#6FA8FF" strokeWidth="2.2" style={{ filter: "drop-shadow(0 0 6px #6FA8FF)" }} />
        <circle cx={tgt[0]} cy={tgt[1]} r="6" fill="#A9CBFF" />
        {d > 0 && <><line x1={tgt[0] + 40} x2={tgt[0] + 40} y1={g0} y2={gy} stroke="#F0705A" /><text x={tgt[0] + 48} y={(g0 + gy) / 2 + 5} fontSize="14" fill="#F0705A">{d.toFixed(1)} cm</text></>}
        <g transform={`translate(${W - 92} 40)`}>
          <circle r="34" fill="none" stroke="rgba(170,190,230,.25)" strokeWidth="8" />
          <circle r="34" fill="none" stroke={rgb(fringe(-d / 100))} strokeWidth="8" strokeDasharray={`${((phase % 360) / 360) * 213.6} 213.6`} transform="rotate(-90)" />
          <text y="5" textAnchor="middle" fontSize="13" fill="#E6EAF2">{Math.round(phase % 360)}°</text>
        </g>
        <text x={W - 8} y={14} textAnchor="end" fontSize="9" fill="#ffffff" fillOpacity="0.35" style={{ fontFamily: "Public Sans, sans-serif" }}>AI-assisted</text>
      </svg>
      <label className="block mt-4">
        <span className="text-[14px] text-mute">Move the ground away from the satellite</span>
        <input type="range" min="0" max="24" step="0.1" value={d} onChange={(e) => setD(+e.target.value)} className="w-full mt-2 accent-[#9DB08A]" />
      </label>
      <div className="grid grid-cols-3 gap-px bg-hair rounded-lg overflow-hidden mt-4 text-center">
        {[["Ground moved", `${d.toFixed(1)} cm`], ["Extra round trip", `${(2 * d).toFixed(1)} cm`], ["Fringes", (d / (FRINGE_M * 100)).toFixed(2)]].map(([k, v]) => (
          <div key={k} className="bg-space px-3 py-2.5"><p className="text-[12px] text-mute">{k}</p><p className="font-display text-[20px] font-semibold">{v}</p></div>
        ))}
      </div>
      <div className="h-3 rounded mt-4" style={{ background: `linear-gradient(90deg, ${Array.from({ length: 25 }, (_, k) => rgb(fringe(-(k / 24) * (d / 100)))).join(",")})` }} aria-hidden="true" />
      <p className="text-[12.5px] text-mute mt-1.5">The color strip is a line of ground from still (left) to your motion (right), drawn the way an interferogram draws it.</p>
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
      const dt = Math.min((now - last) / 1000, 0.035); last = now;
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

export function AquiferExplainer({ progress = 0 }) {
  const [manual, setManual] = useState(null);
  // A slider adjustment stays put until the visitor resumes scrolling the scene.
  const scrubbing = manual !== null && Math.abs(progress - manual.at) < 0.015;
  const pumping = seg(progress, 0.08, 0.65);
  const recharge = seg(progress, 0.73, 0.97);
  const level = scrubbing ? manual.level : 1 - pumping + recharge * 0.8;
  const drawdown = useSmooth(1 - level, reduceMotion ? 1000 : 12);
  const residual = scrubbing ? 0 : recharge * 9;
  const surface = 112 + Math.pow(drawdown, 1.5) * 34 + residual;
  const water = 186 + drawdown * 158;
  const ripple = useWaterRipple(water);
  const waterEdge = Array.from({ length: 41 }, (_, i) => {
    const u = i / 40;
    const y = water + ripple.amplitude * Math.sin(u * Math.PI) * Math.sin(u * Math.PI * 5 + ripple.phase);
    return `${i ? "L" : "M"}${36 + u * 518} ${y}`;
  }).join(" ");
  // The broad cutaway stays readable; a left face and shallow top supply depth.
  const project = (x, y) => [105 + .82 * x, y - 15 + .12 * x];
  const surfaceAnchor = project(554, surface);
  const waterAnchor = project(554, water);
  const recovery = !scrubbing && progress > 0.73;
  const phase = scrubbing ? "Explore groundwater level" : recovery ? "Recharge · partial recovery" : progress < 0.08 ? "Scroll to see what pumping changes" : "Pumping · groundwater falls";
  return (
    <div className="aquifer-model">
      <div className="aquifer-state"><span>Below the surface</span><span>{phase}</span></div>
      <svg viewBox="0 0 720 490" role="img" aria-label={`Conceptual aquifer: ${drawdown > .5 ? "groundwater is low and the land has settled by a smaller amount" : "groundwater is high and the land is near its original level"}. Scroll or use the groundwater slider to compare.`}>
        <defs>
          <linearGradient id="aq-soil" x2="0" y2="1"><stop stopColor="#44483c"/><stop offset="1" stopColor="#292d26"/></linearGradient>
          <linearGradient id="aq-top" x2="1" y2="1"><stop stopColor="#69765b"/><stop offset="1" stopColor="#424d39"/></linearGradient>
          <linearGradient id="aq-water" x2="0" y2="1"><stop stopColor="#557f80" stopOpacity=".85"/><stop offset="1" stopColor="#345859" stopOpacity=".65"/></linearGradient>
          <pattern id="aq-grains" width="23" height="19" patternUnits="userSpaceOnUse"><circle cx="4" cy="5" r=".8" fill="#ddd9c5" opacity=".14"/><circle cx="17" cy="14" r="1.2" fill="#ddd9c5" opacity=".09"/></pattern>
          <clipPath id="aq-section"><path d={`M36 ${surface}H554V422H36Z`}/></clipPath>
        </defs>
        <g transform="matrix(.82 .12 0 1 105 -15)">
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
        <text x="63" y="49" fill="#aaa79b" fontSize="12">Original land level</text>
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
      <label className="aquifer-pressure"><span>Try it yourself</span><input aria-label="Groundwater level" type="range" min="0" max="1" step="0.01" value={level} onChange={(e) => setManual({ level: +e.target.value, at: progress })}/><span className="aquifer-pressure-ends"><span>Lower groundwater</span><span>Higher groundwater</span></span></label>
      <p className="aquifer-note">Concept illustration · AI-assisted · motion exaggerated, not to scale. {scrubbing ? "Keep scrolling to resume." : "Scroll to continue."}</p>
    </div>
  );
}
