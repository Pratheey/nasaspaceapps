// Compare the actual app cell and GPS samples on shared dates. The exported residuals
// are a separate native-pixel / seven-day-median validation, not this chart's error.
export function stationComparison(D, station) {
  if (!station?.gps) return null;
  const radar = D.values[station.cell_index] || [];
  const byDate = new Map(station.gps.dates.map((d, k) => [d, station.gps.los_m[k]]));
  const gps = D.dates.map((d) => byDate.get(d.toISOString().slice(0, 10)) ?? null);
  const shared = gps.map((v, k) => Number.isFinite(v) && Number.isFinite(radar[k]));
  const first = shared.indexOf(true), last = D.dates.length - 1;
  const offset = first < 0 ? 0 : radar[first] - gps[first];
  const flagged = new Set(station.residuals?.unwrap_flagged_pairs || []);
  const residuals = [];
  for (let k = 1; k <= last; k++) {
    const pair = D.meta.pairs?.[k - 1]?.pair ?? k;
    if (shared[k - 1] && shared[k] && !flagged.has(pair))
      residuals.push((radar[k] - radar[k - 1]) - (gps[k] - gps[k - 1]));
  }
  return {
    gps: { dates: D.dates, los: gps.map((v) => Number.isFinite(v) && first >= 0 ? v + offset : null) },
    start: first < 0 ? null : D.dates[first], end: D.dates[last],
    net_m: first >= 0 && first < last && shared[last]
      ? (radar[last] - radar[first]) - (gps[last] - gps[first]) : null,
    pairs_rms_m: residuals.length ? Math.sqrt(residuals.reduce((s, v) => s + v * v, 0) / residuals.length) : null,
    n_pairs: residuals.length,
  };
}
