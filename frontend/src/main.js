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
    drawGrid();
    addStations();
  });

  map.on("click", (e) => {
    const i = cellAt(D, e.lngLat.lng, e.lngLat.lat);
    if (i >= 0) select(i);
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
  hoverEl.textContent = text;
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
  renderInspector();
  renderTimeline();
}

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
    <div class="rodwrap">${rod({ dates: D.dates, values: v || [], cursor: S.mode === "breathe" ? S.cursor : D.dates.length - 1 })}</div>
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
  h += `<div class="chartblock">
    <div class="chart-head">
      <h3>Every measurement here</h3>
      <label class="toggle small"><input type="checkbox" id="split" ${S.split ? "checked" : ""}/> Split into trend and seasonal</label>
    </div>
    ${seriesChart({ dates: D.dates, values: v || [], tYears: D.tYears, fit: (t) => fitAt(D, i, t), split: S.split, gps, pair: S.mode === "pair" ? [S.k1, S.k2] : null, cursor: S.mode === "breathe" ? S.cursor : null, seasonalSig: sig })}
    ${chartKey({ split: S.split, gps, seasonalSig: sig })}
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

  el.innerHTML = h;
  el.scrollTop = 0;
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
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && S.tour >= 0) tourEnd();
    if (e.key === " " && e.target === document.body) { e.preventDefault(); S.playing ? stop() : play(); }
  });
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
