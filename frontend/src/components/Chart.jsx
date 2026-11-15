import { fmtShort, monthAbbr } from "../lib/fmt.js";
import { linePath } from "../lib/chart.js";

const W = 400, H = 220, P = { l: 40, r: 10, t: 12, b: 26 };
const lin = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) * (r1 - r0)) / (d1 - d0 || 1);

/** Every measurement at one spot, with the fit (or its trend/seasonal split), GPS and a compared spot. */
export default function Chart({ dates, values, tYears, fit, split, gps, compare, pair, cursor, seasonalSig, onPickDate }) {
  const x0 = +dates[0], x1 = +dates[dates.length - 1];
  const X = lin(x0, x1, P.l, W - P.r);
  const N = 120;
  const f0 = fit(tYears[0]);
  const dense = Array.from({ length: N + 1 }, (_, j) => {
    const t = tYears[0] + (tYears[tYears.length - 1] - tYears[0]) * (j / N);
    return { ms: x0 + (x1 - x0) * (j / N), f: fit(t) };
  });

  const ys = values.filter((v) => v != null).map((v) => v * 100);
  gps?.los.forEach((v) => v != null && ys.push(v * 100));
  compare?.values.forEach((v) => v != null && ys.push(v * 100));
  const fitValue = (p) => p.f && f0 ? (split ? p.f.trend - f0.trend : p.f.total - f0.total) * 100 : null;
  const seasonalValue = (p) => split && seasonalSig && p.f ? p.f.seasonal * 300 : null;
  for (const p of dense) {
    const v = fitValue(p), seasonal = seasonalValue(p);
    if (v != null) ys.push(v);
    if (seasonal != null) ys.push(seasonal);
  }
  let lo = Math.min(0, ...ys), hi = Math.max(0, ...ys);
  const pad = Math.max(0.3, (hi - lo) * 0.12);
  lo -= pad; hi += pad;
  const Y = lin(lo, hi, H - P.b, P.t);
  const step = hi - lo > 12 ? 4 : hi - lo > 5 ? 2 : hi - lo > 2 ? 1 : 0.5;
  const gridVals = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) gridVals.push(+v.toFixed(2));

  const months = [];
  let lastM = -1;
  dates.forEach((d) => { const m = d.getUTCMonth(); if (m !== lastM && m % 2 === 0) months.push(d); lastM = m; });

  const fittedPath = (getValue) => linePath(dense.map((p) => {
    const v = getValue(p);
    return v == null ? null : [X(p.ms), Y(v)];
  }));
  const measurements = (arr, ds) => linePath(arr.map((v, j) => v == null ? null : [X(+ds[j]), Y(v * 100)]));

  const onClick = (e) => {
    if (!onPickDate) return;
    const r = e.currentTarget.getBoundingClientRect();
    const ms = x0 + (((e.clientX - r.left) / r.width) * W - P.l) / (W - P.l - P.r) * (x1 - x0);
    let best = 0, bd = Infinity;
    dates.forEach((d, k) => { const dd = Math.abs(+d - ms); if (dd < bd) { bd = dd; best = k; } });
    onPickDate(best);
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart block w-full h-auto cursor-crosshair" role="img" aria-label="Ground motion at this spot over time" onClick={onClick}>
      {gridVals.map((v) => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} className={v === 0 ? "zero" : "grid"} />
          <text x={P.l - 6} y={Y(v) + 3.5} textAnchor="end">{v > 0 ? "+" : v < 0 ? "−" : ""}{Math.abs(v)}</text>
        </g>
      ))}
      <text x={4} y={P.t + 4}>cm</text>
      {months.map((d) => <text key={+d} x={X(+d)} y={H - 8} textAnchor="middle">{monthAbbr(d)}</text>)}
      {pair && <rect x={X(+dates[pair[0]])} y={P.t} width={Math.max(1, X(+dates[pair[1]]) - X(+dates[pair[0]]))} height={H - P.b - P.t} className="band" />}
      {cursor != null && <line x1={X(+dates[cursor])} x2={X(+dates[cursor])} y1={P.t} y2={H - P.b} className="cursor" />}
      {f0 && (split
        ? <>
            <path d={fittedPath(fitValue)} className="trend" />
            {seasonalSig && <path d={fittedPath(seasonalValue)} className="seasonal" />}
          </>
        : <path d={fittedPath(fitValue)} className="fit glow" />)}
      {gps && <path d={measurements(gps.los, gps.dates)} className="gps" />}
      {compare && (
        <>
          <path d={measurements(compare.values, dates)} className="cmp" />
          {compare.values.map((v, j) => v != null && <rect key={j} x={X(+dates[j]) - 2.2} y={Y(v * 100) - 2.2} width="4.4" height="4.4" className="cmppt" />)}
        </>
      )}
      {values.map((v, j) =>
        v == null
          ? <line key={j} x1={X(+dates[j])} x2={X(+dates[j])} y1={H - P.b - 4} y2={H - P.b} className="miss" />
          : (() => {
              const sel = pair && (j === pair[0] || j === pair[1]);
              return (
                <circle key={j} cx={X(+dates[j])} cy={Y(v * 100)} r={sel ? 4.4 : 2.7} className={sel ? "pt sel" : "pt"}>
                  <title>{fmtShort(dates[j])}: {(v * 100).toFixed(1)} cm</title>
                </circle>
              );
            })()
      )}
    </svg>
  );
}

export function ChartKey({ split, gps, seasonalSig, compare }) {
  const Item = ({ cls, children }) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={cls} />
      {children}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-mute mt-1.5">
      <Item cls="w-2.5 h-2.5 rounded-full border border-ink">NISAR measurement</Item>
      {split ? (
        <>
          <Item cls="w-4 border-t-2 border-dashed border-sink">Trend</Item>
          {seasonalSig && <Item cls="w-4 border-t-2 border-rise">Seasonal part (×3 to be visible)</Item>}
        </>
      ) : <Item cls="w-4 border-t-2 border-sink">Fitted curve</Item>}
      {gps && <Item cls="w-4 border-t-2 border-ink">GPS</Item>}
      {compare && <Item cls="w-4 border-t-2 border-dashed border-violet">{compare.label}</Item>}
    </div>
  );
}
