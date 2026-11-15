import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { fringe, rgb, FRINGE_M } from "../lib/colors.js";
import { reduceMotion } from "./hooks.js";

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
export function AquiferExplainer() {
  const [pressure, setPressure] = useState(0.8); // 0 = drawn down, 1 = full
  const [lost, setLost] = useState(0); // accumulated non-recovering compaction (concept)
  const [playing, setPlaying] = useState(false);
  const tRef = useRef(0);
  useEffect(() => {
    if (!playing) return; // the reader pressed Play, so it runs even with reduced motion
    let raf, last = performance.now();
    const step = (now) => {
      const dt = (now - last) / 1000; last = now;
      tRef.current += dt;
      const p = 0.5 + 0.45 * Math.sin(tRef.current * 1.6);
      setPressure(p);
      setLost((l) => Math.min(1, l + dt * 0.03 * (p < 0.4 ? 2 : 1)));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  const squeeze = (1 - pressure) * 16 + lost * 26; // px of clay compaction
  const W = 640, H = 330, surf = 70 + squeeze;
  const clays = [[150, 26], [215, 22], [272, 18]];
  let shift = 0;
  return (
    <div className="rounded-2xl border border-hair-2 bg-deck/70 p-6">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Concept diagram: an aquifer with clay layers that squeeze as water pressure falls">
        <defs>
          <pattern id="sand" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#3b3226" /><circle cx="2" cy="2" r="1" fill="#5a4c38" /><circle cx="6" cy="6" r="1" fill="#5a4c38" /></pattern>
          <linearGradient id="water" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#5FC9E0" stopOpacity="0.45" /><stop offset="1" stopColor="#2E8BA8" stopOpacity="0.2" /></linearGradient>
        </defs>
        <line x1="0" x2={W} y1="70" y2="70" stroke="rgba(230,234,242,.35)" strokeDasharray="5 5" />
        <text x="8" y="62" fontSize="12.5" fill="#8D97AB">original surface</text>
        <rect x="0" y={surf} width={W} height={H - surf} fill="url(#sand)" />
        <rect x="0" y={surf + 30 + (1 - pressure) * 50} width={W} height={H} fill="url(#water)" />
        {clays.map(([y, h], k) => {
          const hh = h * (1 - (1 - pressure) * 0.35 - lost * 0.45 * (k + 1) / 2);
          const yy = y + squeeze - shift;
          shift += h - hh;
          return <rect key={k} x="0" y={yy} width={W} height={hh} fill="#6b5a7a" opacity="0.9" />;
        })}
        <rect x="0" y={surf - 6} width={W} height="6" fill="#4b6b3a" />
        {[120, 300, 480].map((cx) => <g key={cx}><rect x={cx} y={surf - 26} width="3" height="20" fill="#5a7a46" /><circle cx={cx + 1.5} cy={surf - 30} r="8" fill="#5a7a46" /></g>)}
        <g transform="translate(560 0)">
          <rect x="0" y={surf - 40} width="14" height="40" fill="#8D97AB" />
          <line x1="7" x2="7" y1={surf} y2={H - 10} stroke="#8D97AB" strokeWidth="3" />
          <text x="7" y={surf - 48} textAnchor="middle" fontSize="12" fill="#8D97AB">well</text>
        </g>
        <line x1="40" x2="40" y1="70" y2={surf} stroke="#F0705A" strokeWidth="2" />
        <text x="48" y={(70 + surf) / 2 + 5} fontSize="13" fill="#F0705A">{squeeze > 1 ? "surface dropped" : ""}</text>
        <text x={W - 10} y="24" textAnchor="end" fontSize="14" fill="#E6EAF2">{pressure > 0.6 ? "Wet season: water recharged" : pressure < 0.4 ? "Dry season: pumping" : ""}</text>
        <text x={W - 10} y={H - 10} textAnchor="end" fontSize="12" fill="#8D97AB">Concept diagram, not measured data. Purple: clay layers.</text>
        <text x={W - 8} y={14} textAnchor="end" fontSize="9" fill="#ffffff" fillOpacity="0.35" style={{ fontFamily: "Public Sans, sans-serif" }}>AI-assisted</text>
      </svg>
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button onClick={() => setPlaying(!playing)} className="inline-flex items-center gap-1.5 rounded-full bg-accent text-space font-semibold text-sm px-4 py-2 hover:bg-accent-2">
          {playing ? <Pause size={15} /> : <Play size={15} />} {playing ? "Pause the seasons" : "Play the seasons"}
        </button>
        <button onClick={() => { setLost(0); setPressure(0.8); tRef.current = 0; }} className="inline-flex items-center gap-1.5 rounded-full border border-hair-2 text-sm px-4 py-2 hover:border-accent/60"><RotateCcw size={14} /> Reset</button>
      </div>
      <label className="block mt-4">
        <span className="text-[14px] text-mute">Groundwater pressure: pumping (left) to recharged (right)</span>
        <input type="range" min="0" max="1" step="0.01" value={pressure} onChange={(e) => { setPlaying(false); setPressure(+e.target.value); }} className="w-full mt-2 accent-[#9DB08A]" />
      </label>
      <p className="text-[14px] text-ink/80 mt-3 leading-relaxed">
        When pumps lower the water pressure, the grains and clay carry more of the weight above them and squeeze together. Some of that springs
        back when water returns. In the clay, some doesn't. Play the seasons to see the surface rise and fall while it slowly goes down.
      </p>
    </div>
  );
}
