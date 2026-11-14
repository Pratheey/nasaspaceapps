import { useEffect, useRef, useState } from "react";
import { reduceMotion, useInView } from "./hooks.js";

/* NASA media is public domain unless noted (credit NASA). Each item lists a local copy first
   (public/media/), then NASA's own servers, so the site keeps working offline once saved. */
export const MEDIA = {
  heroVideo: [
    "./media/nisar-spiral.mp4",
    "https://svs.gsfc.nasa.gov/vis/a030000/a031300/a031367/spiral_path_with_nisar-horizontall-28-07-26b-1080p.mp4",
  ],
  orbitVideo: [
    "./media/nisar-orbit.mp4",
    "https://svs.gsfc.nasa.gov/vis/a030000/a031300/a031367/nisar-solor-no-spiral-still-bg.3-3-26a-1080p.mp4",
  ],
  northDakota: ["./media/PIA26615.jpg", "https://images-assets.nasa.gov/image/PIA26615/PIA26615~large.jpg", "https://photojournal.jpl.nasa.gov/jpeg/PIA26615.jpg"],
  maine: ["./media/PIA26614.jpg", "https://images-assets.nasa.gov/image/PIA26614/PIA26614~large.jpg", "https://photojournal.jpl.nasa.gov/jpeg/PIA26614.jpg"],
};

/** Plays the first source that loads; renders `fallback` if none do. */
export function NasaVideo({ srcs, className, poster, fallback }) {
  const [k, setK] = useState(0);
  const [ok, setOk] = useState(false);
  if (k >= srcs.length) return fallback || null;
  return (
    <video key={srcs[k]} src={srcs[k]} poster={poster} className={`${className} transition-opacity duration-[1600ms] ${ok ? "opacity-100" : "opacity-0"}`}
      autoPlay={!reduceMotion} muted loop playsInline preload="auto"
      onCanPlay={() => setOk(true)} onError={() => { setOk(false); setK(k + 1); }} />
  );
}

/** Tries each image source; calls onFail if none load (so a gallery can hide the tile). */
export function MaybeImage({ srcs, alt, className, onFail }) {
  const [k, setK] = useState(0);
  const [ok, setOk] = useState(false);
  useEffect(() => { if (k >= srcs.length) onFail?.(); }, [k, srcs.length, onFail]);
  if (k >= srcs.length) return null;
  return <img src={srcs[k]} alt={alt} onLoad={() => setOk(true)} onError={() => setK(k + 1)}
    className={`${className} transition-opacity duration-1000 ${ok ? "opacity-100" : "opacity-0"}`} />;
}

/** Our own mission patch: orbit ring, radar beam, circular lettering. Turns slowly. */
export function MissionPatch({ size = 150, className = "" }) {
  const id = useRef("p" + Math.random().toString(36).slice(2, 7)).current;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} role="img" aria-label="The Breathing Ground mission patch">
      <defs>
        <path id={id} d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
        <radialGradient id={id + "g"}><stop offset="0" stopColor="#1b2a46" /><stop offset="1" stopColor="#0b111d" /></radialGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill={`url(#${id}g)`} stroke="#6FA8FF" strokeOpacity="0.6" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="62" fill="none" stroke="#6FA8FF" strokeOpacity="0.35" />
      <g className={reduceMotion ? "" : "origin-center animate-[spin_40s_linear_infinite]"} style={{ transformBox: "fill-box" }}>
        <text fontFamily="Michroma, sans-serif" fontSize="9" fill="#A9CBFF">
          <textPath href={`#${id}`} textLength="480" lengthAdjust="spacingAndGlyphs">THE BREATHING GROUND ✶ NISAR L-BAND ✶ SAN JOAQUIN VALLEY ✶ 2026 ✶</textPath>
        </text>
      </g>
      <path d="M40 130 Q 100 118 160 130" stroke="#F0705A" strokeWidth="2.5" fill="none" />
      <path d="M40 138 Q 100 150 160 138" stroke="#5FC9E0" strokeWidth="1.5" fill="none" opacity="0.8" />
      <polygon points="100,62 76,128 124,128" fill="#6FA8FF" opacity="0.18" />
      <ellipse cx="100" cy="66" rx="22" ry="7" fill="#E2B04A" opacity="0.9" transform="rotate(-14 100 66)" />
      <circle cx="122" cy="58" r="4" fill="#A9CBFF" />
    </svg>
  );
}

/** A slow ticker of mission facts, like a telemetry strip. */
export function Telemetry({ items }) {
  const row = items.map(([k, v]) => (
    <span key={k} className="inline-flex items-baseline gap-2 mx-8">
      <span className="text-mute">{k}</span><span className="text-accent-2">{v}</span>
    </span>
  ));
  return (
    <div className="relative border-y border-hair bg-deck/60 overflow-hidden py-3 font-mono text-[13px] whitespace-nowrap" aria-label="Mission facts">
      <div className={`inline-block ${reduceMotion ? "" : "animate-[ticker_60s_linear_infinite]"}`}>{row}{row}</div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-space to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-space to-transparent" />
    </div>
  );
}

/** A radar chirp drawn as a divider: frequency rises across the width, like a SAR pulse. */
export function Chirp({ className = "" }) {
  const [ref, seen] = useInView(0.5);
  const pts = Array.from({ length: 600 }, (_, k) => {
    const x = k / 599;
    const env = Math.sin(Math.PI * x);
    const y = 20 + Math.sin(2 * Math.PI * (2 * x + 26 * x * x)) * 14 * env;
    return `${(x * 1200).toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <div ref={ref} className={`px-6 md:px-14 max-w-[1400px] mx-auto ${className}`} aria-hidden="true">
      <svg viewBox="0 0 1200 40" className="w-full h-10" preserveAspectRatio="none">
        <polyline points={pts} fill="none" stroke="url(#chirpg)" strokeWidth="1.4" vectorEffect="non-scaling-stroke"
          pathLength="1" style={{ strokeDasharray: 1, strokeDashoffset: seen ? 0 : 1, transition: "stroke-dashoffset 2.2s cubic-bezier(.2,.7,.2,1)" }} />
        <defs><linearGradient id="chirpg"><stop offset="0" stopColor="#6FA8FF" stopOpacity="0" /><stop offset=".5" stopColor="#6FA8FF" /><stop offset="1" stopColor="#F0705A" stopOpacity="0" /></linearGradient></defs>
      </svg>
    </div>
  );
}

/** Click anywhere on the story: a radar pulse rings out from the cursor. */
export function RadarPing() {
  const [pings, setPings] = useState([]);
  useEffect(() => {
    if (reduceMotion) return;
    const on = (e) => {
      if (e.target.closest("button, a, input, canvas, svg[role=img]")) return;
      const p = { id: Math.random(), x: e.clientX, y: e.clientY };
      setPings((ps) => [...ps.slice(-4), p]);
      setTimeout(() => setPings((ps) => ps.filter((q) => q.id !== p.id)), 1400);
    };
    window.addEventListener("pointerdown", on);
    return () => window.removeEventListener("pointerdown", on);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-0 z-[70]" aria-hidden="true">
      {pings.map((p) => (
        <span key={p.id} className="absolute" style={{ left: p.x, top: p.y }}>
          {[0, 180, 360].map((d) => (
            <span key={d} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent animate-[ping-ring_1.2s_ease-out_both]" style={{ animationDelay: `${d}ms` }} />
          ))}
        </span>
      ))}
    </div>
  );
}
