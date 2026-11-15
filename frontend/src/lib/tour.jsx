// The guided walkthrough, mirroring the 30-second pitch. Each step returns the state to
// apply, where to point the camera, and what to say. Published figures are credited.
import { mostMisleadingPair } from "./data.js";
import { cm, fmtShort } from "./fmt.js";
import { demoStations, lieStation } from "./demo.js";

const CORCORAN = [-119.56, 36.098];

function findLie(D) {
  const st = lieStation(D);
  const p = st && mostMisleadingPair(D, st.cell_index);
  if (p) return { i: st.cell_index, p, station: st.station };
  let best = null;
  for (let i = 0; i < D.n; i++) {
    if (D.grid.label[i] !== 1 && D.grid.label[i] !== 3) continue;
    const q = mostMisleadingPair(D, i);
    if (q && (!best || q.gap > best.p.gap)) best = { i, p: q };
  }
  return best;
}

export function tourSteps(D) {
  const st = lieStation(D);
  const calm = demoStations(D).calm;
  const lie = findLie(D);
  return [
    {
      title: "A town that keeps raising its levee",
      state: { mode: "net", relief: false, playing: false, gps: false },
      camera: { center: CORCORAN, zoom: 9.3 },
      body: (
        <>
          <p>Corcoran's flood levee was built to 195 feet in 1983. By 2017 it had sunk to 188 feet. It was rebuilt to 192 feet, and by 2023 it was back at 188.</p>
          <p>The ground under this part of the valley is sinking. The glow on the map is how far it moved in NISAR's first year.</p>
          <p className="text-[12.5px] text-mute">Levee figures: SJV Water, 2023. Published measurements, not ours.</p>
        </>
      ),
    },
    lie
      ? {
          title: "Two dates say the ground is fine",
          state: { mode: "pair", k1: lie.p.k1, k2: lie.p.k2, sel: lie.i, relief: false, playing: false },
          camera: "sel",
          body: (
            <>
              <p>Compare {fmtShort(D.dates[lie.p.k1])} with {fmtShort(D.dates[lie.p.k2])}{lie.station ? ` at GPS station ${lie.station}` : ""} and the ground moved {cm(lie.p.diff)}. It looks {lie.p.diff >= 0 ? "like it rose" : "stable"}.</p>
              <p>The fitted trend over the same {Math.round(lie.p.days)} days is {cm(lie.p.expected)}. Drag A and B to try other dates.</p>
            </>
          ),
        }
      : {
          title: "Can two dates mislead here?",
          state: { mode: "pair", relief: false, playing: false },
          body: <p>In this data, no two dates hide the sinking by more than the measurement uncertainty. Drag A and B below the map to try any pair yourself.</p>,
        },
    {
      title: "The valley breathes",
      state: { mode: "breathe", cursor: 0, relief: true, playing: true },
      camera: "fit",
      body: (
        <>
          <p>Each frame is an available radar pass on a 12-day schedule. Watch the ground ease up when water returns in winter and settle in the dry months, while the sinking areas keep going down underneath.</p>
          <p className="text-[12.5px] text-mute">Height in 3D is exaggerated so small movements are visible.</p>
        </>
      ),
    },
    ...(st ? [{
      title: "Separate the breathing from the sinking",
      state: { mode: "net", relief: false, playing: false, split: true, sel: st.cell_index },
      camera: "sel",
      body: (
        <>
          <p>At {st.station} we fit a steady trend plus a once-a-year cycle. The chart splits the two, and the gauge shows where the ground stood on each date.</p>
          <p>Where the seasonal cycle isn't statistically significant, we say so instead of drawing it.{calm && calm !== st && D.grid.net_change_m[calm.cell_index] != null ? ` Compare with ${calm.station}, the calm demo station.` : ""}</p>
        </>
      ),
    }, {
      title: "Check it against GPS",
      state: { gps: true, split: false, sel: st.cell_index, playing: false },
      body: (
        <>
          <p>GPS station {st.station} was never used to calibrate the radar. Its line on the chart is an independent check.{st.residuals?.net_m != null && ` Over the whole record the radar and GPS differ by ${cm(st.residuals.net_m)}.`}</p>
          <p className="text-[19px] font-medium text-ink leading-snug pt-1">We don't tell you the ground is fine. We show you how sure we are.</p>
        </>
      ),
    }] : []),
  ];
}
