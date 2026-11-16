import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dateFractions, linePath } from "../src/lib/chart.js";
import { loadData, cellAt } from "../src/lib/data.js";
import { readHash, writeHash } from "../src/lib/extras.js";
import { loadRadar } from "../src/lib/radar.js";
import { cellValue } from "../src/lib/view.js";
import { stationComparison } from "../src/lib/gps.js";
import { motionPatterns, hiddenSinking } from "../src/lib/patterns.js";
import { FRINGE_M, fringe } from "../src/lib/colors.js";
import { prepareDance } from "../src/story/danceData.js";

function fixture(is_synthetic) {
  return {
    "meta.json": {
      is_synthetic,
      grid: { nrows: 1, ncols: 2, lat_max: 37, lon_min: -120, step_deg: 0.01 },
      dates: ["2025-11-24", "2025-12-06"],
      units: "m", labels: { 0: "Insufficient", 1: "Both", 2: "Seasonal", 3: "Sinking" },
      fit: { t0: "2026-01-01", period_yr: 1 },
    },
    "grid.json": {
      is_synthetic, net_change_m: [-0.02, null], net_change_sigma_m: [0.01, null],
      label: [3, 0], seasonal_significant: [false, null], amp_m: [null, null],
      amp_sigma_m: [null, null], peak_month: [null, null], trend_m_per_yr: [null, null],
      trend_sigma_m_per_yr: [null, null], fit_c_m: [null, null], fit_a_m: [null, null],
      fit_b_m: [null, null], n_valid_dates: [2, 1],
    },
    "series.json": { is_synthetic, values_m: [[0, -0.02], [0, null]] },
    "stations.json": { is_synthetic, stations: [] },
  };
}

function mockFiles(t, folders) {
  t.mock.method(globalThis, "fetch", async (url) => {
    const [, folder, file] = url.split("/");
    const value = folders[folder]?.[file];
    if (value instanceof Response) return value;
    return value ? Response.json(value) : new Response("<!doctype html>", { headers: { "content-type": "text/html" } });
  });
}

test("loads complete NISAR data", async (t) => {
  mockFiles(t, { data: fixture(false) });
  const D = await loadData();
  assert.equal(D.synthetic, false);
  assert.equal(D.fallback, null);
  assert.equal(D.n, 2);
});

test("distinguishes absent data from a failed or mixed dataset", async (t) => {
  const folders = { samples: fixture(true) };
  mockFiles(t, folders);
  const absent = await loadData();
  assert.equal(absent.synthetic, true);
  assert.equal(absent.fallback, "missing");

  folders.data = fixture(false);
  folders.data["stations.json"] = new Response("{broken");
  const malformed = await loadData();
  assert.equal(malformed.synthetic, true);
  assert.equal(malformed.fallback, "incomplete");

  folders.data["stations.json"] = fixture(true)["stations.json"];
  assert.equal((await loadData()).fallback, "incomplete");
});

test("reports failure if no complete dataset exists", async (t) => {
  mockFiles(t, {});
  await assert.rejects(loadData, /complete dataset/);
});

test("a grid missing map labels or fit values falls back to samples", async (t) => {
  const folders = { data: fixture(false), samples: fixture(true) };
  mockFiles(t, folders);
  delete folders.data["grid.json"].label;
  assert.equal((await loadData()).fallback, "incomplete");
  folders.data = fixture(false);
  folders.data["grid.json"].fit_c_m.pop();
  assert.equal((await loadData()).fallback, "incomplete");
});

test("share link round-trips the first date, cell zero and active map tools", (t) => {
  let hash;
  Object.defineProperty(globalThis, "history", { configurable: true, value: {
    replaceState(_state, _title, url) { hash = url; },
  } });
  t.after(() => { delete globalThis.history; });
  writeHash({
    mode: "pair", k1: 0, k2: 1, cursor: 0, sel: 0, pin: -1, gps: true,
    lens: true, fields: true, field: { field_id: "field=1" }, split: true,
  });
  assert.deepEqual(readHash(hash), {
    mode: "pair", a: "0", b: "1", t: "0", cell: "0", gps: "1", lens: "1", fields: "1", field: "field=1", split: "1",
  });
  assert.deepEqual(readHash("#team"), {});
  assert.equal(readHash("#mode=breathe&prof=%").mode, "breathe");
  writeHash({ mode: "net", profile: { canal: true } });
  assert.equal(readHash(hash).canal, "1");
});

