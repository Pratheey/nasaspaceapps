// The leveling rod: a surveyor's staff planted at the selected point. Each observation date
// leaves a tick where the ground stood; the current date is a painted sign, like the
// pole near Mendota with the years marked where the ground used to be.
import { fmtShort } from "./fmt.js";

const W = 150, H = 300, TOP = 18, BOT = 20;

export function rod({ dates, values, cursor }) {
  const vals = values.map((v) => (v == null ? null : v * 100));
  const ok = vals.filter((v) => v != null);
  if (!ok.length) return `<p class="muted">No measurements here.</p>`;
  // range in cm, at least 4 cm so small motion doesn't look dramatic
  let hi = Math.max(0, ...ok), lo = Math.min(0, ...ok);
  const span = Math.max(4, hi - lo);
  const mid = (hi + lo) / 2;
  hi = mid + span * 0.55; lo = mid - span * 0.55;
  const Y = (v) => TOP + ((hi - v) / (hi - lo)) * (H - TOP - BOT);

  const rx = 62, rw = 20;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="rod" role="img" aria-label="Leveling rod showing ground height at each date">`;

  // rod body: alternating 1 cm blocks
  const unit = span > 30 ? 5 : span > 12 ? 2 : 1;
  for (let v = Math.floor(lo / unit) * unit; v < hi; v += unit) {
    const y1 = Y(v + unit), y2 = Y(v);
    const odd = Math.round(v / unit) % 2 !== 0;
    s += `<rect x="${rx}" y="${Math.max(TOP, y1).toFixed(1)}" width="${rw}" height="${(Math.min(H - BOT, y2) - Math.max(TOP, y1)).toFixed(1)}" class="${odd ? "blk red" : "blk white"}"/>`;
    if (Math.round(v / unit) % (unit === 1 ? 2 : 1) === 0) {
      s += `<text x="${rx + rw + 5}" y="${(y2 + 3).toFixed(1)}" class="rodnum">${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}</text>`;
    }
  }
  s += `<rect x="${rx}" y="${TOP}" width="${rw}" height="${H - TOP - BOT}" class="rodedge"/>`;

  // a tick for every date
  vals.forEach((v, j) => {
    if (v == null) return;
    s += `<line x1="${rx - 7}" x2="${rx}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="rodtick${j === cursor ? " now" : ""}"/>`;
  });

  // starting level
  const y0 = Y(0);
  s += `<line x1="${rx - 56}" x2="${rx + rw}" y1="${y0}" y2="${y0}" class="startline"/>`;
  s += `<text x="${rx - 10}" y="${y0 - 4}" class="rodsign" text-anchor="end">${fmtShort(dates[0])}</text>`;

  // ground today (cursor)
  const k = cursor ?? vals.length - 1;
  const kv = vals[k];
  if (kv != null) {
    const yk = Y(kv);
    s += `<rect x="0" y="${yk.toFixed(1)}" width="${W}" height="${(H - yk).toFixed(1)}" class="soil"/>`;
    s += `<line x1="0" x2="${W}" y1="${yk.toFixed(1)}" y2="${yk.toFixed(1)}" class="groundline"/>`;
    s += `<text x="${rx - 10}" y="${(yk + 14).toFixed(1)}" class="rodsign now" text-anchor="end">${fmtShort(dates[k])}</text>`;
  }
  s += `</svg>`;
  return s;
}
