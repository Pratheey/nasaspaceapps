import { useEffect, useMemo, useRef, useState } from "react";
import { diverging, rgb } from "../lib/colors.js";
import { fmtShort, cm } from "../lib/fmt.js";

// Every pair of dates at one spot. Row = later date, column = earlier date.
// Outlined squares hide the sinking: stable or rising while the trend over the same span
// sank by more than 2σ. The blue square is the pair shown on the map.
const CELL = 13, PL = 40, PB = 30, PT = 4;

export default function PairMatrix({ D, i, k1, k2, onPick }) {
  const ref = useRef(null);
  const [read, setRead] = useState(null);

  const { cells, N, dom, nLie } = useMemo(() => {
    const v = D.values[i] || [];
    const B = D.grid.trend_m_per_yr[i];
    const sig = D.grid.net_change_sigma_m[i] ?? D.meta.sigma_net_m;
    let dom = 0.005;
    const cells = [];
    for (let b = 1; b < v.length; b++) for (let a = 0; a < b; a++) {
      if (v[a] == null || v[b] == null) { cells.push({ a, b, d: null }); continue; }
      const d = v[b] - v[a];
      dom = Math.max(dom, Math.abs(d));
      const days = (D.dates[b] - D.dates[a]) / 864e5;
      const exp = B == null ? null : B * (days / 365.25);
      cells.push({ a, b, d, exp, lie: sig != null && exp != null && days >= 90 && d > -sig && exp < -2 * sig });
    }
    return { cells, N: v.length, dom, nLie: cells.filter((c) => c.lie).length };
  }, [D, i]);

  const Wd = PL + N * CELL + 4, Hd = PT + N * CELL + PB;
  const px = (a) => PL + a * CELL, py = (b) => PT + (b - 1) * CELL;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Wd * dpr; c.height = Hd * dpr;
    const x = c.getContext("2d");
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, Wd, Hd);
    cells.forEach((k) => {
      x.fillStyle = k.d == null ? "rgba(237,230,218,0.07)" : rgb(diverging(k.d, dom));
      x.fillRect(px(k.a), py(k.b), CELL - 1, CELL - 1);
    });
    x.strokeStyle = "#EDE6DA"; x.lineWidth = 1.4;
    cells.forEach((k) => k.lie && x.strokeRect(px(k.a) + 0.7, py(k.b) + 0.7, CELL - 2.4, CELL - 2.4));
    if (k2 > k1) {
      x.strokeStyle = "#8FA66B"; x.lineWidth = 2.5;
      x.strokeRect(px(k1) - 1, py(k2) - 1, CELL + 1, CELL + 1);
    }
    x.fillStyle = "#A79C8A"; x.font = "11px 'Public Sans', sans-serif";
    let lastM = -1;
    D.dates.forEach((d, k) => {
      const m = d.getUTCMonth();
      if (m === lastM) return;
      lastM = m;
      if (m % 2) return;
      const lab = fmtShort(d).split(" ")[1];
      x.textAlign = "center"; if (k < N - 1) x.fillText(lab, px(k) + CELL / 2, Hd - PB + 14);
      x.textAlign = "right"; if (k > 0) x.fillText(lab, PL - 5, py(k) + CELL - 3);
    });
    x.textAlign = "left"; x.fillText("earlier date →", PL, Hd - 4);
    x.save(); x.translate(4, PT + 2); x.rotate(Math.PI / 2); x.fillText("later date →", 0, 0); x.restore();
  }, [cells, dom, k1, k2, D, N, Wd, Hd]);

  const hit = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) * Wd / r.width;
    const y = (e.clientY - r.top) * Hd / r.height;
    const a = Math.floor((x - PL) / CELL), b = Math.floor((y - PT) / CELL) + 1;
    if (a < 0 || b < 1 || b >= N || a >= b) return null;
    return cells.find((k) => k.a === a && k.b === b);
  };

  return (
    <div>
      <p className="text-[13px] text-mute mb-2">
        {nLie ? `${nLie} outlined pair${nLie > 1 ? "s" : ""} make this spot look stable or rising while the trend says it sank.` : "No pair here hides the sinking."} The blue square is the pair on the map.
      </p>
      <canvas
        ref={ref}
        style={{ width: Wd, aspectRatio: `${Wd} / ${Hd}` }}
        className="block h-auto max-w-full cursor-pointer"
        aria-label="Every pair of dates at this spot. Click a square to compare those two dates."
        onMouseMove={(e) => setRead(hit(e))}
        onMouseLeave={() => setRead(null)}
        onClick={(e) => { const k = hit(e); if (k && k.d != null) onPick(k.a, k.b); }}
      />
      <p className="text-[13.5px] min-h-[2.6em] mt-1.5 text-ink/90">
        {!read ? "Point at a square to read it. Click to compare those two dates on the map."
          : read.d == null ? `${fmtShort(D.dates[read.a])} to ${fmtShort(D.dates[read.b])}: no measurement on one of the dates.`
          : <>{fmtShort(D.dates[read.a])} to {fmtShort(D.dates[read.b])}: <strong>{cm(read.d)}</strong>{read.exp != null && `, trend says ${cm(read.exp)}`}.{read.lie && <span className="text-accent-2"> This pair hides the sinking.</span>}</>}
      </p>
    </div>
  );
}
