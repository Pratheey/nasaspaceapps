import { useState } from "react";
import { legendGradient, fringeGradient, LABEL_COLORS, rgb, FRINGE_M } from "../lib/colors.js";
import { cm, fmtShort } from "../lib/fmt.js";
import { viewTitle } from "../lib/view.js";
import { RELIEF_H } from "./MapView.jsx";
import { hiddenSinking, motionPatterns, PATTERN_COLORS } from "../lib/patterns.js";

const Hatch = () => (
  <span className="inline-block w-4 h-3 rounded-sm border border-hair-2 bg-[repeating-linear-gradient(-45deg,transparent_0_3px,rgba(236,233,226,.5)_3px_4px)]" />
);

export default function Legend({ D, S, domain }) {
  const [open, setOpen] = useState(true);
  const prov = D.synthetic ? "Synthetic data" : `${D.meta.product_maturity[0].toUpperCase()}${D.meta.product_maturity.slice(1)} NISAR data`;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label="Show the map legend"
        className="rounded-full border border-hair-2 bg-space/90 backdrop-blur px-3 py-1.5 text-[13px] text-ink/90 hover:text-ink shadow-[0_10px_40px_rgba(0,0,0,.45)]">
        Show legend
      </button>
    );
  }
  return (
    <div className="w-[300px] max-md:w-auto rounded-lg border border-hair-2 bg-space/90 backdrop-blur px-3.5 py-3 text-[13px] shadow-[0_10px_40px_rgba(0,0,0,.45)]">
      <div className="flex items-start gap-2 mb-2">
        <h3 className="font-display text-[15.5px] font-semibold flex-1 min-w-0">{viewTitle(D, S, fmtShort)}</h3>
        <button type="button" onClick={() => setOpen(false)} aria-label="Hide the map legend" title="Hide legend"
          className="-mr-1 -mt-0.5 shrink-0 w-6 h-6 grid place-items-center rounded text-mute hover:text-ink hover:bg-white/10 text-[18px] leading-none">×</button>
      </div>
      {S.mode === "labels" ? (
        <ul className="space-y-1.5">
          {["1", "2", "3"].map((k) => (
            <li key={k} className="flex gap-2 items-center leading-tight">
              <span className="w-4 h-3 rounded-sm shrink-0" style={{ background: rgb(LABEL_COLORS[k]) }} />{D.meta.labels[k]}
            </li>
          ))}
          <li className="flex gap-2 items-center"><Hatch />{D.meta.labels["0"]}</li>
        </ul>
      ) : S.mode === "patterns" ? (
        <PatternsLegend D={D} />
      ) : S.mode === "fringe" ? (
        <div className="h-3 rounded-sm" style={{ background: fringeGradient() }} />
      ) : (
        <>
          <div className="h-3 rounded-sm" style={{ background: legendGradient() }} />
          <div className="flex justify-between mt-1 mb-2 text-mute">
            <span><span className="text-sink">{cm(-domain, 0)}</span> sinking</span><span>still</span><span>rising <span className="text-rise">{cm(domain, 0)}</span></span>
          </div>
          <p className="flex items-center gap-2"><Hatch />No reliable measurement</p>
        </>
      )}
      <details className="group mt-2 [&_summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer list-none text-[12.5px] text-accent-2 hover:text-ink select-none">
          <span className="group-open:hidden">What does this mean?</span><span className="hidden group-open:inline">Hide explanation</span>
        </summary>
        {S.mode === "patterns" ? (
          <PatternsNote D={D} />
        ) : S.mode === "hidden" ? (
          <>
            <p className="mt-1.5 text-ink/90 leading-snug">
              Coloured spots sank beyond 2σ over the whole record, yet some pair of dates at least four months apart shows the ground there rising by 1 cm or more.
              {" "}{(() => { const h = hiddenSinking(D); return `${h.count.toLocaleString()} of ${h.sinking.toLocaleString()} sinking spots (${Math.round((100 * h.count) / Math.max(1, h.sinking))}%).`; })()}
            </p>
            <p className="mt-1 text-mute leading-snug">Grey: measured, not in this group. Colour is the sinking over the whole record. Seasonal rebound and single-date noise (about 1.8 cm per pair) both cause it. Click a spot, then open "Two dates".</p>
          </>
        ) : S.mode === "fringe" ? (
          <p className="mt-1.5 text-ink/90 max-md:text-[12px]">Each full color cycle is {(FRINGE_M * 100).toFixed(1)} cm of motion toward or away from the satellite: half the wavelength of NISAR's L-band radar. Count the bands to read how far the ground moved.</p>
        ) : S.mode !== "labels" && S.mode !== "net" ? (
          <p className="mt-1.5 text-mute leading-snug">Same scale in every view, so views can be compared directly.</p>
        ) : null}
        {S.relief && (
          <p className="mt-1.5 text-mute leading-snug">3D height shows the same values, exaggerated: 1 cm of motion is about {Math.round(RELIEF_H / (2 * domain * 100))} m of height. Right-drag to turn the view.</p>
        )}
        <p className="mt-1.5 text-mute leading-snug">Along the radar's line of sight, relative to GPS station {D.meta.reference_station}. {prov}.</p>
      </details>
    </div>
  );
}

function PatternsLegend({ D }) {
  const P = motionPatterns(D);
  const T = P.centers[0].length;
  const lo = Math.min(...P.centers.flat()), hi = Math.max(...P.centers.flat());
  const pts = (m) => m.map((v, k) => `${(k / (T - 1)) * 70},${2 + ((hi - v) / (hi - lo || 1)) * 20}`).join(" ");
  return (
    <ul className="space-y-1.5">
      {P.centers.map((m, g) => (
        <li key={g} className="flex items-center gap-2 leading-tight">
          <span className="w-4 h-3 rounded-sm shrink-0" style={{ background: rgb(PATTERN_COLORS[g]) }} />
          <svg viewBox="0 0 70 24" className="w-[70px] h-6 shrink-0" aria-hidden="true"><polyline points={pts(m)} fill="none" stroke={rgb(PATTERN_COLORS[g])} strokeWidth="1.8" /></svg>
          <span className="min-w-0">{P.describe[g]}<span className="text-mute"> · {P.counts[g].toLocaleString()} spots</span></span>
        </li>
      ))}
    </ul>
  );
}

function PatternsNote({ D }) {
  const P = motionPatterns(D);
  return (
    <p className="mt-1.5 text-mute leading-snug">
      Exploratory machine learning: k-means groups {P.used.toLocaleString()} spots whose 11-month records have a similar shape (curves: group averages, relative to the first date).
      It describes the measurements; it does not say why the ground moves or whether the sinking is permanent.
    </p>
  );
}
