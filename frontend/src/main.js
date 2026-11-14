import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { loadData, cellAt, cellBounds, fitAt, pairDiff, mostMisleadingPair } from "./data.js";
import { diverging, LABEL_COLORS, rgb, legendGradient } from "./colors.js";
import { fmtDate, fmtShort, cm, mm, pm, MONTH_NAMES } from "./fmt.js";
import { seriesChart, chartKey } from "./chart.js";
import { rod } from "./rod.js";
import { LIMITS_HTML } from "./limits.js";
import { TOUR } from "./tour.js";
import { matrixHTML, drawMatrix } from "./matrix.js";
import { sampleLine, profileSVG, profileHitFrac, profileX, profileReadout } from "./profile.js";
import { listen, stopListening, isListening, downloadCSV, writeHash, readHash } from "./extras.js";

maplibregl.setWorkerUrl(workerUrl);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s) => document.querySelector(s);

const S = {
  mode: "net",
  sel: -1,
  k1: 0,
  k2: 1,
  cursor: 0,
  gps: false,
  split: false,
  playing: false,
  tour: -1,
  pin: -1,         // second point for comparison
  relief: false,   // 3D view
  drawing: false,  // waiting for profile clicks
  profile: null,   // { a:[lng,lat], b:[lng,lat] }
  listenK: null,   // date index being sounded
};

let D, map, domain, hatch;
const PX = 6; // canvas pixels per grid cell

/* ---------------- boot ---------------- */
loadData()
  .then((d) => {
    D = d;
    S.k2 = D.dates.length - 1;
    S.cursor = D.dates.length - 1;
    domain = netDomain();
    hatch = makeHatch();
    $("#synthetic").hidden = !D.synthetic;
    $("#window-text").textContent = `${fmtDate(D.dates[0])} to ${fmtDate(D.dates[D.dates.length - 1])}`;
    initMap();
    initTimeline();
    initControls();
    renderInspector();
    renderLegend();
  })
  .catch((e) => {
    $("#inspector").innerHTML = `<h2>The data didn't load</h2><p>${e.message}</p><p>Put the app files in <code>frontend/public/data/</code>, or run <code>python3 contracts/samples/make_samples.py</code> and copy the samples into <code>frontend/public/samples/</code>.</p>`;
  });

function netDomain() {
  const a = D.grid.net_change_m.filter((v) => v != null).map(Math.abs).sort((x, y) => x - y);
  const p98 = a[Math.floor(a.length * 0.98)] || 0.02;
  return Math.max(0.02, p98);
}

