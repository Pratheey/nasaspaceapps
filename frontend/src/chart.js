// Time-series chart for one location, drawn as SVG. Units on screen: cm.
import { C } from "./colors.js";
import { fmtShort, monthAbbr } from "./fmt.js";

const W = 380, H = 210, P = { l: 40, r: 10, t: 12, b: 26 };

function scale(d0, d1, r0, r1) {
  const k = (r1 - r0) / (d1 - d0 || 1);
  return (v) => r0 + (v - d0) * k;
}

/**
 * opts: { dates, values, fit(t)->{trend,seasonal,total}|null, tYears, split, gps:{dates,los}|null,
 *         pair:[k1,k2]|null, cursor:int|null, seasonalSig:bool }
 */
export function seriesChart(opts) {
  const { dates, values, tYears, fit, split, gps, pair, cursor, seasonalSig, compare } = opts;
  const x0 = +dates[0], x1 = +dates[dates.length - 1];
  const X = scale(x0, x1, P.l, W - P.r);

  // dense time axis for curves
  const N = 120;
  const dense = Array.from({ length: N + 1 }, (_, j) => {
    const t = tYears[0] + (tYears[tYears.length - 1] - tYears[0]) * (j / N);
    const ms = x0 + (x1 - x0) * (j / N);
    return { t, ms, f: fit ? fit(t) : null };
  });
  const f0 = fit ? fit(tYears[0]) : null; // offset so curves start where the data starts

  const ys = values.filter((v) => v != null).map((v) => v * 100);
  if (gps) gps.los.forEach((v) => v != null && ys.push(v * 100));
  if (compare) compare.values.forEach((v) => v != null && ys.push(v * 100));
  dense.forEach((p) => p.f && ys.push((p.f.total - f0.total) * 100));
  let lo = Math.min(0, ...ys), hi = Math.max(0, ...ys);
  const pad = Math.max(0.3, (hi - lo) * 0.12);
  lo -= pad; hi += pad;
  const Y = scale(lo, hi, H - P.b, P.t);

  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Ground motion at this location over time">`;

  // gridlines in whole cm
  const step = hi - lo > 12 ? 4 : hi - lo > 5 ? 2 : hi - lo > 2 ? 1 : 0.5;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
    const y = Y(v).toFixed(1);
    s += `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" class="${Math.abs(v) < 1e-9 ? "zero" : "grid"}"/>`;
    s += `<text x="${P.l - 6}" y="${+y + 3.5}" class="ax" text-anchor="end">${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}</text>`;
  }
  s += `<text x="4" y="${P.t + 4}" class="ax unit">cm</text>`;

  // month ticks
  let lastM = -1;
  dates.forEach((d) => {
    const m = d.getUTCMonth();
    if (m !== lastM && m % 2 === 0) {
      s += `<text x="${X(+d).toFixed(1)}" y="${H - 8}" class="ax" text-anchor="middle">${monthAbbr(d)}</text>`;
    }
    lastM = m;
  });

  // selected two dates
  if (pair) {
    const [a, b] = pair;
    s += `<rect x="${X(+dates[a])}" y="${P.t}" width="${Math.max(1, X(+dates[b]) - X(+dates[a]))}" height="${H - P.b - P.t}" class="pairband"/>`;
  }
  if (cursor != null) {
    const x = X(+dates[cursor]).toFixed(1);
    s += `<line x1="${x}" x2="${x}" y1="${P.t}" y2="${H - P.b}" class="cursor"/>`;
  }

  // fitted curves
  if (fit && f0) {
    const path = (key, sub) =>
      dense.map((p, j) => `${j ? "L" : "M"}${X(p.ms).toFixed(1)},${Y((p.f[key] - sub) * 100).toFixed(1)}`).join("");
    if (split) {
      s += `<path d="${path("trend", f0.trend)}" class="trend"/>`;
      if (seasonalSig) {
        const base = Y(0);
        const sea = dense.map((p, j) => `${j ? "L" : "M"}${X(p.ms).toFixed(1)},${(base + (Y(p.f.seasonal * 100) - Y(0)) * 3).toFixed(1)}`).join("");
        s += `<path d="${sea}" class="seasonal"/>`;
      }
    } else {
      s += `<path d="${path("total", f0.total)}" class="fitline"/>`;
    }
  }

  // GPS
  if (gps) {
    const pts = gps.los.map((v, j) => (v == null ? null : `${X(+gps.dates[j]).toFixed(1)},${Y(v * 100).toFixed(1)}`)).filter(Boolean);
    s += `<polyline points="${pts.join(" ")}" class="gpsline"/>`;
  }

  // pinned comparison point
  if (compare) {
    const pts = compare.values.map((v, j) => (v == null ? null : `${X(+dates[j]).toFixed(1)},${Y(v * 100).toFixed(1)}`)).filter(Boolean);
    s += `<polyline points="${pts.join(" ")}" class="compareline"/>`;
    pts.forEach((p) => { const [cx, cy] = p.split(","); s += `<rect x="${cx - 2.2}" y="${cy - 2.2}" width="4.4" height="4.4" class="comparept"/>`; });
  }

  // measured points
  values.forEach((v, j) => {
    if (v == null) {
      s += `<line x1="${X(+dates[j])}" x2="${X(+dates[j])}" y1="${H - P.b - 4}" y2="${H - P.b}" class="missing"/>`;
      return;
    }
    const sel = pair && (j === pair[0] || j === pair[1]);
    s += `<circle cx="${X(+dates[j]).toFixed(1)}" cy="${Y(v * 100).toFixed(1)}" r="${sel ? 4.2 : 2.6}" class="${sel ? "pt sel" : "pt"}"><title>${fmtShort(dates[j])}: ${(v * 100).toFixed(1)} cm</title></circle>`;
  });

  s += `</svg>`;
  return s;
}

export function chartKey({ split, gps, seasonalSig, compare }) {
  const items = [`<span class="k pt"></span>NISAR measurement`];
  if (split) {
    items.push(`<span class="k trend"></span>Trend`);
    if (seasonalSig) items.push(`<span class="k seasonal"></span>Seasonal part (×3 for visibility)`);
  } else items.push(`<span class="k fit"></span>Fitted curve`);
  if (gps) items.push(`<span class="k gps"></span>GPS`);
  if (compare) items.push(`<span class="k cmp"></span>${compare.label}`);
  return `<p class="chartkey">${items.join("")}</p>`;
}

export { C };
