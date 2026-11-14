// The guided walkthrough. Mirrors the 30-second pitch in docs/pitch/pitch.md.
// Every step reads the data it shows; nothing here is hard-coded except published figures,
// which are credited.

const CORCORAN = [-119.56, 36.098];

function demoStation(api, id) {
  return api.D.stations.find((s) => s.station === id);
}

// Find a spot where two dates hide the sinking: prefer the demo station, else search the map.
function findLie(api) {
  const st = demoStation(api, "P307");
  if (st) {
    const p = api.mostMisleadingPair(st.cell_index);
    if (p) return { i: st.cell_index, p, station: st.station };
  }
  let best = null;
  const L = api.D.grid.label;
  for (let i = 0; i < api.D.n; i++) {
    if (L[i] !== 1 && L[i] !== 3) continue;
    const p = api.mostMisleadingPair(i);
    if (p && (!best || p.gap > best.p.gap)) best = { i, p };
  }
  return best;
}

export const TOUR = [
  {
    title: "A town that keeps raising its levee",
    run(api) {
      api.setRelief(false);
      api.setMode("net");
      api.flyTo(...CORCORAN, 9.2);
      return `<p>Corcoran's flood levee was built to 195 feet in 1983. By 2017 it had sunk to 188 feet. It was
        rebuilt to 192 feet, and by 2023 it was back at 188 (SJV Water, 2023).</p>
        <p>The ground under this part of the valley is sinking. The purple on the map is how far it moved in
        NISAR's first year of radar.</p>
        <p class="cite">Levee figures are published measurements, not ours.</p>`;
    },
  },
  {
    title: "Two dates say the ground is fine",
    run(api) {
      const f = findLie(api);
      if (!f) {
        api.setMode("pair");
        return `<p>In this data, no two dates hide the sinking by more than the measurement uncertainty.
          Drag the A and B markers below the map to try any pair yourself.</p>`;
      }
      api.S.k1 = f.p.k1;
      api.S.k2 = f.p.k2;
      api.select(f.i, { fly: true });
      api.setMode("pair");
      return `<p>Compare ${api.fmtShort(api.D.dates[f.p.k1])} with ${api.fmtShort(api.D.dates[f.p.k2])}${f.station ? ` at GPS station ${f.station}` : ""}
        and the ground moved ${api.cm(f.p.diff)}. It looks ${f.p.diff >= 0 ? "like it rose" : "stable"}.</p>
        <p>The fitted trend over the same ${Math.round(f.p.days)} days is ${api.cm(f.p.expected)}. Drag A and B to try other dates.</p>`;
    },
  },
  {
    title: "The valley breathes",
    run(api) {
      api.fitAll();
      api.setMode("breathe");
      api.setRelief(true);
      api.play();
      return `<p>Each frame is one radar pass, every 12 days. Watch the ground ease up when water returns in
        winter and settle in the dry months, while the sinking areas keep going down underneath.</p>
        <p class="cite">Height in 3D is hugely exaggerated so millimetres are visible.</p>`;
    },
  },
  {
    title: "Separate the breathing from the sinking",
    run(api) {
      api.stop();
      api.setRelief(false);
      api.setMode("net");
      const st = demoStation(api, "P307") || api.D.stations[0];
      api.setSplit(true);
      api.select(st.cell_index, { fly: true });
      return `<p>At ${st.station} we fit a steady trend plus a once-a-year cycle. The chart on the right splits
        the two. The rod shows where the ground stood on each date.</p>
        <p>Where the seasonal cycle isn't statistically significant, we say so instead of drawing it.</p>`;
    },
  },
  {
    title: "Check it against GPS",
    run(api) {
      const st = demoStation(api, "P307") || api.D.stations[0];
      api.setGps(true);
      api.setSplit(false);
      api.select(st.cell_index);
      const r = st.residuals;
      return `<p>GPS station ${st.station} was never used to calibrate the radar. Its line on the chart is an
        independent check.${r && r.net_m != null ? ` Over the whole record the radar and GPS differ by ${api.cm(r.net_m)}.` : ""}</p>
        <p class="closing">We don't tell you the ground is fine. We show you how sure we are.</p>`;
    },
  },
];
