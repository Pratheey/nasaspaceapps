// Demo stations and measured agreement, from the team decisions in docs/DECISIONS.md.
// D5: the demo uses meta.demo_stations (CAFP and CAHA sinking, P300 calm). The synthetic
// samples predate D5, so they fall back to their old pair (P307 sinking, P302 calm).
import { mostMisleadingPair } from "./data.js";

const byName = (D, n) => D.stations.find((s) => s.station === n);

export function demoStations(D) {
  const ds = D.meta.demo_stations;
  let sinking = (ds?.sinking || []).map((n) => byName(D, n)).filter(Boolean);
  let calm = ds?.calm ? byName(D, ds.calm) : null;
  if (!sinking.length) sinking = [byName(D, "P307") || D.stations[0]].filter(Boolean);
  if (!calm) calm = byName(D, "P302") || D.stations.find((s) => !sinking.includes(s)) || D.stations[0];
  return { sinking, calm, sink: sinking[0] };
}

// The sinking demo station where two dates mislead most (pitch candidate: CAHA, D5).
export function lieStation(D) {
  const { sinking } = demoStations(D);
  let best = sinking[0];
  let gap = -Infinity;
  for (const st of sinking) {
    const p = mostMisleadingPair(D, st.cell_index);
    if (p && p.gap > gap) { gap = p.gap; best = st; }
  }
  return best;
}

// D7: NISAR vs cleaned GPS, line of sight, per 12-day pair. Update from
// gps/processed/uncertainty.json (sigma_pair_m, n_stations) when Daniel adds stations.
// Never write "1 cm" or "centimetre-level" anywhere in the app.
export const AGREEMENT = {
  rms_cm: 1.7,
  n_stations: 3,
  selfcheck: "1.2 to 2.2 cm",
  selfcheck_n: 13,
  descending_cm: 3,
};

// D6: the real map is labelled draft until the real-data gate passes. The analysis lane
// marks a draft export with a note containing "draft" in meta.notes.
export const isDraft = (D) => !D.synthetic && (D.meta.notes || []).some((n) => /draft/i.test(n));
