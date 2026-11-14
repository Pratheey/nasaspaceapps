// Every pair of dates at one spot, as a triangle of squares. Row = later date, column =
// earlier date. Color = what that pair says (same purple/teal scale as the map, scaled to
// this spot). A dark outline marks pairs that hide the sinking: the ground looks stable or
// rising while the trend over the same span is sinking by more than 2σ.
import { diverging, rgb } from "./colors.js";
import { fmtShort, cm } from "./fmt.js";

const CELL = 13, PAD_L = 40, PAD_B = 30, PAD_T = 4;

export function matrixHTML() {
  return `<div class="matrix">
    <canvas id="pairmatrix" aria-label="Every pair of dates at this spot. Click a square to compare those two dates."></canvas>
    <p id="matrix-read" class="matrix-read">Point at a square to read it. Click to compare those two dates on the map.</p>
  </div>`;
}

export function drawMatrix(D, i, cur, onPick) {
  const c = document.getElementById("pairmatrix");
  if (!c) return;
  const v = D.values[i] || [];
  const N = v.length;
  const B = D.grid.trend_m_per_yr[i];
  const sig = D.grid.net_change_sigma_m[i] ?? D.meta.sigma_net_m ?? 0.01;
  const dpr = window.devicePixelRatio || 1;
  const W = PAD_L + N * CELL + 4, H = PAD_T + N * CELL + PAD_B;
  c.width = W * dpr; c.height = H * dpr;
  c.style.width = W + "px"; c.style.height = H + "px";
  const x = c.getContext("2d");
  x.scale(dpr, dpr);

  let dom = 0.005;
  const cells = [];
  for (let b = 1; b < N; b++) for (let a = 0; a < b; a++) {
    if (v[a] == null || v[b] == null) { cells.push({ a, b, d: null }); continue; }
    const d = v[b] - v[a];
    dom = Math.max(dom, Math.abs(d));
    const days = (D.dates[b] - D.dates[a]) / 864e5;
    const exp = B == null ? null : B * (days / 365.25);
    const lie = exp != null && days >= 90 && d > -sig && exp < -2 * sig;
    cells.push({ a, b, d, exp, lie, days });
  }
  const px = (a) => PAD_L + a * CELL, py = (b) => PAD_T + (b - 1) * CELL;

  x.clearRect(0, 0, W, H);
  cells.forEach((k) => {
    if (k.d == null) {
      x.fillStyle = "rgba(31,38,34,0.08)";
      x.fillRect(px(k.a), py(k.b), CELL - 1, CELL - 1);
      return;
    }
    x.fillStyle = rgb(diverging(k.d, dom));
    x.fillRect(px(k.a), py(k.b), CELL - 1, CELL - 1);
  });
  // misleading pairs
  x.strokeStyle = "#1F2622"; x.lineWidth = 1.5;
  cells.forEach((k) => k.lie && x.strokeRect(px(k.a) + 0.75, py(k.b) + 0.75, CELL - 2.5, CELL - 2.5));
  // current pair
  if (cur && cur[1] > cur[0]) {
    x.strokeStyle = "#C2362B"; x.lineWidth = 2.5;
    x.strokeRect(px(cur[0]) - 1, py(cur[1]) - 1, CELL + 1, CELL + 1);
  }
  // axis labels: first of each month
  x.fillStyle = "#4A544E"; x.font = "11px Barlow, sans-serif";
  let lastM = -1;
  D.dates.forEach((d, k) => {
    const m = d.getUTCMonth();
    if (m === lastM) return;
    lastM = m;
    if (m % 2) return;
    const lab = fmtShort(d).split(" ")[1];
    x.textAlign = "center";
    if (k < N - 1) x.fillText(lab, px(k) + CELL / 2, H - PAD_B + 14);
    x.textAlign = "right";
    if (k > 0) x.fillText(lab, PAD_L - 5, py(k) + CELL - 3);
  });
  x.textAlign = "left";
  x.fillText("earlier date", PAD_L, H - 4);
  x.save(); x.translate(10, PAD_T + 4); x.rotate(Math.PI / 2); x.fillText("later date", 0, 0); x.restore();

  const read = document.getElementById("matrix-read");
  const hit = (e) => {
    const r = c.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const a = Math.floor((mx - PAD_L) / CELL), b = Math.floor((my - PAD_T) / CELL) + 1;
    if (a < 0 || b < 1 || b >= N || a >= b) return null;
    return cells.find((k) => k.a === a && k.b === b);
  };
  c.onmousemove = (e) => {
    const k = hit(e);
    if (!k) return;
    c.style.cursor = "pointer";
    read.innerHTML = k.d == null
      ? `${fmtShort(D.dates[k.a])} to ${fmtShort(D.dates[k.b])}: no measurement on one of the dates.`
      : `${fmtShort(D.dates[k.a])} to ${fmtShort(D.dates[k.b])}: <strong>${cm(k.d)}</strong>${k.exp != null ? `, trend says ${cm(k.exp)}` : ""}.${k.lie ? " This pair hides the sinking." : ""}`;
  };
  c.onmouseleave = () => (c.style.cursor = "");
  c.onclick = (e) => { const k = hit(e); if (k && k.d != null) onPick(k.a, k.b); };
  const n = cells.filter((k) => k.lie).length;
  return n;
}
