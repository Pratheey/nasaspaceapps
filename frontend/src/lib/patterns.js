// Two map views computed in the browser from series.json. Both describe the measurements; neither
// predicts or explains them, and neither uses a NISAR-only trend (PROPOSAL §5, D11).

// 1. Where two dates can hide sinking: cells that sank beyond 2σ over the record, but where some
//    pair of dates at least 120 days apart shows the ground RISING by 1 cm or more. Both the
//    seasonal rebound and single-date noise (about 1.8 cm per pair, D9) can produce such a pair;
//    either way, that comparison alone would mislead.
export function hiddenSinking(D) {
  if (D._hidden) return D._hidden;
  const out = new Array(D.n).fill(null), pair = new Array(D.n).fill(null);
  const t = D.dates.map((d) => d.getTime() / 864e5);
  for (let i = 0; i < D.n; i++) {
    const net = D.grid.net_change_m[i], v = D.values[i];
    // Reuse the exported significance decision, made before rounding to 0.1 mm.
    if (net == null || !v || ![1, 3].includes(D.grid.label[i])) continue;
    let best = null;
    for (let a = 0; a < v.length; a++) {
      if (v[a] == null) continue;
      for (let b = a + 1; b < v.length; b++) {
        if (v[b] == null || t[b] - t[a] < 120) continue;
        const diff = v[b] - v[a];
        if (diff >= 0.01 && (!best || diff > best.diff)) best = { k1: a, k2: b, diff };
      }
    }
    if (best) { out[i] = net; pair[i] = best; }
  }
  D._hidden = { value: out, pair, count: out.filter((x) => x != null).length, sinking: D.grid.net_change_m.filter((x, i) => x != null && [1, 3].includes(D.grid.label[i])).length };
  return D._hidden;
}

// 2. Motion patterns: k-means groups cells whose 11-month records have a similar shape.
//    Unsupervised and exploratory. Require both endpoints and >= 20 dates. Only internal
//    gaps are interpolated, by elapsed time; no missing tail is invented.
export const PATTERN_COLORS = [[208, 139, 91], [232, 196, 120], [160, 139, 184], [111, 168, 196], [158, 154, 146]];
export function motionPatterns(D, K = 5, seed = 7) {
  const key = `${K}:${seed}`;
  D._patternCache ||= new Map();
  if (D._patternCache.has(key)) return D._patternCache.get(key);
  K = Math.max(1, Math.min(PATTERN_COLORS.length, Math.floor(K) || 1));
  const T = D.dates.length, idx = [], X = [];
  const times = D.dates.map(Number);
  for (let i = 0; i < D.n; i++) {
    const v = D.values[i];
    if (!v) continue;
    const ok = v.map(Number.isFinite);
    if (ok.filter(Boolean).length < 20 || !ok[0] || !ok[T - 1]) continue;
    const f = v.slice();
    for (let k = 0; k < T; k++) if (f[k] == null) {
      let a = k - 1; while (a >= 0 && f[a] == null) a--;
      let b = k + 1; while (b < T && v[b] == null) b++;
      f[k] = f[a] + (v[b] - f[a]) * ((times[k] - times[a]) / (times[b] - times[a]));
    }
    idx.push(i); X.push(f.map((x) => (x - f[0]) * 100)); // cm, relative to the first date
  }
  if (!X.length) {
    const empty = { group: new Array(D.n).fill(null), centers: [], counts: [], K: 0, used: 0, describe: [] };
    D._patternCache.set(key, empty);
    return empty;
  }
  K = Math.min(K, X.length);
  let s = (Math.abs(Math.trunc(seed)) || 7) % 2147483647 || 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const d2 = (p, q) => { let z = 0; for (let k = 0; k < T; k++) z += (p[k] - q[k]) ** 2; return z; };
  const C = [X[Math.floor(rnd() * X.length)].slice()];
  while (C.length < K) { // k-means++
    const w = X.map((x) => Math.min(...C.map((c) => d2(x, c)))), tot = w.reduce((a, b) => a + b, 0);
    if (tot === 0) break; // fewer distinct records than requested groups
    let r = rnd() * tot, j = 0; while (j < X.length - 1 && (r -= w[j]) > 0) j++;
    C.push(X[j].slice());
  }
  K = C.length;
  const lab = new Int32Array(X.length);
  for (let it = 0; it < 40; it++) {
    let moved = 0;
    for (let n = 0; n < X.length; n++) {
      let b = 0, bd = Infinity;
      for (let c = 0; c < K; c++) { const dd = d2(X[n], C[c]); if (dd < bd) { bd = dd; b = c; } }
      if (lab[n] !== b) { lab[n] = b; moved++; }
    }
    for (let c = 0; c < K; c++) {
      const m = new Array(T).fill(0); let cnt = 0;
      for (let n = 0; n < X.length; n++) if (lab[n] === c) { cnt++; for (let k = 0; k < T; k++) m[k] += X[n][k]; }
      if (cnt) C[c] = m.map((x) => x / cnt);
    }
    if (!moved && it) break;
  }
  // order groups from most sinking to most rising at the last date
  const active = new Set(lab);
  const order = [...Array(K).keys()].filter((c) => active.has(c)).sort((a, b) => C[a][T - 1] - C[b][T - 1]);
  const rank = new Array(K); order.forEach((c, r) => (rank[c] = r));
  const group = new Array(D.n).fill(null);
  K = order.length;
  const counts = new Array(K).fill(0);
  idx.forEach((i, n) => { group[i] = rank[lab[n]]; counts[rank[lab[n]]]++; });
  const centers = order.map((c) => C[c]);
  const describe = (m) => {
    const end = m[T - 1], lo = Math.min(...m), hi = Math.max(...m);
    const swing = hi - lo - Math.abs(end);
    const dir = end < -3 ? `sinks about ${Math.abs(end).toFixed(0)} cm` : end > 2 ? `rises about ${end.toFixed(0)} cm` : "ends near where it started";
    return swing > 2 ? `${dir}, with a rise and fall` : dir;
  };
  const result = { group, centers, counts, K, used: idx.length, describe: centers.map(describe) };
  D._patternCache.set(key, result);
  return result;
}
