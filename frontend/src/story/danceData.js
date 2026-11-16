// Data preparation for "The dance": typed arrays, the three-part split and the exaggeration factor.
// Everything here is computed from the loaded data object D; nothing is hard-coded about the real data set.
import { netDomain } from "../lib/view.js";
import { fmtDate } from "../lib/fmt.js";

const cache = new WeakMap();
const SEASONS = ["Winter", "Spring", "Summer", "Autumn"];
const seasonOf = (d) => { const m = d.getUTCMonth(); return m === 11 || m < 2 ? 0 : m < 5 ? 1 : m < 8 ? 2 : 3; };
// "Autumn and winter", "Winter to summer": the seasons a stretch of dates passes through.
function seasonWords(d0, d1) {
  const a = seasonOf(d0), b = seasonOf(d1), list = [SEASONS[a]];
  for (let s = a; s !== b && list.length < 5;) { s = (s + 1) % 4; list.push(SEASONS[s]); }
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1].toLowerCase()}`;
  return `${list[0]} to ${list[list.length - 1].toLowerCase()}`;
}
const twoSig = (x) => { const p = Math.pow(10, Math.floor(Math.log10(x)) - 1); return Math.round(x / p) * p; };

export function prepareDance(D, { heightFrac, headingDeg }) {
  const hit = cache.get(D);
  if (hit) return hit;
  const g = D.meta.grid, N = D.dates.length, n = D.n, ncols = g.ncols, nrows = g.nrows, step = g.step_deg;
  const latMid = g.lat_max - (nrows * step) / 2;
  const kmLat = 111.2, kmLon = 111.32 * Math.cos((latMid * Math.PI) / 180);
  const fieldW = ncols * step * kmLon, fieldH = nrows * step * kmLat;

  const X = new Float32Array(n), Y = new Float32Array(n), U = new Float32Array(n);
  const H = new Float32Array(n * N), Vm = new Uint8Array(n * N);
  const net = new Float32Array(n).fill(NaN), hasNet = new Uint8Array(n), sig = new Uint8Array(n);
  const hd = (headingDeg * Math.PI) / 180, dx = Math.sin(hd), dy = Math.cos(hd);
  const anyIdx = [], dustOnly = [];
  let uMin = Infinity, uMax = -Infinity;
  const all = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / ncols), col = i % ncols;
    X[i] = (col + 0.5 - ncols / 2) * step * kmLon;
    Y[i] = -(row + 0.5 - nrows / 2) * step * kmLat;
    const u = X[i] * dx + Y[i] * dy; U[i] = u;
    if (u < uMin) uMin = u; if (u > uMax) uMax = u;
    const v = D.values[i]; let last = NaN, count = 0;
    for (let k = 0; k < N; k++) {
      const x = v ? v[k] : null;
      if (x != null) { last = x; Vm[i * N + k] = 1; count++; all.push(Math.abs(x)); }
      H[i * N + k] = last;
    }
    if (count) anyIdx.push(i); else dustOnly.push(i);
    const nc = D.grid.net_change_m[i];
    if (nc != null) { net[i] = nc; hasNet[i] = 1; if (D.grid.label[i] === 1 || D.grid.label[i] === 3) sig[i] = 1; }
  }
  for (let i = 0; i < n; i++) U[i] = (U[i] - uMin) / (uMax - uMin || 1);

  // Exaggeration: the 99th-percentile movement spans heightFrac of the field width.
  all.sort((a, b) => a - b);
  const p99 = Math.max(0.02, all[Math.floor(all.length * 0.99)] || 0.02);
  const exag = twoSig((heightFrac * fieldW * 1000) / p99);

  // Cells with a measurement at every pass: their mean position and the share below the start drive the parts and the sound.
  const meanSeries = new Float32Array(N), shareSeries = new Float32Array(N);
  let nFull = 0, nSig = 0, mNet = 0;
  for (let i = 0; i < n; i++) {
    if (hasNet[i]) { mNet++; if (sig[i]) nSig++; }
    let full = true;
    for (let k = 0; k < N; k++) if (!Vm[i * N + k]) { full = false; break; }
    if (!full) continue;
    nFull++;
    for (let k = 0; k < N; k++) { const x = H[i * N + k]; meanSeries[k] += x; if (x < 0) shareSeries[k]++; }
  }
  let hi = 0, lo = 0;
  for (let k = 0; k < N; k++) {
    meanSeries[k] /= nFull || 1; shareSeries[k] /= nFull || 1;
    if (meanSeries[k] > meanSeries[hi]) hi = k;
    if (meanSeries[k] < meanSeries[lo]) lo = k;
  }
  let meanLo = Infinity, meanHi = -Infinity;
  for (let k = 0; k < N; k++) { meanLo = Math.min(meanLo, meanSeries[k]); meanHi = Math.max(meanHi, meanSeries[k]); }

  // Three parts. Only use the seasonal story when the data has that shape; otherwise equal thirds and plain dates.
  const d = D.dates, shaped = nFull >= 20 && hi >= 1 && lo > hi && lo < N - 1 && meanSeries[hi] > meanSeries[0] && meanSeries[hi] > meanSeries[lo];
  let parts, shape;
  if (shaped) {
    const comes = meanSeries[N - 1] > meanSeries[lo];
    parts = [
      { start: 0, text: `${seasonWords(d[0], d[hi])}: the average measured position moves toward the satellite.` },
      { start: hi, text: `${seasonWords(d[hi], d[lo])}: the average measured position moves away from the satellite.` },
      { start: lo, text: comes ? `${seasonWords(d[lo], d[N - 1])}: the average moves back toward the satellite.` : `${seasonWords(d[lo], d[N - 1])}: the average stays below its earlier high.` },
    ];
    shape = "seasonal";
  } else {
    const a = Math.round(N / 3), b = Math.round((2 * N) / 3);
    const span = (x, y) => `${fmtDate(d[x])} to ${fmtDate(d[y])}.`;
    parts = [{ start: 0, text: span(0, a) }, { start: a, text: span(a, b) }, { start: b, text: span(b, N - 1) }];
    shape = "thirds";
  }
  const months = Math.round((d[N - 1] - d[0]) / (30.44 * 864e5));
  const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const monthsText = months >= 0 && months < words.length ? words[months] : String(months);

  const out = {
    N, n, X, Y, U, H, Vm, net, hasNet, sig, anyIdx: Int32Array.from(anyIdx), dustOnly: Int32Array.from(dustOnly),
    fieldW, fieldH, exag, kmPerM: exag / 1000, p99, domain: netDomain(D) * 0.5, // colour saturates at half the map range so the seasonal motion reads
    meanSeries, shareSeries, meanLo, meanHi, nFull, nSig, mNet, hi, lo, parts, shape, monthsText,
  };
  cache.set(D, out);
  return out;
}
