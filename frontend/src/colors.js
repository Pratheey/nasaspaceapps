// Palette borrowed from USGS topographic quads: on those maps purple marks change seen
// from the air, so purple = sinking here. Teal = rising. Paper = no measurable change.
export const C = {
  paper: [233, 236, 228],
  ink: "#1F2622",
  sink: [110, 58, 142],   // revision purple
  rise: [45, 122, 134],   // survey teal
  brown: "#8B5E34",       // contour brown
  rod: "#C2362B",
};

const SINK_STOPS = [[233, 236, 228], [196, 174, 206], [152, 108, 176], [110, 58, 142], [62, 26, 84]];
const RISE_STOPS = [[233, 236, 228], [170, 207, 210], [92, 160, 170], [45, 122, 134], [18, 74, 84]];

function ramp(stops, t) {
  t = Math.max(0, Math.min(1, t));
  const x = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  return stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
}

// value in metres, domain = metres at full color. Returns [r,g,b].
export function diverging(v, domain) {
  if (v < 0) return ramp(SINK_STOPS, -v / domain);
  return ramp(RISE_STOPS, v / domain);
}

export const LABEL_COLORS = {
  1: [110, 58, 142],  // seasonal + sinking
  2: [45, 122, 134],  // seasonal, no resolved trend
  3: [139, 94, 52],   // sinking, seasonal uncertain
};

export const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

// CSS gradient for a legend bar matching `diverging`.
export function legendGradient() {
  const stops = [...SINK_STOPS].reverse().map(rgb).concat(RISE_STOPS.slice(1).map(rgb));
  return `linear-gradient(to right, ${stops.join(",")})`;
}
