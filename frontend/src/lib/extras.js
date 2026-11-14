// Small extras: listening to a spot, CSV export, shareable links.
import { fmtDate } from "./fmt.js";

/* Listen: each radar pass is a short tone. Higher ground = higher pitch. */
let ctx, playingListen = null;
export function listen(values, { stepMs = 190, onStep, onEnd } = {}) {
  stopListening();
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  const ok = values.filter((v) => v != null);
  if (!ok.length) return;
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
  let k = 0;
  const timer = setInterval(() => {
    if (k >= values.length) { stopListening(); onEnd?.(); return; }
    onStep?.(k++);
  }, stepMs);
  playingListen = { nodes, timer };
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
  if (station?.gps) station.gps.dates.forEach((d, k) => (gpsByDate[d] = station.gps.los_m[k]));
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
    `# positive = toward the satellite; relative to ${D.meta.reference_station}; exported ${fmtDate(new Date())}`,
  ];
  const blob = new Blob([head.join("\n") + "\n" + rows.map((r) => r.join(",")).join("\n") + "\n"], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `breathing_ground_cell_${i}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* Shareable state in the URL hash. */
const KEYS = ["mode", "a", "b", "t", "cell", "pin", "gps", "relief", "prof"];
export function writeHash(S) {
  const o = { mode: S.mode, a: S.k1, b: S.k2, t: S.cursor, cell: S.sel, pin: S.pin, gps: S.gps ? 1 : 0, relief: S.relief ? 1 : 0 };
  if (S.profile?.b) o.prof = [...S.profile.a, ...S.profile.b].map((n) => n.toFixed(4)).join(",");
  const q = Object.entries(o).filter(([, v]) => v !== -1 && v !== 0 && v != null && v !== "").map(([k, v]) => `${k}=${v}`).join("&");
  history.replaceState(null, "", "#" + q);
}
export function readHash() {
  const o = {};
  location.hash.slice(1).split("&").forEach((kv) => {
    const [k, v] = kv.split("=");
    if (KEYS.includes(k)) o[k] = decodeURIComponent(v ?? "");
  });
  return o;
}
