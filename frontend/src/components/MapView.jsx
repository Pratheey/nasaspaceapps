import { CROP_COLORS, loadRadar } from "../lib/radar.js";
import { motionPatterns, PATTERN_COLORS } from "../lib/patterns.js";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { fmtShort } from "../lib/fmt.js";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { cellAt, cellBounds } from "../lib/data.js";
import { diverging, fringe, LABEL_COLORS, rgb } from "../lib/colors.js";
import { cellValue } from "../lib/view.js";

maplibregl.setWorkerUrl(workerUrl);
const PX = 6;
export const RELIEF_H = 5000; // metres of map height across the full color range
const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const emptyFC = () => ({ type: "FeatureCollection", features: [] });
const box = (b) => ({ type: "Feature", geometry: { type: "Polygon", coordinates: [[[b.w, b.n], [b.e, b.n], [b.e, b.s], [b.w, b.s], [b.w, b.n]]] } });
const BASEMAP = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: { basemap: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#161514" } },
    { id: "water", type: "fill", source: "basemap", "source-layer": "water", paint: { "fill-color": "#1E3340" } },
    { id: "waterway", type: "line", source: "basemap", "source-layer": "waterway", paint: { "line-color": "#2C4E5E", "line-width": 1.2 } },
    {
      id: "roads", type: "line", source: "basemap", "source-layer": "transportation",
      filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary", "minor"]]],
      paint: { "line-color": "#3F3C37", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.7, 14, 2.2] },
    },
    {
      id: "places", type: "symbol", source: "basemap", "source-layer": "place",
      filter: ["in", ["get", "class"], ["literal", ["city", "town", "village"]]],
      layout: {
        visibility: "none", // the app draws its own town labels (TOWNS), which work without the tile server
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 13, 15],
      },
      paint: { "text-color": "#CFCBC2", "text-halo-color": "#161514", "text-halo-width": 1.5 },
    },
  ],
};
// Start from a style that needs nothing from the network, so the map always loads (the artifact host
// and some school networks block tile servers). The street basemap is added afterwards if it answers.
const OFFLINE = {
  version: 8,
  sources: {},
  layers: [BASEMAP.layers[0], { id: "places", type: "background", paint: { "background-opacity": 0 } }],
};
function addStreetBasemap(m) {
  m.addSource("basemap", BASEMAP.sources.basemap);
  for (const l of BASEMAP.layers.slice(1)) if (l.id !== "places") m.addLayer(l, "ctx-counties");
}
const cartoKey = import.meta.env.VITE_CARTO_BASEMAP_API_KEY?.trim();
function cartoStyle(key) {
  const tiles = (style) => [`https://basemaps.cartocdn.com/${style}/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}`];
  return {
    version: 8,
    sources: {
      basemap: { type: "raster", tileSize: 256, tiles: tiles("dark_nolabels"),
        attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>, <a href="https://carto.com/attributions">© CARTO</a>' },
      labels: { type: "raster", tileSize: 256, tiles: tiles("dark_only_labels") },
    },
    layers: [
      BASEMAP.layers[0],
      { id: "base", type: "raster", source: "basemap", paint: { "raster-saturation": -0.4, "raster-brightness-max": 0.85 } },
      { id: "places", type: "raster", source: "labels", paint: { "raster-opacity": 0.75 } },
    ],
  };
}

/** The map. Imperative inside (MapLibre), declarative outside (props in, events out). */
const MapView = forwardRef(function MapView({ D, S, domain, onCell, onProfilePoint, onProfileDrag, onHover, onStation, onSwipe, onField }, ref) {
  const [, setTick] = useState(0); // re-render the swipe handle when the camera moves
  const [unavailable, setUnavailable] = useState(false);
  const el = useRef(null);
  const map = useRef(null);
  const ready = useRef(false);
  const latest = useRef({ S, onCell, onProfilePoint, onProfileDrag, onHover, onStation, onField });
  latest.current = { S, onCell, onProfilePoint, onProfileDrag, onHover, onStation, onField };
  const reliefFeatures = useRef(null);
  const stationEls = useRef([]);
  const profMarkers = useRef([]);
  const probe = useRef(null);
  const lens = useRef(null);

  // Padding that keeps the whole data frame inside the part of the map nothing is drawn over.
  // The map element already excludes the right-hand panel and the timeline; what overlays it is the toolbar and
  // caption (top), the zoom buttons (right), the legend (bottom-left, large screens) and the walkthrough card (left).
  const fitPadding = (tour = false) => {
    const c = el.current, w = c?.clientWidth || 0, h = c?.clientHeight || 0, lg = window.innerWidth >= 1024;
    const p = { top: 128, right: 64, bottom: 48, left: 24 };
    if (lg && tour) p.left = 420;
    else if (lg && w >= 900) p.left = 340;
    else if (lg) p.bottom = 200;
    if (h && p.top + p.bottom > h * 0.7) { const f = (h * 0.7) / (p.top + p.bottom); p.top = Math.round(p.top * f); p.bottom = Math.round(p.bottom * f); }
    if (w && p.left + p.right > w * 0.7) { const f = (w * 0.7) / (p.left + p.right); p.left = Math.round(p.left * f); p.right = Math.round(p.right * f); }
    return p;
  };

  // Radar lens: a circle under the cursor that shows the fringe view of whatever is there.
  const drawLens = (pt) => {
    const c = lens.current, m = map.current;
    if (!c || !m) return;
    const x = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const Wc = c.clientWidth, Hc = c.clientHeight;
    if (c.width !== Math.round(Wc * dpr) || c.height !== Math.round(Hc * dpr)) {
      c.width = Math.round(Wc * dpr); c.height = Math.round(Hc * dpr);
    }
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, Wc, Hc);
    if (!pt || !latest.current.S.lens || latest.current.S.relief) return;
    const r = 100, g = D.meta.grid, S2 = latest.current.S;
    const nw = m.unproject([pt.x - r, pt.y - r]), se = m.unproject([pt.x + r, pt.y + r]);
    const c0 = Math.max(0, Math.floor((nw.lng - g.lon_min) / g.step_deg)), c1 = Math.min(g.ncols - 1, Math.floor((se.lng - g.lon_min) / g.step_deg));
    const r0 = Math.max(0, Math.floor((g.lat_max - nw.lat) / g.step_deg)), r1 = Math.min(g.nrows - 1, Math.floor((g.lat_max - se.lat) / g.step_deg));
    x.save();
    x.beginPath(); x.arc(pt.x, pt.y, r, 0, 6.283); x.clip();
    x.fillStyle = "rgba(18,17,16,0.92)"; x.fillRect(pt.x - r, pt.y - r, 2 * r, 2 * r);
    for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
      const i = row * g.ncols + col;
      const v = S2.mode === "labels" || S2.mode === "fringe" ? D.grid.net_change_m[i] : cellValue(D, S2, i);
      if (v == null) continue;
      const b = cellBounds(D, i);
      const p1 = m.project([b.w, b.n]), p2 = m.project([b.e, b.s]);
      const f = fringe(v);
      x.fillStyle = `rgb(${f[0]},${f[1]},${f[2]})`;
      x.fillRect(p1.x, p1.y, p2.x - p1.x + 0.6, p2.y - p1.y + 0.6);
    }
    x.restore();
    x.strokeStyle = "#C3D0B3"; x.lineWidth = 2; x.shadowColor = "#9DB08A"; x.shadowBlur = 18;
    x.beginPath(); x.arc(pt.x, pt.y, r, 0, 6.283); x.stroke(); x.shadowBlur = 0;
    x.font = "500 11px 'IBM Plex Mono', monospace"; x.fillStyle = "#C3D0B3"; x.textAlign = "center";
    x.fillText("radar fringes, 11.9 cm per color cycle", pt.x, pt.y + r + 16);
  };

  useImperativeHandle(ref, () => ({
    resize: () => map.current?.resize(),
    flyTo: (ll, zoom, tilted = latest.current.S.relief) => map.current?.flyTo({ center: ll, zoom, pitch: tilted ? 58 : 0, bearing: tilted ? -18 : 0, duration: reduceMotion ? 0 : 1500 }),
    fitAll: (tilted = false, tour = false) => { const b = D.bbox; map.current?.fitBounds([[b.west, b.south], [b.east, b.north]], { padding: fitPadding(tour), pitch: tilted ? 58 : 0, bearing: tilted ? -18 : 0, duration: reduceMotion ? 0 : 1400 }); },
    showProbe: (ll) => {
      if (!map.current) return;
      if (!ll) { probe.current?.remove(); probe.current = null; return; }
      if (!probe.current) {
        const d = document.createElement("div");
        d.className = "w-3 h-3 rounded-full bg-accent ring-2 ring-space shadow-[0_0_12px_#9DB08A]";
        probe.current = new maplibregl.Marker({ element: d }).setLngLat(ll).addTo(map.current);
      } else probe.current.setLngLat(ll);
    },
  }));

  // create once
  useEffect(() => {
    const b = D.bbox;
    ready.current = false;
    let m;
    try {
      m = new maplibregl.Map({
        container: el.current,
        attributionControl: { compact: false },
        style: cartoKey ? cartoStyle(cartoKey) : OFFLINE,
        bounds: [[b.west, b.south], [b.east, b.north]],
        fitBoundsOptions: { padding: fitPadding() },
        maxBounds: [[b.west - 1.6, b.south - 1.3], [b.east + 1.6, b.north + 1.3]],
        dragRotate: false,
        pitchWithRotate: false,
      });
    } catch {
      setUnavailable(true);
      return;
    }
    map.current = m;
    setUnavailable(false);
    m.touchZoomRotate.disableRotation();
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

    m.on("load", () => {
      // Re-measure and fit once more now the layout has settled, unless a shared link picked a cell or the walkthrough is already steering.
      if (latest.current.S.sel < 0 && latest.current.S.tour < 0) { m.resize(); m.fitBounds([[b.west, b.south], [b.east, b.north]], { padding: fitPadding(), duration: 0 }); }
      const coords = [[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south]];
      m.addSource("grid", { type: "image", coordinates: coords });
      m.addLayer({ id: "grid", type: "raster", source: "grid", paint: { "raster-opacity": 0.9, "raster-resampling": "nearest", "raster-fade-duration": 0 } }, "places");
      // Local context that needs no tile server: county lines, the California Aqueduct, towns.
      m.addSource("ctx-counties", { type: "geojson", data: "./context/counties.json" });
      m.addLayer({ id: "ctx-counties", type: "line", source: "ctx-counties", paint: { "line-color": "#ECE9E2", "line-opacity": 0.22, "line-width": 1 } }, "grid");
      if (!cartoKey) { try { addStreetBasemap(m); } catch { /* streets stay off */ } }
      m.addSource("ctx-aqueduct", { type: "geojson", data: "./context/aqueduct.json" });
      m.addLayer({ id: "ctx-aqueduct", type: "line", source: "ctx-aqueduct", paint: { "line-color": "#6FA8C4", "line-opacity": 0.7, "line-width": 1.6 } });
      for (const [name, lon, lat] of TOWNS) {
        const el = document.createElement("div");
        // label to the left of the dot, so it never sits under a GPS station's label (those go right)
        el.className = "pointer-events-none flex items-center gap-1 text-[11px] text-ink/80";
        el.innerHTML = `<span style="text-shadow:0 0 3px #000,0 0 3px #000">${name}</span><span style="width:5px;height:5px;border-radius:50%;background:#ECE9E2;opacity:.8"></span>`;
        new maplibregl.Marker({ element: el, anchor: "right" }).setLngLat([lon, lat]).addTo(m);
      }
      m.addSource("frame", { type: "geojson", data: { type: "Feature", geometry: { type: "Polygon", coordinates: [[...coords, coords[0]]] } } });
      m.addLayer({ id: "frame", type: "line", source: "frame", paint: { "line-color": "#9DB08A", "line-width": 1, "line-opacity": 0.55, "line-dasharray": [4, 3] } });
      m.addSource("relief", { type: "geojson", data: emptyFC() });
      m.addLayer({ id: "relief", type: "fill-extrusion", source: "relief", layout: { visibility: "none" },
        paint: { "fill-extrusion-color": ["get", "c"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": 0, "fill-extrusion-opacity": 0.96, "fill-extrusion-vertical-gradient": true } });
      for (const id of ["sel", "pin"]) m.addSource(id, { type: "geojson", data: emptyFC() });
      m.addLayer({ id: "sel-glow", type: "line", source: "sel", paint: { "line-color": "#9DB08A", "line-width": 7, "line-opacity": 0.35, "line-blur": 4 } });
      m.addLayer({ id: "sel", type: "line", source: "sel", paint: { "line-color": "#C3D0B3", "line-width": 2 } });
      m.addLayer({ id: "pin", type: "line", source: "pin", paint: { "line-color": "#A08BB8", "line-width": 2, "line-dasharray": [2, 1.5] } });
      m.addSource("fields", { type: "geojson", data: emptyFC(), promoteId: "field_id" });
      const crop = ["match", ["get", "crop"], ...Object.entries(CROP_COLORS).flat(), "#9E9A92"];
      m.addLayer({ id: "fields-fill", type: "fill", source: "fields", layout: { visibility: "none" }, paint: { "fill-color": crop, "fill-opacity": ["case", ["boolean", ["feature-state", "on"], false], 0.75, 0.42] } });
      m.addLayer({ id: "fields-line", type: "line", source: "fields", layout: { visibility: "none" }, paint: { "line-color": crop, "line-width": 1.6 } });
      loadRadar().then((R) => { if (R && map.current === m) m.getSource("fields")?.setData(R.fields); });
      m.addSource("prof", { type: "geojson", data: emptyFC() });
      m.addLayer({ id: "prof-glow", type: "line", source: "prof", paint: { "line-color": "#9DB08A", "line-width": 8, "line-opacity": 0.25, "line-blur": 5 } });
      m.addLayer({ id: "prof", type: "line", source: "prof", paint: { "line-color": "#C3D0B3", "line-width": 2.2 } });

      stationEls.current = D.stations.map((st) => {
        const btn = document.createElement("button");
        btn.className = "group flex items-center gap-1 -translate-x-1.5";
        btn.setAttribute("aria-label", `GPS station ${st.station}${st.role === "reference" ? ", reference" : ""}`);
        const point = document.createElement("span");
        point.className = `block w-3 h-3 ${st.role === "reference" ? "rotate-45" : "rounded-full"} border-2 border-accent-2 bg-space group-hover:bg-accent shadow-[0_0_10px_rgba(157,176,138,.6)]`;
        const label = document.createElement("span");
        label.className = "font-display text-[12px] font-semibold tracking-wide text-ink bg-space/85 px-1.5 py-0.5 rounded border border-hair-2";
        label.textContent = st.station;
        btn.append(point, label);
        btn.style.opacity = latest.current.S.gps ? 1 : 0.55;
        btn.onclick = (ev) => { ev.stopPropagation(); latest.current.onStation(st); };
        new maplibregl.Marker({ element: btn, anchor: "left" }).setLngLat([st.lon, st.lat]).addTo(m);
        return btn;
      });
      ready.current = true;
      m.fire("bg:ready");
      setTick((t) => t + 1);
    });

    m.on("click", (e) => {
      const { S, onCell, onProfilePoint } = latest.current;
      if (S.drawing) { onProfilePoint([e.lngLat.lng, e.lngLat.lat]); return; }
      if (S.fields && ready.current) {
        const f = m.queryRenderedFeatures(e.point, { layers: ["fields-fill"] })[0];
        if (f) { latest.current.onField(f.properties); return; }
      }
      const i = cellAt(D, e.lngLat.lng, e.lngLat.lat);
      if (i >= 0) onCell(i, e.originalEvent);
    });
    m.on("mousemove", (e) => {
      const i = cellAt(D, e.lngLat.lng, e.lngLat.lat);
      m.getCanvas().style.cursor = latest.current.S.drawing || i >= 0 ? "crosshair" : "";
      latest.current.onHover(i >= 0 && !latest.current.S.lens ? { i, x: e.point.x, y: e.point.y } : null);
      if (latest.current.S.lens) drawLens(e.point);
    });
    m.on("mouseout", () => { latest.current.onHover(null); drawLens(null); });
    m.on("move", () => latest.current.S.swipe != null && setTick((t) => t + 1));
    return () => {
      ready.current = false;
      map.current = null;
      stationEls.current = [];
      profMarkers.current = [];
      probe.current = null;
      m.remove();
    };
  }, [D]);

  // redraw whenever anything that changes the picture changes
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const draw = () => {
      const source = ready.current && m.getSource("grid");
      if (!source) return;
      const g = D.meta.grid;
      const c = document.createElement("canvas");
      c.width = g.ncols * PX; c.height = g.nrows * PX;
      const x = c.getContext("2d");
      const img = x.createImageData(c.width, c.height);
      const hatch = [];
      for (let i = 0; i < D.n; i++) {
        let col = null;
        if (S.mode === "labels") col = LABEL_COLORS[D.grid.label[i]] || null;
        else if (S.mode === "patterns") { const g = motionPatterns(D).group[i]; col = g == null ? null : PATTERN_COLORS[g]; }
        else { const v = cellValue(D, S, i); if (v != null) col = S.mode === "fringe" ? fringe(v) : diverging(v, domain); }
        if (!col && (S.mode === "hidden" || S.mode === "patterns") && D.grid.net_change_m[i] != null) col = [52, 50, 47]; // measured, but not in this view
        if (!col) { if (D.grid.n_valid_dates[i] > 0 || D.grid.label[i] === 0) hatch.push(i); continue; }
        const r0 = Math.floor(i / g.ncols) * PX, c0 = (i % g.ncols) * PX;
        for (let dy = 0; dy < PX; dy++) {
          let o = ((r0 + dy) * c.width + c0) * 4;
          for (let dx = 0; dx < PX; dx++, o += 4) { img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255; }
        }
      }
      x.putImageData(img, 0, 0);
      x.strokeStyle = "rgba(236,233,226,0.35)"; x.lineWidth = 1;
      x.beginPath();
      hatch.forEach((i) => { const cx = (i % g.ncols) * PX, cy = Math.floor(i / g.ncols) * PX; x.moveTo(cx, cy + PX); x.lineTo(cx + PX, cy); });
      x.stroke();
      source.updateImage({ image: c });

      // 3D
      m.setLayoutProperty("relief", "visibility", S.relief ? "visible" : "none");
      m.setPaintProperty("grid", "raster-opacity", S.relief ? 0 : 0.9);
      if (S.relief) {
        if (!reliefFeatures.current) reliefFeatures.current = Array.from({ length: D.n }, (_, i) => ({ ...box(cellBounds(D, i)), id: i, properties: {} }));
        const feats = [];
        for (let i = 0; i < D.n; i++) {
          const v = cellValue(D, S, i);
          if (v == null) continue;
          const f = reliefFeatures.current[i];
          const t = Math.max(0, Math.min(1, (v + domain) / (2 * domain)));
          f.properties = { h: 60 + t * RELIEF_H, c: rgb(S.mode === "labels" ? (LABEL_COLORS[D.grid.label[i]] || [60, 70, 90]) : S.mode === "fringe" ? fringe(v) : diverging(v, domain)) };
          feats.push(f);
        }
        m.getSource("relief").setData({ type: "FeatureCollection", features: feats });
      }
    };
    if (ready.current) draw(); else m.once("bg:ready", draw);
    return () => { m.off("bg:ready", draw); };
  }, [D, S.mode, S.k1, S.k2, S.cursor, S.relief, S.swipe, domain]);

  // camera for 3D
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const update = () => {
      if (S.relief) { m.dragRotate.enable(); m.easeTo({ pitch: 58, bearing: -18, duration: reduceMotion ? 0 : 1400 }); }
      else { m.dragRotate.disable(); m.easeTo({ pitch: 0, bearing: 0, duration: reduceMotion ? 0 : 900 }); }
    };
    if (ready.current) update(); else m.once("bg:ready", update);
    return () => { m.off("bg:ready", update); };
  }, [S.relief]);

  // crop fields (radar lane)
  useEffect(() => {
    const m = map.current;
    const go = () => {
      const v = S.fields ? "visible" : "none";
      m.setLayoutProperty("fields-fill", "visibility", v);
      m.setLayoutProperty("fields-line", "visibility", v);
      m.removeFeatureState({ source: "fields" });
      if (S.field) m.setFeatureState({ source: "fields", id: S.field.field_id }, { on: true });
    };
    if (ready.current) go(); else m?.once("bg:ready", go);
    return () => { m?.off("bg:ready", go); };
  }, [S.fields, S.field]);

  // outlines
  useEffect(() => {
    const m = map.current;
    const go = () => {
      m.getSource("sel").setData(S.sel >= 0 ? box(cellBounds(D, S.sel)) : emptyFC());
      m.getSource("pin").setData(S.pin >= 0 ? box(cellBounds(D, S.pin)) : emptyFC());
    };
    if (ready.current) go(); else m?.once("bg:ready", go);
    return () => { m?.off("bg:ready", go); };
  }, [D, S.sel, S.pin]);

  // stations dim unless GPS check is on
  useEffect(() => { stationEls.current.forEach((b) => (b.style.opacity = S.gps ? 1 : 0.55)); }, [S.gps]);
  useEffect(() => { if (!S.lens) drawLens(null); }, [S.lens]); // eslint-disable-line

  // profile line + draggable ends
  useEffect(() => {
    const m = map.current;
    const go = () => {
      const P = S.profile;
      const line = P?.canal ? (D.canal ? D.canal.lon.map((lo, j) => [lo, D.canal.lat[j]]) : null) : P?.b ? [P.a, P.b] : null;
      m.getSource("prof").setData(line ? { type: "Feature", geometry: { type: "LineString", coordinates: line } } : emptyFC());
      const want = P?.canal ? [] : P?.a ? (P.b ? ["a", "b"] : ["a"]) : [];
      profMarkers.current = profMarkers.current.filter((mk) => { if (!want.includes(mk._key)) { mk.remove(); return false; } return true; });
      want.forEach((key, n) => {
        let mk = profMarkers.current.find((x) => x._key === key);
        if (!mk) {
          const d = document.createElement("div");
          d.className = "w-6 h-6 rounded-full bg-accent text-space font-display font-bold text-[13px] grid place-items-center ring-2 ring-space cursor-grab shadow-[0_0_14px_#9DB08A]";
          d.textContent = String(n + 1);
          mk = new maplibregl.Marker({ element: d, draggable: true }).setLngLat(P[key]).addTo(m);
          mk._key = key;
          mk.on("drag", () => { const p = mk.getLngLat(); latest.current.onProfileDrag(key, [p.lng, p.lat]); });
          profMarkers.current.push(mk);
        } else mk.setLngLat(P[key]);
      });
    };
    if (ready.current) go(); else m?.once("bg:ready", go);
    return () => { m?.off("bg:ready", go); };
  }, [S.profile]);

  // MapLibre's own CSS sets position: relative on the container, so size it from a wrapper
  const sx = S.swipe != null && map.current && ready.current ? map.current.project([S.swipe, (D.bbox.north + D.bbox.south) / 2]).x : null;
  const moveSwipe = (lon) => onSwipe(Math.max(D.bbox.west, Math.min(D.bbox.east, lon)));
  const dragSwipe = (e) => {
    const m = map.current;
    if (!m || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const host = el.current.getBoundingClientRect();
    moveSwipe(m.unproject([e.clientX - host.left, host.height / 2]).lng);
  };
  return (
    <div className="absolute inset-0">
      <div ref={el} className="w-full h-full" />
      {unavailable && <p role="status" className="absolute inset-x-4 top-28 rounded-md border border-hair-2 bg-space p-4 text-ink">The interactive map needs WebGL. You can still read the story and open station records from the search menu.</p>}
      <canvas ref={lens} className="absolute inset-0 w-full h-full pointer-events-none z-[4]" aria-hidden="true" />
      {sx != null && (
        <div className="absolute top-0 bottom-0 z-[5] w-0" style={{ left: sx }}>
          <div className="absolute inset-y-0 -left-px w-[2px] bg-accent shadow-[0_0_14px_#9DB08A]" />
          <button onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)} onPointerMove={dragSwipe}
            onKeyDown={(e) => {
              const step = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
              if (step) { e.preventDefault(); e.stopPropagation(); moveSwipe(S.swipe + step * D.meta.grid.step_deg); }
            }} aria-label="Drag or use arrow keys to compare date A and date B"
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-accent text-space grid place-items-center cursor-ew-resize touch-none shadow-[0_0_20px_rgba(157,176,138,.6)] font-display font-bold text-[13px]">A|B</button>
          <span className="absolute top-1/2 -translate-y-1/2 right-7 whitespace-nowrap rounded-md bg-space/90 border border-hair-2 px-2 py-1 text-[12.5px]">A: {fmtShort(D.dates[S.k1])}</span>
          <span className="absolute top-1/2 -translate-y-1/2 left-7 whitespace-nowrap rounded-md bg-space/90 border border-hair-2 px-2 py-1 text-[12.5px]">B: {fmtShort(D.dates[S.k2])}</span>
        </div>
      )}
    </div>
  );
});

const TOWNS = [["Mendota", -120.381, 36.754], ["Firebaugh", -120.456, 36.859], ["Five Points", -120.103, 36.429], ["Huron", -120.103, 36.203],
  ["Lemoore", -119.783, 36.301], ["Hanford", -119.646, 36.327], ["Corcoran", -119.56, 36.098], ["Kerman", -120.06, 36.723], ["Riverdale", -119.86, 36.431], ["Coalinga", -120.36, 36.14]];

export default MapView;
