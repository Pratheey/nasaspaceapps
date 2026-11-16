// Small extras: listening to a spot, CSV export, shareable links.
import { fmtDate } from "./fmt.js";
import { stationComparison } from "./gps.js";

/* Listen: each radar pass is a short tone. Higher ground = higher pitch. */
let ctx, playingListen = null;
export function listen(values, { stepMs = 190, onStep, onEnd } = {}) {
  stopListening();
  const ok = values.filter((v) => v != null);
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!ok.length || !AudioContext) return false;
  try { ctx ||= new AudioContext(); } catch { return false; }
  const lo = Math.min(...ok), hi = Math.max(...ok), span = hi - lo || 1;
  const t0 = ctx.currentTime + 0.05;
  const nodes = [];
  values.forEach((v, k) => {
    if (v == null) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = 220 * Math.pow(2, ((v - lo) / span) * 2); // two octaves
    const t = t0 + (k * stepMs) / 1000;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, t + stepMs / 1000);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + stepMs / 1000 + 0.02);
    nodes.push(o);
  });
  let k = 1;
  const timer = setInterval(() => {
    if (k >= values.length) { stopListening(); onEnd?.(); return; }
    onStep?.(k++);
  }, stepMs);
  const playback = { nodes, timer };
  playingListen = playback;
  if (ctx.state === "suspended") ctx.resume().catch(() => {
    if (playingListen === playback) { stopListening(); onEnd?.(); }
  });
  return true;
}
export function stopListening() {
  if (!playingListen) return;
  clearInterval(playingListen.timer);
  playingListen.nodes.forEach((o) => { try { o.stop(); } catch {} });
  playingListen = null;
}
export const isListening = () => !!playingListen;

/* CSV of everything shown for one spot. */
export function downloadCSV(D, i, fitAt, station) {
  const v = D.values[i] || [];
  const gpsByDate = {};
  const comparison = stationComparison(D, station);
  if (comparison) D.dates.forEach((d, k) => (gpsByDate[d.toISOString().slice(0, 10)] = comparison.gps.los[k]));
  const rows = [["date", "nisar_los_m", "fit_m", "gps_los_m"]];
  const f0 = fitAt(D.tYears[0]);
  D.dates.forEach((d, k) => {
    const iso = d.toISOString().slice(0, 10);
    const f = fitAt(D.tYears[k]);
    rows.push([iso, v[k] ?? "", f && f0 ? (f.total - f0.total).toFixed(5) : "", gpsByDate[iso] ?? ""]);
  });
  const head = [
    `# The Breathing Ground, cell ${i}`,
    `# ${D.synthetic ? "SYNTHETIC DATA, not NASA measurements" : `${D.meta.product}, ${D.meta.product_maturity}`}`,
    `# positive = toward the satellite; tied to GPS ${D.meta.reference_station}; relative to the first pass; exported ${fmtDate(new Date())}`,
    ...(comparison?.start ? [`# GPS offset aligned to this cell on ${comparison.start.toISOString().slice(0, 10)}; gaps remain missing`] : []),
  ];
  const blob = new Blob([head.join("\n") + "\n" + rows.map((r) => r.join(",")).join("\n") + "\n"], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `breathing_ground_cell_${i}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* Shareable state in the URL hash. */
const KEYS = ["mode", "a", "b", "t", "cell", "pin", "gps", "relief", "prof", "canal", "lens", "fields", "field", "split"];
export function writeHash(S) {
  const o = {
    mode: S.mode, a: S.k1, b: S.k2, t: S.cursor, cell: S.sel, pin: S.pin,
    gps: S.gps || null, relief: S.relief || null, lens: S.lens || null,
    fields: S.fields || null, field: S.field?.field_id, split: S.split || null,
    canal: S.profile?.canal || null,
  };
  if (S.profile?.b) o.prof = [...S.profile.a, ...S.profile.b].map((n) => n.toFixed(4)).join(",");
  const q = new URLSearchParams(Object.entries(o)
    .filter(([, value]) => value !== -1 && value != null && value !== "")
    .map(([key, value]) => [key, value === true ? "1" : value]));
  history.replaceState(null, "", "#" + q);
}
export function readHash(hash = location.hash) {
  const params = new URLSearchParams(hash.slice(1));
  return Object.fromEntries([...params].filter(([key, value]) => KEYS.includes(key) && value !== ""));
}
