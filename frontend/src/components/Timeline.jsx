import { useRef } from "react";
import { Pause, Play, StepBack, StepForward } from "lucide-react";
import { fmtDate, fmtShort } from "../lib/fmt.js";
import { linePath } from "../lib/chart.js";

// The orbit track: one mark per NISAR pass, 12 days apart. Gaps are missed passes.
// Dates A and B always sit on the track and can always be dragged; moving either opens Two dates.
export default function Timeline({ D, S, trace, onPair, onPlay, onStep }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const N = D.dates.length;
  const a = +D.dates[0], b = +D.dates[N - 1];
  const frac = (k) => (+D.dates[k] - a) / (b - a);
  const left = (k) => `calc(20px + (100% - 40px) * ${frac(k).toFixed(4)})`;

  const nearest = (e) => {
    const r = ref.current.getBoundingClientRect();
    const f = (e.clientX - r.left - 20) / (r.width - 40);
    let best = 0, bd = 9;
    D.dates.forEach((_, k) => { const d = Math.abs(frac(k) - f); if (d < bd) { bd = d; best = k; } });
    return best;
  };
  const down = (e) => {
    ref.current.setPointerCapture(e.pointerId);
    const k = nearest(e);
    drag.current = Math.abs(k - S.k1) <= Math.abs(k - S.k2) ? "k1" : "k2"; // grab the nearer of A and B
    onPair(drag.current, k);
  };
  const move = (e) => {
    if (!drag.current || !ref.current.hasPointerCapture(e.pointerId)) return;
    const k = nearest(e);
    onPair(drag.current, k);
  };

  let tracePath = "";
  if (trace) {
    const ok = trace.filter((x) => x != null);
    const lo = Math.min(0, ...ok), hi = Math.max(0, ...ok), sp = hi - lo || 1;
    tracePath = linePath(trace.map((x, k) => x == null ? null : [frac(k) * 1000, 6 + (1 - (x - lo) / sp) * 40]));
  }
  const months = [];
  let lastM = -1;
  D.dates.forEach((d, k) => { if (d.getUTCMonth() !== lastM) { lastM = d.getUTCMonth(); if (!months.length || k - months[months.length - 1] >= 2) months.push(k); } });
  const days = Math.round((D.dates[S.k2] - D.dates[S.k1]) / 864e5);

  return (
    <section aria-label="Radar passes" className="shrink-0 border-t border-hair bg-deck/80 backdrop-blur px-3 pt-2 pb-1">
      <div className="flex items-center gap-2 px-2">
        <button disabled={S.mode === "pair"} onClick={() => onStep(-1)} className="p-1.5 rounded-md text-mute hover:text-ink hover:bg-deck-2 disabled:opacity-40" aria-label="Previous pass"><StepBack size={16} /></button>
        <button onClick={onPlay} aria-pressed={S.playing}
          className="flex items-center gap-1.5 rounded-md bg-accent text-space font-semibold text-sm px-3 py-1.5 hover:bg-accent-2 shadow-[0_0_18px_rgba(157,176,138,.35)]">
          {S.playing ? <Pause size={15} /> : <Play size={15} />} {S.playing ? "Pause" : "Play"}
        </button>
        <button disabled={S.mode === "pair"} onClick={() => onStep(1)} className="p-1.5 rounded-md text-mute hover:text-ink hover:bg-deck-2 disabled:opacity-40" aria-label="Next pass"><StepForward size={16} /></button>
        <p className="ml-2 text-[13.5px] text-mute truncate" aria-live="polite">
          {S.mode === "pair"
            ? <>Comparing <span className="text-ink">{fmtDate(D.dates[S.k1])}</span> with <span className="text-ink">{fmtDate(D.dates[S.k2])}</span>, {days} days apart. Drag A or B.</>
            : S.mode === "breathe"
              ? <><span className="font-mono text-ink">pass {String(S.cursor + 1).padStart(2, "0")}/{N}</span>, <span className="font-mono text-ink">{fmtDate(D.dates[S.cursor])}</span>: ground position compared with {fmtShort(D.dates[0])}. Drag A or B to compare any two dates.</>
              : <>{N} radar passes on a 12-day schedule. Press Play to watch the valley move, or drag A or B to compare any two dates.</>}
        </p>
      </div>
      <div ref={ref} onPointerDown={down} onPointerMove={move} onLostPointerCapture={() => (drag.current = null)}
        className="relative h-[64px] cursor-pointer select-none touch-none">
        {trace && (
          <svg viewBox="0 0 1000 52" preserveAspectRatio="none" aria-hidden="true" className="absolute left-5 right-5 top-1 w-[calc(100%-40px)] h-[46px]">
            <path d={tracePath} fill="none" stroke="#D08B5B" strokeWidth="2" vectorEffect="non-scaling-stroke" opacity="0.7" />
          </svg>
        )}
        <div className="absolute left-5 right-5 top-[27px] h-px bg-hair-2" />
        {D.dates.map((d, k) => {
          const inPair = S.mode === "pair" && k >= S.k1 && k <= S.k2;
          const now = S.mode !== "pair" && k === S.cursor && (S.mode === "breathe" || S.playing);
          return (
            <span key={k} title={fmtDate(d)} style={{ left: left(k) }}
              className={`absolute -translate-x-1/2 rounded-full transition-all ${now ? "top-[19px] w-[5px] h-[17px] bg-accent shadow-[0_0_10px_#9DB08A]" : inPair ? "top-[22px] w-[3px] h-[11px] bg-accent-2" : "top-[23px] w-[2px] h-[9px] bg-ink/45"}`} />
          );
        })}
        {months.map((k) => (
          <span key={k} style={{ left: left(k) }} className="absolute top-[42px] -translate-x-[2px] text-[11.5px] text-mute whitespace-nowrap max-sm:[&:nth-of-type(even)]:hidden">
            {fmtShort(D.dates[k]).split(" ")[1]}{D.dates[k].getUTCMonth() === 0 ? ` ${D.dates[k].getUTCFullYear()}` : ""}
          </span>
        ))}
        {[["k1", "A"], ["k2", "B"]].map(([key, name]) => (
          <span key={key} role="slider" tabIndex={0} style={{ left: left(S[key]) }}
            aria-label={`Date ${name}`} aria-valuemin={0} aria-valuemax={N - 1} aria-valuenow={S[key]} aria-valuetext={fmtDate(D.dates[S[key]])}
            onKeyDown={(e) => { const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (d) { e.preventDefault(); e.stopPropagation(); onPair(key, S[key] + d); } }}
            className={`absolute top-[2px] -translate-x-1/2 ${S.mode === "pair" ? "" : "opacity-70 hover:opacity-100"} bg-accent text-space font-display font-bold text-[12px] leading-none px-1.5 py-1 rounded cursor-grab shadow-[0_0_14px_rgba(157,176,138,.55)] after:content-[''] after:absolute after:left-1/2 after:top-full after:w-[2px] after:h-[22px] after:-ml-px after:bg-accent`}>
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}
