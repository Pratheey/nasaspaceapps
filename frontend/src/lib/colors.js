// Still ground stays dark; sinking turns clay to sand, rising turns river blue.
const ZERO = [38, 37, 35];
const SINK = [ZERO, [92, 58, 42], [158, 94, 60], [214, 142, 98], [244, 210, 176]];
const RISE = [ZERO, [36, 62, 78], [52, 108, 140], [111, 168, 196], [200, 228, 240]];

function ramp(stops, t) {
  t = Math.max(0, Math.min(1, t));
  const x = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  return stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
}
export const diverging = (v, domain) => (v < 0 ? ramp(SINK, -v / domain) : ramp(RISE, v / domain));
export const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
export const legendGradient = () =>
  `linear-gradient(to right, ${[...SINK].reverse().map(rgb).concat(RISE.slice(1).map(rgb)).join(",")})`;

export const LABEL_COLORS = {
  1: [208, 139, 91],  // seasonal + sinking
  2: [111, 168, 196], // seasonal, no resolved trend
  3: [160, 139, 184], // sinking, seasonal uncertain
};

// Radar fringes: one full color cycle per half wavelength of NISAR's L-band radar.
export const FRINGE_M = 0.1192; // 23.84 cm / 2
export function fringe(v) {
  const ph = (((v / FRINGE_M) % 1) + 1) % 1;
  return hsl(ph * 360, 0.78, 0.58);
}
export const fringeGradient = () =>
  `linear-gradient(to right, ${Array.from({ length: 13 }, (_, k) => rgb(hsl(k * 30, 0.78, 0.58))).join(",")})`;

function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255));
}
