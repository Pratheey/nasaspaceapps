import { fmtShort } from "../lib/fmt.js";

// A surveyor's staff planted at the selected spot. Every pass leaves a tick where the
// ground stood; the current pass is marked in accent, like the pole near Mendota with
// the years painted where the ground used to be.
const W = 150, H = 300, TOP = 16, BOT = 18, RX = 62, RW = 18;

export default function Gauge({ dates, values, cursor }) {
  const vals = values.map((v) => (v == null ? null : v * 100));
  const ok = vals.filter((v) => v != null);
  if (!ok.length) return <p className="text-mute text-sm">No measurements here.</p>;
  let hi = Math.max(0, ...ok), lo = Math.min(0, ...ok);
  const span = Math.max(4, hi - lo), mid = (hi + lo) / 2;
  hi = mid + span * 0.55; lo = mid - span * 0.55;
  const Y = (v) => TOP + ((hi - v) / (hi - lo)) * (H - TOP - BOT);
  const unit = span > 30 ? 5 : span > 12 ? 2 : 1;
  const blocks = [];
  for (let v = Math.floor(lo / unit) * unit; v < hi; v += unit) blocks.push(v);
  const k = cursor ?? vals.length - 1;
  const kv = vals[k];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[128px] h-auto block" fontFamily="Public Sans, sans-serif" role="img" aria-label="Height gauge: where the ground stood on each date">
      <defs>
        <linearGradient id="soil" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#C9854A" stopOpacity="0.28" />
          <stop offset="1" stopColor="#C9854A" stopOpacity="0" />
        </linearGradient>
      </defs>
      {kv != null && <rect x="0" y={Y(kv)} width={W} height={H - Y(kv)} fill="url(#soil)" />}
      {blocks.map((v) => {
        const y1 = Math.max(TOP, Y(v + unit)), y2 = Math.min(H - BOT, Y(v));
        const odd = Math.round(v / unit) % 2 !== 0;
        return (
          <g key={v}>
            <rect x={RX} y={y1} width={RW} height={Math.max(0, y2 - y1)} fill={odd ? "#8FA66B" : "#2C251C"} />
            {Math.round(v / unit) % (unit === 1 ? 2 : 1) === 0 && (
              <text x={RX + RW + 6} y={y2 + 3} fontSize="11" fill="#A79C8A">{v > 0 ? "+" : v < 0 ? "−" : ""}{Math.abs(v)}</text>
            )}
          </g>
        );
      })}
      <rect x={RX} y={TOP} width={RW} height={H - TOP - BOT} fill="none" stroke="rgba(237,230,218,0.4)" />
      {vals.map((v, j) => v != null && (
        <line key={j} x1={RX - 7} x2={RX} y1={Y(v)} y2={Y(v)} stroke={j === k ? "#B9CB99" : "rgba(237,230,218,0.45)"} strokeWidth={j === k ? 2 : 1} />
      ))}
      <line x1={RX - 56} x2={RX + RW} y1={Y(0)} y2={Y(0)} stroke="rgba(237,230,218,0.6)" strokeDasharray="3 2" />
      <text x={RX - 10} y={Y(0) - 4} textAnchor="end" fontSize="12" fontWeight="600" fill="#EDE6DA" fontFamily="Saira Semi Condensed">{fmtShort(dates[0])}</text>
      {kv != null && (
        <>
          <line x1="0" x2={W} y1={Y(kv)} y2={Y(kv)} stroke="#C9854A" strokeWidth="2" />
          <text x={RX - 10} y={Y(kv) + 14} textAnchor="end" fontSize="12" fontWeight="600" fill="#B9CB99" fontFamily="Saira Semi Condensed">{fmtShort(dates[k])}</text>
        </>
      )}
    </svg>
  );
}
