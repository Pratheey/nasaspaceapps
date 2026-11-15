import { useEffect, useRef, useState } from "react";
import { reduceMotion } from "./hooks.js";

/* NASA/JPL images are public domain (credit NASA/JPL-Caltech). We try the NASA image
   library first, then the Photojournal, then fall back to our own illustration. To make
   the site work offline, save the file into public/images/ and put that path first. */
export const IMAGES = {
  orbitCalifornia: [
    "./images/PIA26285.jpg",
    "https://images-assets.nasa.gov/image/PIA26285/PIA26285~large.jpg",
    "https://photojournal.jpl.nasa.gov/jpeg/PIA26285.jpg",
  ],
  orbit: [
    "./images/PIA26613.jpg",
    "https://images-assets.nasa.gov/image/PIA26613/PIA26613~large.jpg",
    "https://photojournal.jpl.nasa.gov/jpeg/PIA26613.jpg",
  ],
};

export function NasaImage({ srcs, alt, className, fallback, style }) {
  const [k, setK] = useState(0);
  const [loaded, setLoaded] = useState(false);
  if (k >= srcs.length) return fallback;
  return (
    <img src={srcs[k]} alt={alt} style={style} loading="eager" decoding="async"
      onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setK(k + 1); }}
      className={`${className} transition-opacity duration-[1400ms] ${loaded ? "opacity-100" : "opacity-0"}`} />
  );
}

/** Slowly twinkling stars on a canvas. Cheap: ~260 points, one rAF loop, pauses when hidden. */
export function Starfield({ className = "", density = 260 }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, x = c.getContext("2d");
    let W, H, stars, raf, t = 0;
    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = c.clientWidth; H = c.clientHeight;
      c.width = W * dpr; c.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: density }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.2 + 0.2, p: Math.random() * 6.28, s: 0.4 + Math.random() * 1.4, gold: Math.random() < 0.08 }));
    };
    const draw = () => {
      t += 0.012;
      x.clearRect(0, 0, W, H);
      stars.forEach((s) => {
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
        x.fillStyle = s.gold ? `rgba(169,203,255,${a})` : `rgba(220,230,255,${a * 0.8})`;
        x.beginPath(); x.arc(s.x, s.y, s.r, 0, 6.283); x.fill();
      });
      if (!reduceMotion) raf = requestAnimationFrame(draw);
    };
    size(); draw();
    window.addEventListener("resize", size);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", size); };
  }, [density]);
  return <canvas ref={ref} className={`pointer-events-none ${className}`} aria-hidden="true" />;
}

/** Our own drawing of NISAR: bus, 9 m boom, 12 m gold mesh reflector, solar array. */
export function SatelliteArt({ className = "", moving = false }) {
  const ribs = Array.from({ length: 24 }, (_, i) => (i / 24) * Math.PI * 2);
  return (
    <svg viewBox="0 0 600 420" className={`${className} ${moving ? "sat-moving" : ""}`} role="img" aria-label="Illustration of the NISAR satellite with its gold mesh reflector">
      <defs>
        <radialGradient id="mesh" cx="45%" cy="40%" r="70%">
          <stop offset="0" stopColor="#F5CF7A" stopOpacity="0.95" />
          <stop offset="0.6" stopColor="#E2B04A" stopOpacity="0.55" />
          <stop offset="1" stopColor="#8A6420" stopOpacity="0.35" />
        </radialGradient>
        <linearGradient id="panel" x1="0" x2="1">
          <stop offset="0" stopColor="#1C2A4A" /><stop offset="1" stopColor="#2E4A7A" />
        </linearGradient>
        <linearGradient id="beam" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#6FA8FF" stopOpacity="0.35" /><stop offset="1" stopColor="#6FA8FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon className="sat-beam" points="250,250 120,420 470,420" fill="url(#beam)" />
      <g transform="translate(250 175) rotate(-12)">
        <ellipse rx="150" ry="58" fill="url(#mesh)" stroke="#F5CF7A" strokeOpacity="0.8" />
        {ribs.map((a, i) => <line key={i} x1="0" y1="0" x2={Math.cos(a) * 150} y2={Math.sin(a) * 58} stroke="#FBE3A8" strokeOpacity="0.35" strokeWidth="0.8" />)}
        {[0.35, 0.65].map((s) => <ellipse key={s} rx={150 * s} ry={58 * s} fill="none" stroke="#FBE3A8" strokeOpacity="0.3" />)}
      </g>
      <line x1="300" y1="190" x2="455" y2="120" stroke="#C9D2E4" strokeWidth="3" />
      <line x1="300" y1="190" x2="455" y2="120" stroke="#fff" strokeOpacity="0.3" strokeWidth="1" />
      <g transform="translate(455 98)">
        <rect x="-26" y="-14" width="52" height="46" rx="3" fill="#2A3346" stroke="#8D97AB" />
        <rect x="-26" y="-14" width="52" height="10" fill="#E2B04A" opacity="0.8" />
        <rect x="26" y="0" width="120" height="26" fill="url(#panel)" stroke="#5FC9E0" strokeOpacity="0.5" />
        {[1, 2, 3, 4, 5].map((i) => <line key={i} x1={26 + i * 20} x2={26 + i * 20} y1="0" y2="26" stroke="#5FC9E0" strokeOpacity="0.35" />)}
      </g>
      <text x={592} y={412} textAnchor="end" fontSize="11" fill="#ffffff" fillOpacity="0.6" style={{ fontFamily: "Public Sans, sans-serif" }}>AI-assisted illustration</text>
    </svg>
  );
}
