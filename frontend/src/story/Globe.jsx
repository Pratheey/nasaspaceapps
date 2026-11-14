import { useEffect, useRef, useState } from "react";
import { geoOrthographic, geoPath, geoGraticule10, geoCircle, geoDistance } from "d3-geo";
import { feature } from "topojson-client";
import land110 from "world-atlas/land-110m.json";
import { reduceMotion } from "./hooks.js";

// NISAR's orbit: sun-synchronous, 98.4° inclination, about 747 km up, ~100 minutes per orbit.
const INC = (98.4 * Math.PI) / 180;
const PERIOD_S = 100 * 60;
const EARTH_DEG_PER_S = 360 / 86164;
const SPEED = 600; // seconds of orbit per real second
const STUDY = [-120.0, 36.45];
const land = feature(land110, land110.objects.land);

function subSatellite(tSec, lon0) {
  const u = (2 * Math.PI * tSec) / PERIOD_S;
  const lat = Math.asin(Math.sin(INC) * Math.sin(u));
  const lon = Math.atan2(Math.cos(INC) * Math.sin(u), Math.cos(u));
  return [((lon * 180) / Math.PI + lon0 - EARTH_DEG_PER_S * tSec + 540) % 360 - 180, (lat * 180) / Math.PI];
}

/** A globe you can drag. The orbit's ground track draws itself as Earth turns under it. */
export default function Globe({ className = "" }) {
  const ref = useRef(null);
  const [info, setInfo] = useState({ lat: 0, lon: 0 });
  useEffect(() => {
    const c = ref.current, x = c.getContext("2d");
    let W, R, raf, rot = [100, -25], dragging = null, t = 0, last = performance.now(), lastInfo = 0;
    const proj = geoOrthographic().clipAngle(90);
    const path = geoPath(proj, x);
    const grat = geoGraticule10();
    const studyCircle = geoCircle().center(STUDY).radius(1.4)();
    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = c.clientWidth; c.width = W * dpr; c.height = W * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
      R = W * 0.42; proj.scale(R).translate([W / 2, W / 2]);
    };
    const draw = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!reduceMotion) t += dt * SPEED;
      if (!dragging && !reduceMotion) rot[0] += dt * 4;
      proj.rotate(rot);
      x.clearRect(0, 0, W, W);
      // atmosphere glow
      const g = x.createRadialGradient(W / 2, W / 2, R * 0.92, W / 2, W / 2, R * 1.18);
      g.addColorStop(0, "rgba(111,168,255,0.35)"); g.addColorStop(1, "rgba(111,168,255,0)");
      x.fillStyle = g; x.beginPath(); x.arc(W / 2, W / 2, R * 1.18, 0, 6.283); x.fill();
      // ocean
      const o = x.createRadialGradient(W * 0.42, W * 0.38, R * 0.1, W / 2, W / 2, R);
      o.addColorStop(0, "#1b2a46"); o.addColorStop(1, "#0c1322");
      x.fillStyle = o; x.beginPath(); path({ type: "Sphere" }); x.fill();
      x.strokeStyle = "rgba(170,190,230,0.10)"; x.lineWidth = 0.6; x.beginPath(); path(grat); x.stroke();
      x.fillStyle = "#2a3a55"; x.beginPath(); path(land); x.fill();
      x.strokeStyle = "rgba(169,203,255,0.35)"; x.lineWidth = 0.6; x.stroke();
      // ground track: last ~1.6 orbits, fading
      const N = 260, span = PERIOD_S * 1.6;
      let prev = null;
      for (let k = 0; k <= N; k++) {
        const tt = t - span + (span * k) / N;
        const p = proj(subSatellite(tt, 20));
        const ll = subSatellite(tt, 20);
        const vis = geoDistance(ll, [-rot[0], -rot[1]]) < Math.PI / 2 - 0.02;
        if (prev && vis && p && Math.hypot(p[0] - prev[0], p[1] - prev[1]) < R * 0.5) {
          x.strokeStyle = `rgba(111,168,255,${(k / N) * 0.9})`;
          x.lineWidth = 0.8 + (k / N) * 7; // the swath widens toward "now"
          x.globalAlpha = 0.25 + (k / N) * 0.35;
          x.beginPath(); x.moveTo(prev[0], prev[1]); x.lineTo(p[0], p[1]); x.stroke();
          x.globalAlpha = 1;
        }
        prev = vis ? p : null;
      }
      // study area
      const pulse = 0.5 + 0.5 * Math.sin(now / 400);
      x.strokeStyle = `rgba(240,112,90,${0.6 + pulse * 0.4})`; x.lineWidth = 2;
      x.fillStyle = "rgba(240,112,90,0.25)"; x.beginPath(); path(studyCircle); x.fill(); x.stroke();
      // satellite
      const sat = subSatellite(t, 20);
      const sp = proj(sat);
      const facing = geoDistance(sat, [-rot[0], -rot[1]]) < Math.PI / 2;
      if (sp && facing) {
        x.fillStyle = "#A9CBFF"; x.shadowColor = "#6FA8FF"; x.shadowBlur = 16;
        x.beginPath(); x.arc(sp[0], sp[1], 5, 0, 6.283); x.fill(); x.shadowBlur = 0;
      }
      if (now - lastInfo > 250) { setInfo({ lat: sat[1], lon: sat[0] }); lastInfo = now; }
      raf = requestAnimationFrame(draw);
    };
    const down = (e) => { dragging = { x: e.clientX, y: e.clientY, r: [...rot] }; c.setPointerCapture(e.pointerId); };
    const move = (e) => {
      if (!dragging) return;
      rot = [dragging.r[0] + (e.clientX - dragging.x) * 0.35, Math.max(-80, Math.min(80, dragging.r[1] - (e.clientY - dragging.y) * 0.35))];
    };
    const up = () => (dragging = null);
    size();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", size);
    c.addEventListener("pointerdown", down); c.addEventListener("pointermove", move); c.addEventListener("pointerup", up);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", size); };
  }, []);
  const f = (v, p, n) => `${Math.abs(v).toFixed(1)}° ${v >= 0 ? p : n}`;
  return (
    <div className={`relative ${className}`}>
      <canvas ref={ref} className="w-full aspect-square cursor-grab active:cursor-grabbing touch-none" aria-label="Globe showing NISAR's orbit and ground track. Drag to turn it." />
      <div className="absolute left-0 bottom-2 text-[12.5px] text-mute leading-relaxed">
        <p><span className="inline-block w-2 h-2 rounded-full bg-accent-2 mr-2 shadow-[0_0_8px_#6FA8FF]" />NISAR now over {f(info.lat, "N", "S")}, {f(info.lon, "E", "W")} <span className="text-ink/40">(simulated)</span></p>
        <p><span className="inline-block w-2 h-2 rounded-full bg-sink mr-2" />Our study area, San Joaquin Valley</p>
        <p className="text-ink/40">Drag to turn the globe.</p>
      </div>
    </div>
  );
}