/* ---------------- map ---------------- */
function initMap() {
  const b = D.bbox;
  map = new maplibregl.Map({
    container: "map",
    attributionControl: { compact: true },
    style: {
      version: 8,
      sources: {
        base: {
          type: "raster",
          tiles: ["https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png", "https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors © CARTO",
        },
        labels: {
          type: "raster",
          tiles: ["https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png"],
          tileSize: 256,
        },
      },
      layers: [
        { id: "base", type: "raster", source: "base", paint: { "raster-saturation": -0.7, "raster-contrast": -0.1 } },
      ],
    },
    bounds: [[b.west, b.south], [b.east, b.north]],
    fitBoundsOptions: { padding: 24 },
    maxBounds: [[b.west - 1.5, b.south - 1.2], [b.east + 1.5, b.north + 1.2]],
    dragRotate: false,
    pitchWithRotate: false,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

  map.on("load", () => {
    const coords = [[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south]];
    map.addSource("grid", { type: "image", coordinates: coords });
    map.addLayer({ id: "grid", type: "raster", source: "grid", paint: { "raster-opacity": 0.86, "raster-resampling": "nearest", "raster-fade-duration": 0 } });
    map.addLayer({ id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.8 } });
    map.addSource("sel", { type: "geojson", data: emptyFC() });
    map.addLayer({ id: "sel", type: "line", source: "sel", paint: { "line-color": "#1F2622", "line-width": 2 } });
    map.addSource("frame", { type: "geojson", data: { type: "Feature", geometry: { type: "Polygon", coordinates: [[...coords, coords[0]]] } } });
    map.addLayer({ id: "frame", type: "line", source: "frame", paint: { "line-color": "#8B5E34", "line-width": 1, "line-dasharray": [3, 2] } });
    map.addSource("pin", { type: "geojson", data: emptyFC() });
    map.addLayer({ id: "pin", type: "line", source: "pin", paint: { "line-color": "#1F2622", "line-width": 2, "line-dasharray": [2, 1.5] } });
    map.addSource("relief", { type: "geojson", data: emptyFC() });
    map.addLayer({ id: "relief", type: "fill-extrusion", source: "relief", layout: { visibility: "none" },
      paint: { "fill-extrusion-color": ["get", "c"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": 0, "fill-extrusion-opacity": 0.95 } });
    map.addSource("prof", { type: "geojson", data: emptyFC() });
    map.addLayer({ id: "prof-casing", type: "line", source: "prof", paint: { "line-color": "#E9ECE4", "line-width": 6 } });
    map.addLayer({ id: "prof", type: "line", source: "prof", paint: { "line-color": "#1F2622", "line-width": 2.5 } });
    drawGrid();
    addStations();
    restoreFromHash();
  });

  map.on("click", (e) => {
    if (S.drawing) { profileClick([e.lngLat.lng, e.lngLat.lat]); return; }
    const i = cellAt(D, e.lngLat.lng, e.lngLat.lat);
    if (i < 0) return;
    if (S.awaitPin || ((e.originalEvent.shiftKey || e.originalEvent.altKey) && S.sel >= 0)) { S.awaitPin = false; setPin(i); }
    else select(i);
  });
  map.on("mousemove", (e) => {
    const i = cellAt(D, e.lngLat.lng, e.lngLat.lat);
    map.getCanvas().style.cursor = i >= 0 ? "crosshair" : "";
    hoverReadout(i, e.point);
  });
  map.on("mouseout", () => hoverReadout(-1));
}

const emptyFC = () => ({ type: "FeatureCollection", features: [] });

function makeHatch() {
  const c = document.createElement("canvas");
  c.width = c.height = PX;
  const x = c.getContext("2d");
  x.strokeStyle = "rgba(31,38,34,0.45)";
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(0, PX); x.lineTo(PX, 0);
  x.stroke();
  return c;
}

function cellValue(i) {
  switch (S.mode) {
    case "net": return D.grid.net_change_m[i];
    case "pair": return pairDiff(D, i, S.k1, S.k2);
    case "breathe": return D.values[i]?.[S.cursor] ?? null;
    default: return null;
  }
}

function drawGrid() {
  if (!map?.getSource("grid")) return;
  const g = D.meta.grid;
  const c = document.createElement("canvas");
  c.width = g.ncols * PX;
  c.height = g.nrows * PX;
  const x = c.getContext("2d");
  const img = x.createImageData(c.width, c.height);
  const hatchCells = [];
  for (let i = 0; i < D.n; i++) {
    let col = null;
    if (S.mode === "labels") {
      const L = D.grid.label[i];
      col = LABEL_COLORS[L] || null;
    } else {
      const v = cellValue(i);
      if (v != null) col = diverging(v, domain);
    }
    if (!col) {
      if (D.grid.n_valid_dates[i] > 0 || D.grid.label[i] === 0) hatchCells.push(i);
      continue;
    }
    const r0 = Math.floor(i / g.ncols) * PX, c0 = (i % g.ncols) * PX;
    for (let dy = 0; dy < PX; dy++) {
      let o = ((r0 + dy) * c.width + c0) * 4;
      for (let dx = 0; dx < PX; dx++, o += 4) {
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
  }
  x.putImageData(img, 0, 0);
  hatchCells.forEach((i) => x.drawImage(hatch, (i % g.ncols) * PX, Math.floor(i / g.ncols) * PX));
  map.getSource("grid").updateImage({ image: c });
  if (S.relief) updateRelief();
}

/* ---------------- 3D relief ---------------- */
let reliefFeatures = null;
const RELIEF_H = 5000; // metres of map height across the full color range
function updateRelief() {
  const g = D.meta.grid;
  if (!reliefFeatures) {
    reliefFeatures = [];
    for (let i = 0; i < D.n; i++) {
      const b = cellBounds(D, i);
      reliefFeatures.push({ type: "Feature", id: i, properties: { h: 0, c: "#000" },
        geometry: { type: "Polygon", coordinates: [[[b.w, b.n], [b.e, b.n], [b.e, b.s], [b.w, b.s], [b.w, b.n]]] } });
    }
  }
  const feats = [];
  for (let i = 0; i < D.n; i++) {
    const v = S.mode === "labels" ? D.grid.net_change_m[i] : cellValue(i);
    if (v == null) continue;
    const f = reliefFeatures[i];
    const t = Math.max(0, Math.min(1, (v + domain) / (2 * domain)));
    f.properties.h = 60 + t * RELIEF_H;
    f.properties.c = rgb(S.mode === "labels" && LABEL_COLORS[D.grid.label[i]] ? LABEL_COLORS[D.grid.label[i]] : diverging(v, domain));
    feats.push(f);
  }
  map.getSource("relief").setData({ type: "FeatureCollection", features: feats });
}
function setRelief(on) {
  S.relief = on;
  $("#relief-btn").setAttribute("aria-pressed", on);
  map.setLayoutProperty("relief", "visibility", on ? "visible" : "none");
  map.setPaintProperty("grid", "raster-opacity", on ? 0 : 0.86);
  if (on) { map.dragRotate.enable(); updateRelief(); map.easeTo({ pitch: 58, bearing: -18, duration: reduceMotion ? 0 : 1300 }); }
  else { map.dragRotate.disable(); map.easeTo({ pitch: 0, bearing: 0, duration: reduceMotion ? 0 : 900 }); }
  renderLegend();
  writeHash(S);
}

/* ---------------- profile (cross-section) ---------------- */
let profMarkers = [];
function startProfile() {
  S.drawing = true;
  S.profile = null;
  clearProfileMarkers();
  map.getSource("prof").setData(emptyFC());
  $("#profile-btn").setAttribute("aria-pressed", "true");
  map.getCanvas().style.cursor = "crosshair";
  showProfilePanel(`<p class="prof-hint">Click two points on the map to draw a line. A canal, a road, a levee: anything you want to see in cross-section.</p>`);
}
function profileClick(ll) {
  if (!S.profile) { S.profile = { a: ll }; addProfMarker("a", ll); return; }
  S.profile.b = ll;
  addProfMarker("b", ll);
  S.drawing = false;
  renderProfile();
}
function addProfMarker(key, ll) {
  const el = document.createElement("div");
  el.className = "profend";
  el.textContent = key === "a" ? "1" : "2";
  const m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(ll).addTo(map);
  m.on("drag", () => { const p = m.getLngLat(); S.profile[key] = [p.lng, p.lat]; if (S.profile.b) renderProfile(); });
  profMarkers.push(m);
}
function clearProfileMarkers() { profMarkers.forEach((m) => m.remove()); profMarkers = []; }
function closeProfile() {
  S.drawing = false; S.profile = null;
  clearProfileMarkers();
  map.getSource("prof")?.setData(emptyFC());
  $("#profile-btn").setAttribute("aria-pressed", "false");
  $("#profile").hidden = true;
  $(".mapwrap").classList.remove("has-profile");
  writeHash(S);
}
function showProfilePanel(html) {
  $("#profile").hidden = false;
  $(".mapwrap").classList.add("has-profile");
  $("#profile-body").innerHTML = html;
}
let profDot;
function renderProfile() {
  const P = S.profile;
  if (!P?.b) return;
  map.getSource("prof").setData({ type: "Feature", geometry: { type: "LineString", coordinates: [P.a, P.b] } });
  const valueAt = (lng, lat) => {
    const i = cellAt(D, lng, lat);
    if (i < 0) return null;
    return S.mode === "labels" ? D.grid.net_change_m[i] : cellValue(i);
  };
  const smp = sampleLine(P.a, P.b, D.meta.grid.step_deg, valueAt);
  const title = { net: "change over the whole record", pair: `change from ${fmtShort(D.dates[S.k1])} to ${fmtShort(D.dates[S.k2])}`, breathe: `change up to ${fmtShort(D.dates[S.cursor])}`, labels: "change over the whole record" }[S.mode];
  showProfilePanel(`<div class="prof-head"><h3>Cross-section, ${smp.L.toFixed(1)} km: ${title}</h3><p id="prof-read" class="muted">Point along the profile to find that spot on the map. Drag the numbered ends to move the line.</p></div>${profileSVG(smp, "Ground motion along the drawn line")}`);
  const svg = $("#profile .profsvg");
  if (!svg) return;
  svg.onmousemove = (e) => {
    const f = profileHitFrac(e, svg);
    const r = profileReadout(smp, f);
    $("#prof-read").textContent = r.text;
    const cur = $("#prof-cursor");
    cur.setAttribute("x1", profileX(f)); cur.setAttribute("x2", profileX(f)); cur.setAttribute("visibility", "visible");
    if (!profDot) { const el = document.createElement("div"); el.className = "profdot"; profDot = new maplibregl.Marker({ element: el }).setLngLat(r.p.p).addTo(map); }
    else profDot.setLngLat(r.p.p);
  };
  svg.onmouseleave = () => { profDot?.remove(); profDot = null; $("#prof-cursor")?.setAttribute("visibility", "hidden"); };
  svg.onclick = (e) => { const r = profileReadout(smp, profileHitFrac(e, svg)); const i = cellAt(D, ...r.p.p); if (i >= 0) select(i); };
  writeHash(S);
}

let markers = [];
function addStations() {
  markers.forEach((m) => m.remove());
  markers = D.stations.map((st) => {
    const el = document.createElement("button");
    el.className = `station ${st.role}`;
    el.setAttribute("aria-label", `GPS station ${st.station}${st.role === "reference" ? ", reference" : ""}`);
    el.innerHTML = `<span class="pin"></span><span class="sid">${st.station}</span>`;
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      S.gps = true;
      $("#gps-toggle").checked = true;
      select(st.cell_index);
    });
    return new maplibregl.Marker({ element: el, anchor: "left" }).setLngLat([st.lon, st.lat]).addTo(map);
  });
  syncStations();
}
function syncStations() {
  document.querySelectorAll(".station").forEach((el) => el.classList.toggle("dim", !S.gps));
}

let hoverEl;
function hoverReadout(i, pt) {
  if (!hoverEl) {
    hoverEl = document.createElement("div");
    hoverEl.className = "hover";
    $(".mapwrap").appendChild(hoverEl);
  }
  if (i < 0 || !pt) { hoverEl.hidden = true; return; }
  let text;
  if (S.mode === "labels") text = D.meta.labels[String(D.grid.label[i])];
  else {
    const v = cellValue(i);
    text = v == null ? "No measurement here" : cm(v);
  }
  const v = D.values[i];
  let spark = "";
  if (v && S.mode !== "labels") {
    const ok = v.filter((x) => x != null);
    if (ok.length > 2) {
      const lo = Math.min(...ok), hi = Math.max(...ok), sp = hi - lo || 1;
      const pts = v.map((x, k) => (x == null ? null : `${((k / (v.length - 1)) * 86 + 2).toFixed(1)},${(2 + (1 - (x - lo) / sp) * 20).toFixed(1)}`)).filter(Boolean).join(" ");
      spark = `<svg viewBox="0 0 90 24" class="spark" aria-hidden="true"><polyline points="${pts}"/></svg>`;
    }
  }
  hoverEl.innerHTML = `<span>${text}</span>${spark}`;
  hoverEl.style.transform = `translate(${pt.x + 14}px, ${pt.y + 12}px)`;
  hoverEl.hidden = false;
}

/* ---------------- selection ---------------- */
function select(i, { fly = false } = {}) {
  S.sel = i;
  const cb = cellBounds(D, i);
  map.getSource("sel")?.setData({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [[[cb.w, cb.n], [cb.e, cb.n], [cb.e, cb.s], [cb.w, cb.s], [cb.w, cb.n]]] },
  });
  if (fly) map.flyTo({ center: [cb.lng, cb.lat], zoom: Math.max(map.getZoom(), 9.6), duration: reduceMotion ? 0 : 1400 });
  if (S.pin === i) setPin(-1, false);
  stopListening(); S.listenK = null;
  renderInspector();
  renderTimeline();
  writeHash(S);
}

function setPin(i, rerender = true) {
  S.pin = i;
  if (i < 0) map.getSource("pin")?.setData(emptyFC());
  else {
    const cb = cellBounds(D, i);
    map.getSource("pin")?.setData({ type: "Feature", geometry: { type: "Polygon", coordinates: [[[cb.w, cb.n], [cb.e, cb.n], [cb.e, cb.s], [cb.w, cb.s], [cb.w, cb.n]]] } });
  }
  if (rerender) { renderInspector(); writeHash(S); }
}
const placeName = (i) => { const st = stationAt(i); const cb = cellBounds(D, i); return st ? `GPS station ${st.station}` : `${cb.lat.toFixed(2)}° N, ${Math.abs(cb.lng).toFixed(2)}° W`; };

const stationAt = (i) => D.stations.find((s) => s.cell_index === i);

/* ---------------- inspector ---------------- */
function renderInspector() {
  const el = $("#inspector");
  if (S.sel < 0) { el.innerHTML = overviewHTML(); drawScatter(); return; }
  const i = S.sel, G = D.grid, cb = cellBounds(D, i);
  const st = stationAt(i);
  const label = D.meta.labels[String(G.label[i])];
  const sig = G.seasonal_significant[i] === true;
  const v = D.values[i];
  const showGps = S.gps && st && st.gps;

  let h = `<div class="ins-head">
    <p class="where">${st ? `GPS station ${st.station}${st.role === "reference" ? " (reference)" : ""}, ` : ""}${cb.lat.toFixed(3)}° N, ${Math.abs(cb.lng).toFixed(3)}° W</p>
    <h2 class="verdict label-${G.label[i]}">${label}</h2>
    <button class="plain clear" id="clear-sel">Back to the overview</button>
  </div>`;

  // rod + key numbers
  h += `<div class="ins-top">
    <div class="rodwrap">${rod({ dates: D.dates, values: v || [], cursor: S.listenK ?? (S.mode === "breathe" ? S.cursor : D.dates.length - 1) })}</div>
    <dl class="nums">
      <div><dt>Change, first to last date</dt><dd class="big">${cm(G.net_change_m[i])}</dd><dd class="unc">${pm(G.net_change_sigma_m[i])}</dd></div>
      <div><dt>Seasonal movement</dt>${sig
        ? `<dd>${mm(G.amp_m[i])} up and down</dd><dd class="unc">${pm(G.amp_sigma_m[i], "mm")}, highest in ${MONTH_NAMES[(G.peak_month[i] || 1) - 1]}</dd>`
        : `<dd class="muted">Not significant here</dd>`}</div>
      <div><dt>Fitted trend</dt><dd>${G.trend_m_per_yr[i] == null ? "no value" : cm(G.trend_m_per_yr[i]) + " a year"}</dd><dd class="unc">${pm(G.trend_sigma_m_per_yr[i])}. Less than a year of data, so never the headline.</dd></div>
    </dl>
  </div>`;

  // chart
  const gps = showGps ? { dates: st.gps.dates.map((s) => new Date(s + "T00:00:00Z")), los: st.gps.los_m } : null;
  const compare = S.pin >= 0 && S.pin !== i ? { values: D.values[S.pin] || [], label: placeName(S.pin) } : null;
  h += `<div class="chartblock">
    <div class="chart-head">
      <h3>Every measurement here</h3>
      <label class="toggle small"><input type="checkbox" id="split" ${S.split ? "checked" : ""}/> Split into trend and seasonal</label>
    </div>
    ${seriesChart({ dates: D.dates, values: v || [], tYears: D.tYears, fit: (t) => fitAt(D, i, t), split: S.split, gps, compare, pair: S.mode === "pair" ? [S.k1, S.k2] : null, cursor: S.listenK ?? (S.mode === "breathe" ? S.cursor : null), seasonalSig: sig })}
    ${chartKey({ split: S.split, gps, seasonalSig: sig, compare })}
    <div class="chart-tools">
      <button class="plain" id="listen">${isListening() ? "Stop" : "Listen to this spot"}</button>
      ${compare ? `<button class="plain" id="unpin">Stop comparing</button>` : `<button class="plain" id="pin-btn">Compare with another spot</button>`}
      <button class="plain" id="csv">Download the numbers</button>
    </div>
    ${S.awaitPin ? `<p class="hintline">Now click another spot on the map to compare it with this one.</p>` : ""}
  </div>`;

  // two dates
  const d12 = pairDiff(D, i, S.k1, S.k2);
  const days = Math.round((D.dates[S.k2] - D.dates[S.k1]) / 864e5);
  const expected = G.trend_m_per_yr[i] == null ? null : G.trend_m_per_yr[i] * (days / 365.25);
  const lie = mostMisleadingPair(D, i);
  h += `<section class="pairblock">
    <h3>Two dates</h3>
    <p>From ${fmtShort(D.dates[S.k1])} to ${fmtShort(D.dates[S.k2])} (${days} days) this spot moved <strong>${cm(d12)}</strong>.
    ${expected != null ? `The fitted trend over the same ${days} days is ${cm(expected)}.` : ""}</p>
    ${lie
      ? `<p>Pick the wrong two dates and this spot looks ${lie.diff >= 0 ? "like it rose" : "stable"}: ${fmtShort(D.dates[lie.k1])} to ${fmtShort(D.dates[lie.k2])} shows ${cm(lie.diff)}, while the trend says ${cm(lie.expected)}.</p>
         <button id="show-lie">Show me those two dates</button>`
      : `<p class="muted">No two dates here hide the sinking by more than the measurement uncertainty.</p>`}
    <h4>Every pair of dates at this spot</h4>
    ${matrixHTML()}
  </section>`;

  // GPS
  if (st) {
    h += `<section class="gpsblock"><h3>GPS check</h3>`;
    if (!S.gps) h += `<p><button class="plain" id="gps-on">Show GPS on the chart</button></p>`;
    if (st.role === "reference") {
      h += `<p>${st.station} is the reference station. All radar values are tied to it, so it can't check itself.</p>`;
    } else if (st.residuals) {
      const r = st.residuals;
      h += `<table class="resid"><tbody>
        <tr><th scope="row">Radar minus GPS, first to last date</th><td>${cm(r.net_m)}</td></tr>
        <tr><th scope="row">Typical disagreement per pair</th><td>${cm(r.pairs_rms_m).replace(/^[+−]/, "")}</td></tr>
        <tr><th scope="row">Pairs compared</th><td>${r.n_pairs}</td></tr>
      </tbody></table>
      <p class="muted">${st.station} was never used to calibrate the radar.${r.unwrap_flagged_pairs?.length ? ` ${r.unwrap_flagged_pairs.length} pair(s) flagged for unwrapping errors.` : ""}</p>`;
    }
    h += `</section>`;
  }

  // receipt
  const pairs = D.meta.pairs || [];
  const used = pairs.filter((p) => p.used_in_fit).length;
  const iono = pairs.every((p) => p.iono_applied);
  h += `<details class="receipt"><summary>How we got these numbers</summary>
    <dl>
      <dt>Satellite product</dt><dd>${D.meta.product}, ${D.meta.product_maturity}. Track ${D.meta.track} ${D.meta.direction}, frame ${D.meta.frame}.</dd>
      <dt>Dates measured here</dt><dd>${G.n_valid_dates[i]} of ${D.dates.length}. Missing dates stay missing.</dd>
      <dt>Pairs in the fit</dt><dd>${used} of ${pairs.length}. Ionosphere corrected on ${iono ? "every pair" : "some pairs only"}.</dd>
      <dt>Reference</dt><dd>GPS station ${D.meta.reference_station}. Held out for checking: ${D.meta.held_out_stations.join(", ")}.</dd>
      <dt>Uncertainty</dt><dd>${pm(D.meta.sigma_net_m)} on the net change, from ${D.meta.sigma_source}.</dd>
      <dt>Seasonal test</dt><dd>${D.meta.significance}.</dd>
      <dt>Model</dt><dd>${D.meta.fit.model}</dd>
      <dt>First and last granule</dt><dd class="gran">${pairs[0]?.granule_id ?? "?"}<br/>${pairs[pairs.length - 1]?.granule_id ?? "?"}</dd>
    </dl></details>`;

  const keep = renderInspector.last === i ? el.scrollTop : 0;
  el.innerHTML = h;
  el.scrollTop = keep;
  renderInspector.last = i;
  const nLie = drawMatrix(D, i, [S.k1, S.k2], (a, b) => { S.k1 = a; S.k2 = b; setMode("pair"); });
  if (nLie != null) $("#matrix-read").insertAdjacentHTML("beforebegin", `<p class="matrix-note">${nLie ? `Outlined squares (${nLie}) are pairs that make this spot look stable or rising while the trend says it sank.` : "No pair here hides the sinking."} The red square is the pair on the map now.</p>`);
  $("#listen").onclick = () => {
    if (isListening()) { stopListening(); S.listenK = null; renderInspector(); return; }
    listen(v || [], { onStep: (k) => { S.listenK = k; renderInspector(); }, onEnd: () => { S.listenK = null; renderInspector(); } });
    renderInspector();
  };
  $("#csv").onclick = () => downloadCSV(D, i, (t) => fitAt(D, i, t), st);
  const pb = $("#pin-btn");
  if (pb) pb.onclick = () => { S.awaitPin = true; renderInspector(); };
  const up = $("#unpin");
  if (up) up.onclick = () => setPin(-1);
  $("#clear-sel").onclick = () => { S.sel = -1; map.getSource("sel").setData(emptyFC()); renderInspector(); renderTimeline(); };
  $("#split").onchange = (e) => { S.split = e.target.checked; renderInspector(); };
  const g = $("#gps-on");
  if (g) g.onclick = () => { S.gps = true; $("#gps-toggle").checked = true; syncStations(); renderInspector(); };
  const sl = $("#show-lie");
  if (sl) sl.onclick = () => { S.k1 = lie.k1; S.k2 = lie.k2; setMode("pair"); };
}

function overviewHTML() {
  const L = D.grid.label;
  const counts = [0, 0, 0, 0];
  L.forEach((v) => counts[v]++);
  const total = L.length;
  const pct = (k) => Math.round((counts[k] / total) * 100);
  return `<div class="overview">
    <h2>The valley rises and falls with the seasons. Underneath, parts of it keep sinking.</h2>
    <p>Groundwater pumping lowers the water pressure underground, and the ground settles. Some of
    that comes back when the water returns each winter, and some doesn't. Compare the wrong two dates
    and sinking ground can look stable.</p>
    <p>Click anywhere on the map, or a GPS station, to see every measurement at that spot and how sure we are.</p>
    <h3>Seasonal size against trend, every location</h3>
    <canvas id="scatter" width="760" height="420" aria-label="Scatter plot of seasonal movement against fitted trend. Click a dot to open that location."></canvas>
    <p class="chartkey"><span class="k l1"></span>Seasonal movement with persistent sinking (${pct(1)}%)
      <span class="k l2"></span>Seasonal movement, no resolved trend (${pct(2)}%)</p>
    <p class="muted">Only locations where the seasonal cycle is significant are plotted. ${pct(3)}% show
      persistent sinking without a resolved seasonal cycle; ${pct(0)}% are insufficient evidence.</p>
  </div>`;
}

let scatterPts = [];
function drawScatter() {
  const c = $("#scatter");
  if (!c) return;
  const x = c.getContext("2d");
  const W = c.width, H = c.height, P = { l: 70, r: 16, t: 14, b: 54 };
  const G = D.grid;
  const pts = [];
  for (let i = 0; i < D.n; i++) {
    if (G.seasonal_significant[i] !== true || G.amp_m[i] == null || G.trend_m_per_yr[i] == null) continue;
    pts.push({ i, tx: G.trend_m_per_yr[i] * 100, ay: G.amp_m[i] * 1000, L: G.label[i] });
  }
  x.clearRect(0, 0, W, H);
  if (!pts.length) { x.fillStyle = "#1F2622"; x.font = "26px Barlow"; x.fillText("No significant seasonal cycle anywhere.", P.l, H / 2); return; }
  const xmin = Math.min(0, ...pts.map((p) => p.tx)), xmax = Math.max(0.5, ...pts.map((p) => p.tx));
  const ymax = Math.max(...pts.map((p) => p.ay)) * 1.1;
  const X = (v) => P.l + ((v - xmin) / (xmax - xmin)) * (W - P.l - P.r);
  const Y = (v) => H - P.b - (v / ymax) * (H - P.t - P.b);
  x.strokeStyle = "rgba(31,38,34,0.25)"; x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(X(0), P.t); x.lineTo(X(0), H - P.b); x.moveTo(P.l, H - P.b); x.lineTo(W - P.r, H - P.b); x.stroke();
  x.fillStyle = "#1F2622"; x.font = "22px Barlow";
  x.textAlign = "center"; x.fillText("Fitted trend, cm a year (sinking to the left)", (P.l + W - P.r) / 2, H - 12);
  x.save(); x.translate(22, (P.t + H - P.b) / 2); x.rotate(-Math.PI / 2); x.fillText("Seasonal size, mm", 0, 0); x.restore();
  x.textAlign = "right"; x.fillText(xmin.toFixed(0), X(xmin) + 10, H - P.b + 24);
  x.textAlign = "left"; x.fillText("0", X(0) - 6, H - P.b + 24);
  scatterPts = pts.map((p) => ({ ...p, X: X(p.tx), Y: Y(p.ay) }));
  scatterPts.forEach((p) => {
    x.fillStyle = rgb(LABEL_COLORS[p.L] || [120, 120, 120]);
    x.globalAlpha = 0.55;
    x.beginPath(); x.arc(p.X, p.Y, 3.2, 0, 7); x.fill();
  });
  x.globalAlpha = 1;
  c.onclick = (e) => {
    const r = c.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * W, my = ((e.clientY - r.top) / r.height) * H;
    let best = null, bd = 400;
    scatterPts.forEach((p) => { const d = (p.X - mx) ** 2 + (p.Y - my) ** 2; if (d < bd) { bd = d; best = p; } });
    if (best) select(best.i, { fly: true });
  };
}

/* ---------------- timeline ---------------- */
function tFrac(k) {
  const a = +D.dates[0], b = +D.dates[D.dates.length - 1];
  return (+D.dates[k] - a) / (b - a);
}

function initTimeline() {
  const tl = $("#tl");
  tl.addEventListener("pointerdown", (e) => {
    tl.setPointerCapture(e.pointerId);
    const k = nearestDate(e);
    if (S.mode === "pair") {
      S.drag = Math.abs(k - S.k1) <= Math.abs(k - S.k2) ? "k1" : "k2";
      setPairEnd(S.drag, k);
    } else {
      stop();
      if (S.mode !== "breathe") setMode("breathe", { keepCursor: true });
      S.cursor = k; update();
    }
  });
  tl.addEventListener("pointermove", (e) => {
    if (!tl.hasPointerCapture(e.pointerId)) return;
    const k = nearestDate(e);
    if (S.mode === "pair" && S.drag) setPairEnd(S.drag, k);
    else if (S.mode === "breathe" && S.cursor !== k) { S.cursor = k; update(); }
  });
  tl.addEventListener("pointerup", () => (S.drag = null));
  renderTimeline();
}

function nearestDate(e) {
  const r = $("#tl").getBoundingClientRect();
  const f = (e.clientX - r.left - 16) / (r.width - 32);
  let best = 0, bd = 9;
  D.dates.forEach((_, k) => { const d = Math.abs(tFrac(k) - f); if (d < bd) { bd = d; best = k; } });
  return best;
}

function setPairEnd(which, k) {
  if (which === "k1") S.k1 = Math.min(k, S.k2 - 1);
  else S.k2 = Math.max(k, S.k1 + 1);
  update();
}

function renderTimeline() {
  const tl = $("#tl");
  const v = S.sel >= 0 ? D.values[S.sel] : null;
  // trace of the selected point behind the ticks, like a chart recorder
  let trace = "";
  if (v) {
    const ok = v.filter((x) => x != null);
    const lo = Math.min(0, ...ok), hi = Math.max(0, ...ok), span = hi - lo || 1;
    const pts = v.map((x, k) => (x == null ? null : `${(tFrac(k) * 1000).toFixed(1)},${(8 + (1 - (x - lo) / span) * 44).toFixed(1)}`)).filter(Boolean).join(" ");
    trace = `<svg class="trace" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>`;
  }
  let ticks = "";
  let lastM = -1;
  D.dates.forEach((d, k) => {
    const left = `calc(16px + (100% - 32px) * ${tFrac(k).toFixed(4)})`;
    const inPair = S.mode === "pair" && k >= S.k1 && k <= S.k2;
    ticks += `<button class="tick${inPair ? " in" : ""}${S.mode === "breathe" && k === S.cursor ? " now" : ""}" style="left:${left}" data-k="${k}" tabindex="-1" aria-label="${fmtDate(d)}"></button>`;
    if (d.getUTCMonth() !== lastM) {
      ticks += `<span class="mlab" style="left:${left}">${fmtShort(d).split(" ")[1]}${d.getUTCMonth() === 0 ? " " + d.getUTCFullYear() : ""}</span>`;
      lastM = d.getUTCMonth();
    }
  });
  let handles = "";
  if (S.mode === "pair") {
    for (const [key, name] of [["k1", "A"], ["k2", "B"]]) {
      handles += `<span class="handle" style="left:calc(16px + (100% - 32px) * ${tFrac(S[key]).toFixed(4)})" tabindex="0" role="slider" data-h="${key}"
        aria-label="Date ${name}" aria-valuemin="0" aria-valuemax="${D.dates.length - 1}" aria-valuenow="${S[key]}" aria-valuetext="${fmtDate(D.dates[S[key]])}">${name}</span>`;
    }
  }
  tl.innerHTML = trace + ticks + handles;
  tl.querySelectorAll(".handle").forEach((hd) => {
    hd.onkeydown = (e) => {
      const key = hd.dataset.h, d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      setPairEnd(key, S[key] + d);
      $(`.handle[data-h="${key}"]`)?.focus();
    };
  });

  const r = $("#tl-readout");
  if (S.mode === "pair") {
    const days = Math.round((D.dates[S.k2] - D.dates[S.k1]) / 864e5);
    r.textContent = `Comparing ${fmtDate(D.dates[S.k1])} with ${fmtDate(D.dates[S.k2])}, ${days} days apart. Drag A or B.`;
  } else if (S.mode === "breathe") {
    r.textContent = `${fmtDate(D.dates[S.cursor])}: ground position compared with ${fmtShort(D.dates[0])}.`;
  } else {
    r.textContent = `${D.dates.length} radar passes. Press Play to watch the valley move, or click a date.`;
  }
  $("#play").textContent = S.playing ? "Pause" : "Play";
  $("#play").setAttribute("aria-pressed", S.playing);
}

/* ---------------- modes, playback ---------------- */
function setMode(m, { keepCursor = false } = {}) {
  if (m !== "breathe") stop();
  S.mode = m;
  if (m === "breathe" && !keepCursor) S.cursor = 0;
  document.querySelectorAll(".mode").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === m));
  update();
}

function update() {
  drawGrid();
  renderLegend();
  renderTimeline();
  if (S.sel >= 0) renderInspector();
  if (S.profile?.b) renderProfile();
  if (!S.playing) writeHash(S);
}

function restoreFromHash() {
  const h = readHash();
  const N = D.dates.length;
  const int = (x, lo, hi) => { const n = parseInt(x, 10); return isNaN(n) ? null : Math.max(lo, Math.min(hi, n)); };
  if (h.a != null) S.k1 = int(h.a, 0, N - 2);
  if (h.b != null) S.k2 = Math.max(S.k1 + 1, int(h.b, 1, N - 1));
  if (h.t != null) S.cursor = int(h.t, 0, N - 1);
  if (h.gps === "1") { S.gps = true; $("#gps-toggle").checked = true; syncStations(); }
  if (h.cell) select(int(h.cell, 0, D.n - 1));
  if (h.pin) setPin(int(h.pin, 0, D.n - 1));
  if (["net", "pair", "breathe", "labels"].includes(h.mode)) setMode(h.mode, { keepCursor: true });
  if (h.prof) {
    const q = h.prof.split(",").map(Number);
    if (q.length === 4 && q.every(isFinite)) { S.profile = { a: [q[0], q[1]] }; addProfMarker("a", S.profile.a); S.profile.b = [q[2], q[3]]; addProfMarker("b", S.profile.b); $("#profile-btn").setAttribute("aria-pressed", "true"); renderProfile(); }
  }
  if (h.relief === "1") setRelief(true);
}

let timer;
function play() {
  if (S.mode !== "breathe") setMode("breathe");
  if (S.cursor >= D.dates.length - 1) S.cursor = 0;
  S.playing = true;
  const stepMs = reduceMotion ? 900 : 380;
  timer = setInterval(() => {
    if (S.cursor >= D.dates.length - 1) { stop(); return; }
    S.cursor++;
    update();
  }, stepMs);
  renderTimeline();
}
function stop() {
  clearInterval(timer);
  S.playing = false;
  if ($("#play")) renderTimelineButtonOnly();
}
function renderTimelineButtonOnly() {
  $("#play").textContent = "Play";
  $("#play").setAttribute("aria-pressed", "false");
}

/* ---------------- legend ---------------- */
function renderLegend() {
  const ref = D.meta.reference_station;
  const prov = D.synthetic ? "synthetic data" : `${D.meta.product_maturity} NISAR data`;
  let h = "";
  if (S.mode === "labels") {
    h += `<h3>What we can say at each spot</h3><ul class="swatches">`;
    for (const k of ["1", "2", "3"]) h += `<li><span class="sw" style="background:${rgb(LABEL_COLORS[k])}"></span>${D.meta.labels[k]}</li>`;
    h += `<li><span class="sw hatch"></span>${D.meta.labels["0"]}</li></ul>`;
  } else {
    const title = { net: `Change from ${fmtShort(D.dates[0])} to ${fmtShort(D.dates[D.dates.length - 1])}`, pair: `Change from ${fmtShort(D.dates[S.k1])} to ${fmtShort(D.dates[S.k2])}`, breathe: `Change from ${fmtShort(D.dates[0])} to ${fmtShort(D.dates[S.cursor])}` }[S.mode];
    h += `<h3>${title}</h3>
      <div class="ramp" style="background:${legendGradient()}"></div>
      <div class="ramp-ends"><span>${cm(-domain, 0)} sinking</span><span>0</span><span>${cm(domain, 0)} rising</span></div>
      <p class="hatchnote"><span class="sw hatch"></span>No reliable measurement</p>`;
    if (S.mode !== "net") h += `<p class="note">Same color scale in every view, so two views can be compared directly.</p>`;
  }
  if (S.relief) h += `<p class="note">3D: height shows the same values as the colors, hugely exaggerated (1 cm of motion ≈ ${Math.round(RELIEF_H / (2 * domain * 100))} m of height). Right-drag or two-finger drag to tilt.</p>`;
  h += `<p class="note">Along the radar's line of sight, relative to GPS station ${ref}. ${prov[0].toUpperCase() + prov.slice(1)}.</p>`;
  $("#legend").innerHTML = h;
}

/* ---------------- controls ---------------- */
function initControls() {
  document.querySelectorAll(".mode").forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  $("#play").onclick = () => (S.playing ? stop() : play());
  $("#gps-toggle").onchange = (e) => { S.gps = e.target.checked; syncStations(); renderInspector(); };
  const dlg = $("#limits");
  $("#limits-body").innerHTML = LIMITS_HTML;
  dlg.querySelector("[data-ref]").textContent = D.meta.reference_station;
  dlg.querySelector("[data-held]").textContent = D.meta.held_out_stations.join(", ");
  $("#limits-btn").onclick = () => dlg.showModal();
  $("#tour-btn").onclick = () => tourGo(0);
  $("#tour-prev").onclick = () => tourGo(S.tour - 1);
  $("#tour-next").onclick = () => (S.tour >= TOUR.length - 1 ? tourEnd() : tourGo(S.tour + 1));
  $("#tour-close").onclick = tourEnd;
  $("#relief-btn").onclick = () => setRelief(!S.relief);
  $("#profile-btn").onclick = () => (S.drawing || S.profile ? closeProfile() : startProfile());
  $("#profile-close").onclick = closeProfile;
  $("#share-btn").onclick = async () => {
    writeHash(S);
    try { await navigator.clipboard.writeText(location.href); flash("Link copied. It opens this exact view."); }
    catch { flash("Copy the address bar to share this exact view."); }
  };
  // go to
  const go = $("#goto");
  go.innerHTML = `<option value="">Go to…</option>` + PLACES.map((p, k) => `<option value="p${k}">${p.name}</option>`).join("") +
    D.stations.map((st) => `<option value="s${st.station}">GPS ${st.station}${st.role === "reference" ? " (reference)" : ""}</option>`).join("");
  go.onchange = () => {
    const v = go.value; go.value = "";
    if (v[0] === "p") { const p = PLACES[+v.slice(1)]; map.flyTo({ center: p.ll, zoom: p.z, duration: reduceMotion ? 0 : 1400 }); if (!p.noSelect) { const i = cellAt(D, ...p.ll); if (i >= 0) select(i); } }
    if (v[0] === "s") { const st = D.stations.find((x) => x.station === v.slice(1)); select(st.cell_index, { fly: true }); }
  };
  document.addEventListener("keydown", (e) => {
    const typing = /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.target.getAttribute("role") === "slider";
    if (e.key === "Escape") { if (S.tour >= 0) tourEnd(); else if (S.drawing || S.profile) closeProfile(); else if (S.awaitPin) { S.awaitPin = false; renderInspector(); } }
    if (typing || e.metaKey || e.ctrlKey) return;
    const k = e.key.toLowerCase();
    if (k === " ") { e.preventDefault(); S.playing ? stop() : play(); }
    else if (["1", "2", "3", "4"].includes(k)) setMode(["net", "pair", "breathe", "labels"][+k - 1]);
    else if (k === "g") { $("#gps-toggle").click(); }
    else if (k === "d") setRelief(!S.relief);
    else if (k === "p") $("#profile-btn").click();
    else if (k === "w") tourGo(0);
    else if ((k === "arrowright" || k === "arrowleft") && S.mode !== "pair") {
      stop(); if (S.mode !== "breathe") setMode("breathe", { keepCursor: true });
      S.cursor = Math.max(0, Math.min(D.dates.length - 1, S.cursor + (k === "arrowright" ? 1 : -1))); update();
    }
  });
}

const PLACES = [
  { name: "Corcoran", ll: [-119.56, 36.098], z: 10.5 },
  { name: "Mendota", ll: [-120.381, 36.754], z: 10.5 },
  { name: "Whole study area", ll: [-120.0, 36.45], z: 8.4, noSelect: true },
];

let flashT;
function flash(msg) {
  let el = $("#flash");
  if (!el) { el = document.createElement("div"); el.id = "flash"; el.className = "flash"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(flashT); flashT = setTimeout(() => (el.hidden = true), 2600);
}

/* ---------------- guided walkthrough ---------------- */
const api = {
  get D() { return D; },
  S,
  select: (i, o) => select(i, o),
  setMode,
  play,
  stop,
  setGps: (on) => { S.gps = on; $("#gps-toggle").checked = on; syncStations(); },
  setSplit: (on) => { S.split = on; },
  flyTo: (lng, lat, zoom) => map.flyTo({ center: [lng, lat], zoom, duration: reduceMotion ? 0 : 1600 }),
  fitAll: () => { const b = D.bbox; map.fitBounds([[b.west, b.south], [b.east, b.north]], { padding: 24, duration: reduceMotion ? 0 : 1200 }); },
  mostMisleadingPair: (i) => mostMisleadingPair(D, i),
  render: () => { renderInspector(); update(); },
  setRelief: (on) => S.relief !== on && setRelief(on),
  fmtShort, cm,
};

function tourGo(k) {
  if (k < 0 || k >= TOUR.length) return;
  S.tour = k;
  const step = TOUR[k];
  $("#tour").hidden = false;
  $("#tour-step").textContent = `Step ${k + 1} of ${TOUR.length}`;
  $("#tour-title").textContent = step.title;
  $("#tour-body").innerHTML = step.run(api);
  $("#tour-prev").disabled = k === 0;
  $("#tour-next").textContent = k === TOUR.length - 1 ? "Explore on your own" : "Next";
  $("#tour-next").focus();
}
function tourEnd() {
  S.tour = -1;
  $("#tour").hidden = true;
  stop();
}
