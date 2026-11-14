import { MONTH_NAMES } from "../lib/fmt.js";

// The year as a circle. Each pass sits at its day of the year (January at the top, clockwise).
// Distance from the ring = ground position after removing the trend, so the seasons show up
// as a loop. The fitted cycle is drawn only where it is statistically significant.
const S = 300, C = S / 2, R = 78;

export default function SeasonClock({ D, i }) {
  const G = D.grid;
  const v = D.values[i] || [];
  const c = G.fit_c_m[i], B = G.trend_m_per_yr[i], a = G.fit_a_m[i], b = G.fit_b_m[i];
  const sig = G.seasonal_significant[i] === true;
  if ([c, B, a, b].some((x) => x == null)) return <p className="text-mute text-sm">Not enough measurements here to draw the year.</p>;
  const f0 = c + B * D.tYears[0] + a * Math.sin(2 * Math.PI * D.tYears[0]) + b * Math.cos(2 * Math.PI * D.tYears[0]);
  // detrended position: measurement minus the fitted trend, in the same reference as the series
  const pts = v.map((val, k) => {
    if (val == null) return null;
    const t = D.tYears[k];
    const res = val + f0 - (c + B * t);
    const doy = (D.dates[k] - Date.UTC(D.dates[k].getUTCFullYear(), 0, 1)) / (365.25 * 864e5);
    return { res, ang: doy * 2 * Math.PI, k };
  }).filter(Boolean);
  const maxAbs = Math.max(0.002, ...pts.map((p) => Math.abs(p.res)), Math.hypot(a, b));
  const k = (R * 0.42) / maxAbs;
  const xy = (ang, res) => [C + Math.sin(ang) * (R + res * k), C - Math.cos(ang) * (R + res * k)];
  const loop = Array.from({ length: 121 }, (_, j) => {
    const t = j / 120; // fraction of a year since Jan 1 of the fit epoch year
    const ang = t * 2 * Math.PI;
    const seas = a * Math.sin(2 * Math.PI * t) + b * Math.cos(2 * Math.PI * t);
    return xy(ang, seas).map((n) => n.toFixed(1)).join(",");
  }).join(" ");
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
      <svg viewBox={`0 0 ${S} ${S}`} className="w-full max-w-[300px] h-auto" role="img" aria-label="The year as a circle: seasonal position of the ground at each pass">
        <defs>
          <radialGradient id="clockbg"><stop offset="0.55" stopColor="#151C2B" /><stop offset="1" stopColor="#1C2538" /></radialGradient>
        </defs>
        <circle cx={C} cy={C} r={R + R * 0.48} fill="url(#clockbg)" stroke="rgba(170,190,230,.14)" />
        <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(230,234,242,.35)" strokeDasharray="3 4" />
        {MONTH_NAMES.map((m, j) => {
          const ang = (j / 12) * 2 * Math.PI;
          const [tx, ty] = [C + Math.sin(ang) * (R * 1.62), C - Math.cos(ang) * (R * 1.62)];
          const [l1x, l1y, l2x, l2y] = [C + Math.sin(ang) * R * 1.44, C - Math.cos(ang) * R * 1.44, C + Math.sin(ang) * R * 1.5, C - Math.cos(ang) * R * 1.5];
          return <g key={m}><line x1={l1x} y1={l1y} x2={l2x} y2={l2y} stroke="rgba(170,190,230,.3)" /><text x={tx} y={ty + 4} textAnchor="middle" fontSize="11" fill="#8D97AB">{m.slice(0, 3)}</text></g>;
        })}
        {sig && <polygon points={loop} fill="rgba(95,201,224,.10)" stroke="#5FC9E0" strokeWidth="2" style={{ filter: "drop-shadow(0 0 6px rgba(95,201,224,.6))" }} />}
        {pts.map((p) => { const [x, y] = xy(p.ang, p.res); return <circle key={p.k} cx={x} cy={y} r="3" fill="#0F1420" stroke="#E6EAF2" strokeWidth="1.3" />; })}
        <text x={C} y={C - 6} textAnchor="middle" fontSize="11" fill="#8D97AB">outside: higher</text>
        <text x={C} y={C + 10} textAnchor="middle" fontSize="11" fill="#8D97AB">inside: lower</text>
      </svg>
      <div className="text-[13px] text-mute max-w-[150px] leading-snug space-y-2">
        <p>Each dot is one pass, placed by its day of the year, with the trend taken out.</p>
        {sig
          ? <p><span className="text-rise">The loop</span> is the fitted yearly cycle. Its widest point is when the ground stands highest.</p>
          : <p>The yearly cycle isn't statistically significant here, so no loop is drawn.</p>}
      </div>
    </div>
  );
}
