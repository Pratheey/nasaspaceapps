// Loads the four app files defined in contracts/app_data.md.
// Real files live in public/data/ (written by the analysis lane). Until they exist,
// the app falls back to public/samples/ (synthetic, copied from contracts/samples/).

async function tryLoad(base) {
  const names = ["meta", "grid", "series", "stations"];
  try {
    const res = await Promise.all(names.map((n) => fetch(`${base}/${n}.json`)));
    // dev servers answer missing files with index.html, so check the type too
    if (res.some((r) => !r.ok || !(r.headers.get("content-type") || "").includes("json"))) return null;
    const json = await Promise.all(res.map((r) => r.json()));
    return Object.fromEntries(names.map((n, i) => [n, json[i]]));
  } catch {
    return null;
  }
}

export async function loadData() {
  const real = await tryLoad("./data");
  const d = real || (await tryLoad("./samples"));
  if (!d) throw new Error("No data files found in public/data or public/samples.");
  // Optional canal profile (contracts v1.2 section 5): the file named in meta.canal_profiles,
  // loaded only next to the real data files, so samples never mix with real canal data.
  let canal = null;
  const canalFile = real && Array.isArray(real.meta.canal_profiles) ? real.meta.canal_profiles[0] : null;
  if (canalFile) {
    try {
      const r = await fetch(`./data/${canalFile}`);
      if (r.ok && (r.headers.get("content-type") || "").includes("json")) canal = await r.json();
    } catch { canal = null; }
  }

  const { meta, grid, series, stations } = d;
  const g = meta.grid;
  const n = g.nrows * g.ncols;
  const dates = meta.dates.map((s) => new Date(s + "T00:00:00Z"));
  const t0 = new Date(meta.fit.t0 + "T00:00:00Z");
  const tYears = dates.map((dt) => (dt - t0) / (365.25 * 864e5));

  return {
    meta,
    grid,
    values: series.values_m,
    stations: stations.stations,
    canal,
    synthetic: !!(meta.is_synthetic || grid.is_synthetic),
    n,
    dates,
    tYears,
    t0,
    bbox: {
      west: g.lon_min,
      east: g.lon_min + g.ncols * g.step_deg,
      north: g.lat_max,
      south: g.lat_max - g.nrows * g.step_deg,
    },
  };
}

export function cellAt(D, lng, lat) {
  const g = D.meta.grid;
  const col = Math.floor((lng - g.lon_min) / g.step_deg);
  const row = Math.floor((g.lat_max - lat) / g.step_deg);
  if (row < 0 || col < 0 || row >= g.nrows || col >= g.ncols) return -1;
  return row * g.ncols + col;
}

export function cellBounds(D, i) {
  const g = D.meta.grid;
  const row = Math.floor(i / g.ncols);
  const col = i % g.ncols;
  const w = g.lon_min + col * g.step_deg;
  const n = g.lat_max - row * g.step_deg;
  return { w, e: w + g.step_deg, n, s: n - g.step_deg, lng: w + g.step_deg / 2, lat: n - g.step_deg / 2 };
}

// Fitted model u(t) = c + B t + a sin(2πt) + b cos(2πt), t in years since meta.fit.t0
export function fitAt(D, i, t) {
  const G = D.grid;
  const c = G.fit_c_m[i], B = G.trend_m_per_yr[i], a = G.fit_a_m[i], b = G.fit_b_m[i];
  if ([c, B, a, b].some((v) => v == null)) return null;
  const w = 2 * Math.PI * t;
  return { trend: c + B * t, seasonal: a * Math.sin(w) + b * Math.cos(w), total: c + B * t + a * Math.sin(w) + b * Math.cos(w) };
}

// Two-date difference at a cell, in metres (null if either date is missing).
export function pairDiff(D, i, k1, k2) {
  const v = D.values[i];
  if (!v || v[k1] == null || v[k2] == null) return null;
  return v[k2] - v[k1];
}

// The two-date comparison at cell i that most understates the sinking.
// For each pair at least 90 days apart, compare what it shows with what the fitted trend
// predicts over the same span. A pair "misleads" when it shows the ground stable or rising
// (diff > −σ) while the trend over that span is sinking by more than 2σ.
// Returns the worst such pair, or null if no pair misleads.
export function mostMisleadingPair(D, i) {
  const B = D.grid.trend_m_per_yr[i];
  const sig = D.grid.net_change_sigma_m[i] ?? D.meta.sigma_net_m;
  const v = D.values[i];
  if (B == null || !v || sig == null) return null;
  let best = null;
  for (let a = 0; a < v.length; a++) {
    for (let b = a + 1; b < v.length; b++) {
      if (v[a] == null || v[b] == null) continue;
      const days = (D.dates[b] - D.dates[a]) / 864e5;
      if (days < 90) continue;
      const diff = v[b] - v[a];
      const expected = B * (days / 365.25);
      if (!(diff > -sig && expected < -2 * sig)) continue;
      const gap = diff - expected;
      if (!best || gap > best.gap) best = { k1: a, k2: b, diff, expected, gap, days };
    }
  }
  return best;
}