test("invalid measurements, calendar dates and synthetic flags cannot masquerade as real data", async (t) => {
  const folders = { data: fixture(false), samples: fixture(true) };
  mockFiles(t, folders);
  for (const mutate of [
    (f) => { f["series.json"].values_m[0][1] = "-0.02"; },
    (f) => { f["grid.json"].label[0] = 6; },
    (f) => { f["grid.json"].net_change_sigma_m[0] = -0.01; },
    (f) => { f["meta.json"].dates[1] = "2026-02-31"; },
    (f) => { Object.values(f).forEach((obj) => { obj.is_synthetic = "false"; }); },
  ]) {
    folders.data = fixture(false); mutate(folders.data);
    assert.equal((await loadData()).fallback, "incomplete");
  }
  folders.data = fixture(false);
  assert.equal(cellAt(await loadData(), NaN, 36), -1);
});

test("malformed optional canal does not break the valid main dataset", async (t) => {
  const data = fixture(false);
  data["meta.json"].canal_profiles = ["canal.json"];
  data["canal.json"] = { is_synthetic: false, distance_km: [0, 1], lat: [36], lon: [-120, -120] };
  mockFiles(t, { data });
  assert.equal((await loadData()).canal, null);
  data["canal.json"].lat = [36, 36.01];
  assert.equal((await loadData()).canal.distance_km.length, 2);
});

test("inconsistent files and unsafe station metadata fall back before rendering", async (t) => {
  const folders = { samples: fixture(true) };
  mockFiles(t, folders);
  const station = () => ({ station: "TEST", role: "held_out", lat: 36.995, lon: -119.995, cell_index: 0,
    gps: { dates: ["2025-11-24", "2025-12-06"], los_m: [0, -0.02] } });
  for (const mutate of [
    f => { delete f["meta.json"].labels; },
    f => { f["meta.json"].units = "cm"; },
    f => { f["meta.json"].fit.period_yr = 2; },
    f => { f["meta.json"].notes = "draft"; },
    f => { f["grid.json"].net_change_m[0] = -0.03; },
    f => { f["grid.json"].n_valid_dates[0] = 1; },
    f => { const s = station(); s.gps.dates.reverse(); f["stations.json"].stations = [s]; },
    f => { f["stations.json"].stations = [station(), station()]; },
    f => { const s = station(); s.residuals = { net_m: "bad", pairs_rms_m: 0, n_pairs: 1, unwrap_flagged_pairs: [] }; f["stations.json"].stations = [s]; },
  ]) {
    folders.data = fixture(false); mutate(folders.data);
    assert.equal((await loadData()).fallback, "incomplete");
  }
});

test("GPS evidence uses chart dates and the app cell, with late starts, gaps and flagged pairs", () => {
  const dates = ["2025-11-24", "2025-12-06", "2025-12-18", "2025-12-30"];
  const D = { dates: dates.map((d) => new Date(d)), values: [[0, 0.02, 0.06, 0.09]], meta: {} };
  const station = { cell_index: 0, gps: { dates: dates.slice(1), los_m: [10, 10.01, 10.04] },
    residuals: { net_m: 999, unwrap_flagged_pairs: [2] } };
  const result = stationComparison(D, station);
  assert.ok(Math.abs(result.net_m - 0.03) < 1e-10);
  assert.equal(result.n_pairs, 1);
  assert.ok(result.pairs_rms_m < 1e-10);
  assert.equal(result.gps.los[0], null);
  assert.ok(Math.abs(result.gps.los[1] - 0.02) < 1e-10);
  D.values[0][3] = null;
  assert.equal(stationComparison(D, station).net_m, null);
  assert.equal(stationComparison(D, station).n_pairs, 0);
});

test("motion patterns handle sparse and identical records without inventing tails", () => {
  const dates = Array.from({ length: 22 }, (_, k) => new Date(Date.UTC(2025, 0, k + 1)));
  const D = { n: 2, dates, values: [new Array(22).fill(null), [0, ...new Array(21).fill(null)]] };
  assert.equal(motionPatterns(D).K, 0);
  const complete = { n: 2, dates, values: [dates.map((_, k) => k * 0.001), dates.map((_, k) => k * 0.001)] };
  assert.equal(motionPatterns(complete).K, 1);
  const missingTail = { n: 1, dates, values: [dates.map((_, k) => k === 21 ? null : k * 0.001)] };
  assert.equal(motionPatterns(missingTail).used, 0);
});

test("motion pattern interpolation respects elapsed time across irregular gaps", () => {
  const times = [0, 1, 3, ...Array.from({ length: 19 }, (_, k) => k + 4)];
  const D = { n: 1, dates: times.map((t) => new Date(t * 864e5)), values: [times.map((t, k) => k === 1 ? null : t * 0.01)] };
  const result = motionPatterns(D, 1);
  assert.ok(Math.abs(result.centers[0][1] - 1) < 1e-10);
});

test("hidden sinking respects exported significance at rounded threshold boundaries", () => {
  const D = { n: 2, dates: [0, 130, 260].map((day) => new Date(day * 864e5)),
    values: [[0, 0.02, -0.0396], [0, 0.02, -0.0396]],
    grid: { net_change_m: [-0.0396, -0.0396], label: [0, 3] } };
  const result = hiddenSinking(D);
  assert.equal(result.sinking, 1);
  assert.equal(result.count, 1);
  assert.equal(result.value[0], null);
});

