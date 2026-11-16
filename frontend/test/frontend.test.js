import assert from "node:assert/strict";
import { test } from "node:test";
import { linePath } from "../src/lib/chart.js";
import { loadData } from "../src/lib/data.js";
import { readHash, writeHash } from "../src/lib/extras.js";
import { loadRadar } from "../src/lib/radar.js";
import { cellValue } from "../src/lib/view.js";

function fixture(is_synthetic) {
  return {
    "meta.json": {
      is_synthetic,
      grid: { nrows: 1, ncols: 2, lat_max: 37, lon_min: -120, step_deg: 0.01 },
      dates: ["2025-11-24", "2025-12-06"],
      fit: { t0: "2026-01-01" },
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
});

test("Two dates readout is the change from date A to date B", () => {
  const files = fixture(false);
  const D = { meta: files["meta.json"], values: files["series.json"].values_m };
  assert.equal(cellValue(D, { mode: "pair", k1: 0, k2: 1 }, 0), -0.02);
});

test("chart paths break at unmeasured dates", () => {
  assert.equal(linePath([[0, 0], [1, -1], null, [3, -4], [4, -5]]), "M0.00,0.00L1.00,-1.00M3.00,-4.00L4.00,-5.00");
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
  assert.deepEqual((await loadRadar()).fields.features, []);
});
