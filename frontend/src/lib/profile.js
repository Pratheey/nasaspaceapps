// Cross-section: ground motion along a line the user draws. Used for canals, roads, levees.
import { cm } from "./fmt.js";

const R = 6371; // km
export function distKm([lo1, la1], [lo2, la2]) {
  const r = Math.PI / 180;
  const dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Sample the line every half cell. valueAt(lng,lat) -> metres or null.
export function sampleLine(a, b, step, valueAt) {
  const L = distKm(a, b);
  const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (step / 2)));
  const out = [];
  for (let j = 0; j <= n; j++) {
    const f = j / n;
    const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    out.push({ km: L * f, p, v: valueAt(p[0], p[1]) });
  }
  return { L, pts: out };
}

// The California Aqueduct: sample the current view at the canal's own points (every 500 m, flow order).
export function sampleCanal(canal, valueAt) {
  const pts = canal.distance_km.map((km, j) => {
    const p = [canal.lon[j], canal.lat[j]];
    return { km, p, v: valueAt(p[0], p[1]) };
  });
  return { L: canal.distance_km[canal.distance_km.length - 1], pts };
}

const W = 900, H = 150, P = { l: 52, r: 14, t: 14, b: 26 };

export function profileSVG(sample, title) {
  const ok = sample.pts.filter((s) => s.v != null);
  if (!ok.length) return `<p class="muted">No measurements along this line.</p>`;
  const vs = ok.map((s) => s.v * 100);
  let lo = Math.min(0, ...vs), hi = Math.max(0, ...vs);
  const pad = Math.max(0.5, (hi - lo) * 0.12); lo -= pad; hi += pad;
  const X = (km) => P.l + (km / sample.L) * (W - P.l - P.r);
  const Y = (v) => P.t + ((hi - v) / (hi - lo)) * (H - P.t - P.b);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="profsvg" preserveAspectRatio="none" role="img" aria-label="${title}">`;
  const step = hi - lo > 12 ? 4 : hi - lo > 5 ? 2 : 1;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
    s += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" class="${v === 0 ? "zero" : "grid"}"/><text x="${P.l - 6}" y="${Y(v) + 4}" class="ax" text-anchor="end">${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)} cm</text>`;
  }
  const kmStep = sample.L > 60 ? 20 : sample.L > 25 ? 10 : 5;
  for (let k = 0; k <= sample.L; k += kmStep) s += `<text x="${X(k)}" y="${H - 6}" class="ax" text-anchor="middle">${k} km</text>`;
  // filled section, broken where there's no measurement
  let seg = [], segs = [];
  sample.pts.forEach((p) => { if (p.v == null) { if (seg.length) segs.push(seg); seg = []; } else seg.push(p); });
  if (seg.length) segs.push(seg);
  segs.forEach((g) => {
    const top = g.map((p) => `${X(p.km).toFixed(1)},${Y(p.v * 100).toFixed(1)}`);
    s += `<polygon points="${X(g[0].km)},${Y(0)} ${top.join(" ")} ${X(g[g.length - 1].km)},${Y(0)}" class="profarea"/>`;
    s += `<polyline points="${top.join(" ")}" class="profline"/>`;
  });
  s += `<line id="prof-cursor" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" class="profcursor" visibility="hidden"/>`;
  s += `<rect x="${P.l}" y="${P.t}" width="${W - P.l - P.r}" height="${H - P.t - P.b}" fill="transparent" id="prof-hit"/>`;
  s += `</svg>`;
  return s;
}

export function profileHitFrac(evt, svg) {
  const r = svg.getBoundingClientRect();
  const x = ((evt.clientX - r.left) / r.width) * W;
  return Math.max(0, Math.min(1, (x - P.l) / (W - P.l - P.r)));
}
export const profileX = (f) => P.l + f * (W - P.l - P.r);

export function profileReadout(sample, f) {
  const k = Math.round(f * (sample.pts.length - 1));
  const p = sample.pts[k];
  return { p, text: `${p.km.toFixed(1)} km along the line: ${p.v == null ? "no measurement" : cm(p.v)}` };
}
