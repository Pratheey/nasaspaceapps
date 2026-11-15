import { legendGradient, fringeGradient, LABEL_COLORS, rgb, FRINGE_M } from "../lib/colors.js";
import { cm, fmtShort } from "../lib/fmt.js";
import { viewTitle } from "../lib/view.js";
import { RELIEF_H } from "./MapView.jsx";

const Hatch = () => (
  <span className="inline-block w-4 h-3 rounded-sm border border-hair-2 bg-[repeating-linear-gradient(-45deg,transparent_0_3px,rgba(237,230,218,.5)_3px_4px)]" />
);

export default function Legend({ D, S, domain }) {
  const prov = D.synthetic ? "Synthetic data" : `${D.meta.product_maturity[0].toUpperCase()}${D.meta.product_maturity.slice(1)} NISAR data`;
  return (
    <div className="w-[300px] max-md:w-auto rounded-lg border border-hair-2 bg-space/90 backdrop-blur px-3.5 py-3 text-[13px] shadow-[0_10px_40px_rgba(0,0,0,.45)]">
      <h3 className="font-display text-[15.5px] font-semibold mb-2">{S.swipe != null ? `Ground on ${fmtShort(D.dates[S.k1])} (left) and ${fmtShort(D.dates[S.k2])} (right)` : viewTitle(D, S, fmtShort)}</h3>
      {S.mode === "labels" ? (
        <ul className="space-y-1.5">
          {["1", "2", "3"].map((k) => (
            <li key={k} className="flex gap-2 items-center leading-tight">
              <span className="w-4 h-3 rounded-sm shrink-0" style={{ background: rgb(LABEL_COLORS[k]) }} />{D.meta.labels[k]}
            </li>
          ))}
          <li className="flex gap-2 items-center"><Hatch />{D.meta.labels["0"]}</li>
        </ul>
      ) : S.mode === "fringe" ? (
        <>
          <div className="h-3 rounded-sm" style={{ background: fringeGradient() }} />
          <p className="mt-1.5 text-ink/90 max-md:text-[12px]">Each full color cycle is {(FRINGE_M * 100).toFixed(1)} cm of motion toward or away from the satellite: half the wavelength of NISAR's L-band radar. Count the bands to read how far the ground moved.</p>
        </>
      ) : (
        <>
          <div className="h-3 rounded-sm" style={{ background: legendGradient() }} />
          <div className="flex justify-between mt-1 mb-2 text-mute">
            <span><span className="text-sink">{cm(-domain, 0)}</span> sinking</span><span>still</span><span>rising <span className="text-rise">{cm(domain, 0)}</span></span>
          </div>
          <p className="flex items-center gap-2"><Hatch />No reliable measurement</p>
          {S.mode !== "net" && <p className="mt-1.5 text-mute leading-snug max-md:hidden">Same scale in every view, so views can be compared directly.</p>}
        </>
      )}
      {S.relief && (
        <p className="mt-1.5 text-mute leading-snug">3D height shows the same values, exaggerated: 1 cm of motion is about {Math.round(RELIEF_H / (2 * domain * 100))} m of height. Right-drag to tilt.</p>
      )}
      <p className="mt-1.5 text-mute leading-snug max-md:hidden">Along the radar's line of sight, relative to GPS station {D.meta.reference_station}. {prov}.</p>
    </div>
  );
}
