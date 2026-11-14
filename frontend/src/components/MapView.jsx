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

/** The map. Imperative inside (MapLibre), declarative outside (props in, events out). */
const MapView = forwardRef(function MapView({ D, S, domain, onCell, onProfilePoint, onProfileDrag, onHover, onStation, onSwipe }, ref) {
  const [, setTick] = useState(0); // re-render the swipe handle when the camera moves
  const el = useRef(null);
  const map = useRef(null);
  const ready = useRef(false);
  const latest = useRef({ S, onCell, onProfilePoint, onProfileDrag, onHover, onStation });
  latest.current = { S, onCell, onProfilePoint, onProfileDrag, onHover, onStation };
  const reliefFeatures = useRef(null);
  const stationEls = useRef([]);
  const profMarkers = useRef([]);
  const probe = useRef(null);

  useImperativeHandle(ref, () => ({
    flyTo: (ll, zoom, tilted = latest.current.S.relief) => map.current?.flyTo({ center: ll, zoom, pitch: tilted ? 58 : 0, bearing: tilted ? -18 : 0, duration: reduceMotion ? 0 : 1500 }),
    fitAll: (tilted = false) => { const b = D.bbox; map.current?.fitBounds([[b.west, b.south], [b.east, b.north]], { padding: 40, pitch: tilted ? 58 : 0, bearing: tilted ? -18 : 0, duration: reduceMotion ? 0 : 1400 }); },
    showProbe: (ll) => {
      if (!map.current) return;
      if (!ll) { probe.current?.remove(); probe.current = null; return; }
      if (!probe.current) {
        const d = document.createElement("div");
        d.className = "w-3 h-3 rounded-full bg-accent ring-2 ring-space shadow-[0_0_12px_#6FA8FF]";
        probe.current = new maplibregl.Marker({ element: d }).setLngLat(ll).addTo(map.current);
      } else probe.current.setLngLat(ll);
    },
  }));

  // create once
  useEffect(() => {
    const b = D.bbox;
    const m = new maplibregl.Map({
      container: el.current,
      attributionControl: { compact: true },
      style: {
        version: 8,
        sources: {
          base: { type: "raster", tileSize: 256, attribution: "© OpenStreetMap contributors © CARTO",
            tiles: ["a", "b", "c"].map((s) => `https://${s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png`) },
          labels: { type: "raster", tileSize: 256, tiles: ["https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png"] },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#0F1420" } },
          { id: "base", type: "raster", source: "base", paint: { "raster-saturation": -0.4, "raster-brightness-max": 0.85 } },
        ],
      },
      bounds: [[b.west, b.south], [b.east, b.north]],
      fitBoundsOptions: { padding: 40 },
      maxBounds: [[b.west - 1.6, b.south - 1.3], [b.east + 1.6, b.north + 1.3]],
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.current = m;
    m.touchZoomRotate.disableRotation();
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

    m.on("load", () => {
      const coords = [[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south]];
      m.addSource("grid", { type: "image", coordinates: coords });
      m.addLayer({ id: "grid", type: "raster", source: "grid", paint: { "raster-opacity": 0.9, "raster-resampling": "nearest", "raster-fade-duration": 0 } });
      m.addLayer({ id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.75 } });
      m.addSource("frame", { type: "geojson", data: { type: "Feature", geometry: { type: "Polygon", coordinates: [[...coords, coords[0]]] } } });
      m.addLayer({ id: "frame", type: "line", source: "frame", paint: { "line-color": "#6FA8FF", "line-width": 1, "line-opacity": 0.55, "line-dasharray": [4, 3] } });
      m.addSource("relief", { type: "geojson", data: emptyFC() });
      m.addLayer({ id: "relief", type: "fill-extrusion", source: "relief", layout: { visibility: "none" },
        paint: { "fill-extrusion-color": ["get", "c"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": 0, "fill-extrusion-opacity": 0.96, "fill-extrusion-vertical-gradient": true } });
      for (const id of ["sel", "pin"]) m.addSource(id, { type: "geojson", data: emptyFC() });
      m.addLayer({ id: "sel-glow", type: "line", source: "sel", paint: { "line-color": "#6FA8FF", "line-width": 7, "line-opacity": 0.35, "line-blur": 4 } });
      m.addLayer({ id: "sel", type: "line", source: "sel", paint: { "line-color": "#A9CBFF", "line-width": 2 } });
      m.addLayer({ id: "pin", type: "line", source: "pin", paint: { "line-color": "#A98BF0", "line-width": 2, "line-dasharray": [2, 1.5] } });
      m.addSource("prof", { type: "geojson", data: emptyFC() });
      m.addLayer({ id: "prof-glow", type: "line", source: "prof", paint: { "line-color": "#6FA8FF", "line-width": 8, "line-opacity": 0.25, "line-blur": 5 } });
      m.addLayer({ id: "prof", type: "line", source: "prof", paint: { "line-color": "#A9CBFF", "line-width": 2.2 } });

      stationEls.current = D.stations.map((st) => {
        const btn = document.createElement("button");
        btn.className = "group flex items-center gap-1 -translate-x-1.5";
        btn.setAttribute("aria-label", `GPS station ${st.station}${st.role === "reference" ? ", reference" : ""}`);
        btn.innerHTML = `<span class="block w-3 h-3 ${st.role === "reference" ? "rotate-45" : "rounded-full"} border-2 border-accent-2 bg-space group-hover:bg-accent shadow-[0_0_10px_rgba(111,168,255,.6)]"></span>
          <span class="font-display text-[12px] font-semibold tracking-wide text-ink bg-space/85 px-1.5 py-0.5 rounded border border-hair-2">${st.station}</span>`;
        btn.onclick = (ev) => { ev.stopPropagation(); latest.current.onStation(st); };
        new maplibregl.Marker({ element: btn, anchor: "left" }).setLngLat([st.lon, st.lat]).addTo(m);
        return btn;
      });
      ready.current = true;
      m.fire("bg:ready");
    });

    m.on("click", (e) => {
      const { S, onCell, onProfilePoint } = latest.current;
      if (S.drawing) { onProfilePoint([e.lngLat.lng, e.lngLat.lat]); return; }
      const i = cellAt(D, e.lngLat.lng, e.lngLat.lat);
      if (i >= 0) onCell(i, e.originalEvent);
    });
    m.on("mousemove", (e) => {
      const i = cellAt(D, e.lngLat.lng, e.lngLat.lat);
      m.getCanvas().style.cursor = latest.current.S.drawing || i >= 0 ? "crosshair" : "";
      latest.current.onHover(i >= 0 ? { i, x: e.point.x, y: e.point.y } : null);
    });
    m.on("mouseout", () => latest.current.onHover(null));
    m.on("move", () => latest.current.S.swipe != null && setTick((t) => t + 1));
    return () => m.remove();
  }, [D]);

  // redraw whenever anything that changes the picture changes
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const draw = () => {
      if (!ready.current) return;
      const g = D.meta.grid;
      const c = document.createElement("canvas");
      c.width = g.ncols * PX; c.height = g.nrows * PX;
      const x = c.getContext("2d");
      const img = x.createImageData(c.width, c.height);
      const hatch = [];
      for (let i = 0; i < D.n; i++) {
        let col = null;
        if (S.mode === "labels") col = LABEL_COLORS[D.grid.label[i]] || null;
        else if (S.swipe != null) {
          // swipe: left of the divider shows the ground on date A, right shows date B
          const left = g.lon_min + ((i % g.ncols) + 0.5) * g.step_deg < S.swipe;
          const v = D.values[i]?.[left ? S.k1 : S.k2];
          if (v != null) col = diverging(v, domain);
        }
        else { const v = cellValue(D, S, i); if (v != null) col = S.mode === "fringe" ? fringe(v) : diverging(v, domain); }
        if (!col) { if (D.grid.n_valid_dates[i] > 0 || D.grid.label[i] === 0) hatch.push(i); continue; }
        const r0 = Math.floor(i / g.ncols) * PX, c0 = (i % g.ncols) * PX;
        for (let dy = 0; dy < PX; dy++) {
          let o = ((r0 + dy) * c.width + c0) * 4;
          for (let dx = 0; dx < PX; dx++, o += 4) { img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255; }
        }
      }
      x.putImageData(img, 0, 0);
      x.strokeStyle = "rgba(170,190,230,0.35)"; x.lineWidth = 1;
      x.beginPath();
      hatch.forEach((i) => { const cx = (i % g.ncols) * PX, cy = Math.floor(i / g.ncols) * PX; x.moveTo(cx, cy + PX); x.lineTo(cx + PX, cy); });
      x.stroke();
      m.getSource("grid").updateImage({ image: c });

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
  }, [D, S.mode, S.k1, S.k2, S.cursor, S.relief, S.swipe, domain]);

  // camera for 3D
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    if (S.relief) { m.dragRotate.enable(); m.easeTo({ pitch: 58, bearing: -18, duration: reduceMotion ? 0 : 1400 }); }
    else { m.dragRotate.disable(); m.easeTo({ pitch: 0, bearing: 0, duration: reduceMotion ? 0 : 900 }); }
  }, [S.relief]);

  // outlines
  useEffect(() => {
    const m = map.current;
    const go = () => {
      m.getSource("sel").setData(S.sel >= 0 ? box(cellBounds(D, S.sel)) : emptyFC());
      m.getSource("pin").setData(S.pin >= 0 ? box(cellBounds(D, S.pin)) : emptyFC());
    };
    if (ready.current) go(); else m?.once("bg:ready", go);
  }, [D, S.sel, S.pin]);

  // stations dim unless GPS check is on
  useEffect(() => { stationEls.current.forEach((b) => (b.style.opacity = S.gps ? 1 : 0.55)); }, [S.gps]);

  // profile line + draggable ends
  useEffect(() => {
    const m = map.current;
    const go = () => {
      const P = S.profile;
      m.getSource("prof").setData(P?.b ? { type: "Feature", geometry: { type: "LineString", coordinates: [P.a, P.b] } } : emptyFC());
      const want = P?.a ? (P.b ? ["a", "b"] : ["a"]) : [];
      profMarkers.current = profMarkers.current.filter((mk) => { if (!want.includes(mk._key)) { mk.remove(); return false; } return true; });
      want.forEach((key, n) => {
        let mk = profMarkers.current.find((x) => x._key === key);
        if (!mk) {
          const d = document.createElement("div");
          d.className = "w-6 h-6 rounded-full bg-accent text-space font-display font-bold text-[13px] grid place-items-center ring-2 ring-space cursor-grab shadow-[0_0_14px_#6FA8FF]";
          d.textContent = String(n + 1);
          mk = new maplibregl.Marker({ element: d, draggable: true }).setLngLat(P[key]).addTo(m);
          mk._key = key;
          mk.on("drag", () => { const p = mk.getLngLat(); latest.current.onProfileDrag(key, [p.lng, p.lat]); });
          profMarkers.current.push(mk);
        } else mk.setLngLat(P[key]);
      });
    };
    if (ready.current) go(); else m?.once("bg:ready", go);
  }, [S.profile]);

  // MapLibre's own CSS sets position: relative on the container, so size it from a wrapper
  const sx = S.swipe != null && map.current && ready.current ? map.current.project([S.swipe, (D.bbox.north + D.bbox.south) / 2]).x : null;
  const dragSwipe = (e) => {
    e.preventDefault();
    const host = el.current.getBoundingClientRect();
    const mv = (ev) => { const p = map.current.unproject([ev.clientX - host.left, host.height / 2]); latest.current.onSwipe(Math.max(D.bbox.west, Math.min(D.bbox.east, p.lng))); };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };
  return (
    <div className="absolute inset-0">
      <div ref={el} className="w-full h-full" />
      {sx != null && (
        <div className="absolute top-0 bottom-0 z-[5] w-0" style={{ left: sx }}>
          <div className="absolute inset-y-0 -left-px w-[2px] bg-accent shadow-[0_0_14px_#6FA8FF]" />
          <button onPointerDown={dragSwipe} aria-label="Drag to compare date A and date B"
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-accent text-space grid place-items-center cursor-ew-resize shadow-[0_0_20px_rgba(111,168,255,.6)] font-display font-bold text-[13px]">A|B</button>
          <span className="absolute top-[64px] right-3 whitespace-nowrap rounded-md bg-space/90 border border-hair-2 px-2 py-1 text-[12.5px]">A: {fmtShort(D.dates[S.k1])}</span>
          <span className="absolute top-[64px] left-3 whitespace-nowrap rounded-md bg-space/90 border border-hair-2 px-2 py-1 text-[12.5px]">B: {fmtShort(D.dates[S.k2])}</span>
        </div>
      )}
    </div>
  );
});

export default MapView;