test("fringe cycle matches track 034 frequency, rather than a nominal mission wavelength", () => {
  assert.ok(Math.abs(FRINGE_M - 0.12098) < 0.000005);
  assert.deepEqual(fringe(0), fringe(FRINGE_M));
});

test("animation summaries describe observed LOS without claiming groundwater causation", () => {
  const values = [0, 0.04, -0.07, -0.02];
  const D = { n: 20, dates: [0, 1, 2, 3].map((k) => new Date(Date.UTC(2025, k * 3, 1))),
    meta: { grid: { ncols: 5, nrows: 4, lat_max: 37, step_deg: 0.01 } },
    values: Array.from({ length: 20 }, () => values),
    grid: { net_change_m: Array(20).fill(-0.02), label: Array(20).fill(0) } };
  const P = prepareDance(D, { heightFrac: 0.1, headingDeg: 0 });
  assert.equal(P.nFull, 20);
  assert.ok(P.parts[0].text.includes("toward the satellite"));
  assert.ok(!P.parts.some((p) => /pumping|water returns/.test(p.text)));
});

test("Two dates readout is the change from date A to date B", () => {
  const files = fixture(false);
  const D = { meta: files["meta.json"], values: files["series.json"].values_m };
  assert.equal(cellValue(D, { mode: "pair", k1: 0, k2: 1 }, 0), -0.02);
});

test("chart paths break at unmeasured dates", () => {
  assert.equal(linePath([[0, 0], [1, -1], null, [3, -4], [4, -5]]), "M0.00,0.00L1.00,-1.00M3.00,-4.00L4.00,-5.00");
});

test("radar chart positions respect acquisition gaps", () => {
  assert.deepEqual(dateFractions(["2026-07-10", "2026-07-22", "2026-08-15"]), [0, 1 / 3, 1]);
  assert.equal(linePath([[0, 1], null, [100, 2]]), "M0.00,1.00M100.00,2.00");
});

test("published real data and sample fallback remain loadable", async (t) => {
  const folders = Object.fromEntries(["data", "samples"].map((folder) => [folder,
    Object.fromEntries(["meta", "grid", "series", "stations"].map((name) => [name + ".json",
      JSON.parse(readFileSync(new URL(`../public/${folder}/${name}.json`, import.meta.url)))]))]));
  mockFiles(t, folders);
  const real = await loadData();
  assert.equal(real.synthetic, false);
  assert.equal(real.n, 12000);
  assert.equal(real.fallback, null);
  delete folders.data;
  const sample = await loadData();
  assert.equal(sample.synthetic, true);
  assert.equal(sample.fallback, "missing");
});

test("radar field files load from static hosts and retry after failure", async (t) => {
  const folders = { radar: {} };
  mockFiles(t, folders);
  assert.equal(await loadRadar(), null);
  folders.radar = {
    "polarization.json": { fields: 1 },
    "coverage.json": { totals: {} },
    "fields.json": new Response('{"type":"FeatureCollection","features":[]}', {
      headers: { "content-type": "application/octet-stream" },
    }),
  };
  assert.equal(await loadRadar(), null, "malformed successful responses must not be cached as usable data");
  const real = Object.fromEntries(["polarization", "coverage", "fields"].map(name =>
    [name + ".json", JSON.parse(readFileSync(new URL(`../public/radar/${name}.json`, import.meta.url)))]));
  folders.radar = structuredClone(real);
  folders.radar["coverage.json"].is_synthetic = true;
  assert.equal(await loadRadar(), null, "mixed sample/real files must fail");
  folders.radar = structuredClone(real);
  folders.radar["fields.json"].features[0].properties.hv_over_hh_db.pop();
  assert.equal(await loadRadar(), null, "all fields must match the shared dates");
  for (const mutate of [
    (f) => { f["coverage.json"].totals.nisar.usable++; },
    (f) => { f["coverage.json"].pairs[0].nisar_usable = -1; },
    (f) => { f["polarization.json"].dates[1] = f["polarization.json"].dates[0]; },
    (f) => { f["fields.json"].features[0].geometry.coordinates[0][0][1] = 100; },
    (f) => { f["fields.json"].features[0].properties.field_id = f["fields.json"].features[1].properties.field_id; },
  ]) {
    folders.radar = structuredClone(real); mutate(folders.radar);
    assert.equal(await loadRadar(), null, "invalid counts, dates or geometry must be rejected without poisoning retries");
  }
  folders.radar = real;
  folders.radar["fields.json"] = new Response(JSON.stringify(real["fields.json"]), {
    headers: { "content-type": "application/octet-stream" },
  });
  assert.equal((await loadRadar()).fields.features.length, real["polarization.json"].fields);
});
