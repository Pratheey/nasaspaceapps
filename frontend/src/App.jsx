import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScanSearch, Search, Play, BookOpen as BookIcon, SplitSquareHorizontal, Activity, Box, CalendarRange, Info, Layers, Route, Satellite, Share2, Tags, Waves, MapPin, Compass, BookOpen, MousePointerClick, Sprout, Droplets } from "lucide-react";
import FieldCard from "./components/FieldCard.jsx";
import Story, { Mark } from "./story/Story.jsx";
import MapView from "./components/MapView.jsx";
import Inspector from "./components/Inspector.jsx";
import Timeline from "./components/Timeline.jsx";
import Legend from "./components/Legend.jsx";
import { ProfilePanel, TourCard, Limits, DataStatus } from "./components/Panels.jsx";
import { loadData, cellAt, cellBounds, fitAt } from "./lib/data.js";
import { cellValue, netDomain, MODES } from "./lib/view.js";
import { cm } from "./lib/fmt.js";
import { listen, stopListening, downloadCSV, writeHash, readHash } from "./lib/extras.js";
import { tourSteps } from "./lib/tour.jsx";
import CommandBar from "./components/CommandBar.jsx";

const MODE_ICONS = { net: Layers, pair: CalendarRange, breathe: Activity, fringe: Waves, labels: Tags };
const PLACES = [
  { name: "Corcoran", ll: [-119.56, 36.098], z: 10.5 },
  { name: "Mendota", ll: [-120.381, 36.754], z: 10.5 },
  { name: "Whole study area", ll: null },
];
const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function App() {
  const [D, setD] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { loadData().then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <Failure msg={err} />;
  if (!D) return <div className="h-full grid place-items-center text-mute font-display">Loading radar passes…</div>;
  return <Shell D={D} />;
}

// The story is the front door; the explorer is the instrument. A shared link opens the explorer directly.
function Shell({ D }) {
  const [view, setView] = useState(() => (Object.keys(readHash()).length ? "explore" : "story"));
  const [tourOnOpen, setTourOnOpen] = useState(false);
  const go = (v, tour = false) => { setTourOnOpen(tour); setView(v); window.scrollTo(0, 0); if (v === "story") history.replaceState(null, "", location.pathname + location.search); };
  useEffect(() => {
    document.documentElement.style.overflow = view === "explore" ? "hidden" : "";
    if (view === "story") document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [view]);
  return view === "story"
    ? <Story D={D} onExplore={() => go("explore")} />
    : <div className="h-[100svh] overflow-y-auto lg:overflow-hidden [animation:rise-in_.6s_both]"><Explorer D={D} onStory={() => go("story")} startTour={tourOnOpen} /></div>;
}

function Explorer({ D, onStory, startTour }) {
  const N = D.dates.length;
  const domain = useMemo(() => netDomain(D), [D]);
  const [S, setS] = useState(() => initialState(D));
  const set = useCallback((patch) => setS((s) => {
    const next = { ...s, ...(typeof patch === "function" ? patch(s) : patch) };
    if (next.mode !== "pair" || next.relief) next.swipe = null;
    return next;
  }), []);
  const Sref = useRef(S); Sref.current = S;
  const mapRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [limits, setLimits] = useState(false);
  const [flash, setFlash] = useState(null);
  const [cmd, setCmd] = useState(false);
  const steps = useMemo(() => tourSteps(D), [D]);

  const stationAt = useCallback((i) => D.stations.find((s) => s.cell_index === i), [D]);
  const placeName = useCallback((i) => { const st = stationAt(i); const b = cellBounds(D, i); return st ? `GPS station ${st.station}` : `${b.lat.toFixed(2)}° N, ${Math.abs(b.lng).toFixed(2)}° W`; }, [D, stationAt]);

  /* ---------- actions ---------- */
  const select = useCallback((i, { fly = false } = {}) => {
    stopListening();
    set((s) => ({ sel: i, listenK: null, pin: s.pin === i ? -1 : s.pin }));
    if (fly && i >= 0) { const b = cellBounds(D, i); mapRef.current?.flyTo([b.lng, b.lat], 10); }
  }, [D, set]);
  const setMode = useCallback((m) => set((s) => ({ mode: m, playing: m === "breathe" ? s.playing : false, swipe: m === "pair" ? s.swipe : null })), [set]);
  const actions = useMemo(() => ({
    select,
    clearSel: () => { stopListening(); set({ sel: -1, listenK: null }); },
    setPin: (i) => set({ pin: i, awaitPin: false }),
    showPair: (a, b) => set({ k1: a, k2: b, mode: "pair", swipe: null, playing: false }),
    scrubTo: (k) => set({ cursor: k, mode: "breathe", playing: false }),
    csv: () => downloadCSV(D, Sref.current.sel, (t) => fitAt(D, Sref.current.sel, t), stationAt(Sref.current.sel)),
    toggleListen: () => {
      if (Sref.current.listenK != null) { stopListening(); set({ listenK: null }); return; }
      if (listen(D.values[Sref.current.sel] || [], { onStep: (k) => set({ listenK: k }), onEnd: () => set({ listenK: null }) })) {
        set({ listenK: 0 });
      }
    },
  }), [D, select, set, stationAt]);
  useEffect(() => stopListening, []);

  const onCell = useCallback((i, ev) => {
    const s = Sref.current;
    if (s.awaitPin || ((ev?.shiftKey || ev?.altKey) && s.sel >= 0)) { set({ pin: i === s.sel ? -1 : i, awaitPin: false }); return; }
    select(i);
  }, [select, set]);
  const onStation = useCallback((st) => { set({ gps: true }); select(st.cell_index); }, [select, set]);
  const onProfilePoint = useCallback((ll) => set((s) => (s.profile?.a && !s.profile.b ? { profile: { a: s.profile.a, b: ll }, drawing: false } : { profile: { a: ll } })), [set]);
  const onProfileDrag = useCallback((key, ll) => set((s) => ({ profile: { ...s.profile, [key]: ll } })), [set]);
  const valueAt = useCallback((lng, lat) => { const i = cellAt(D, lng, lat); return i < 0 ? null : cellValue(D, S, i); }, [D, S.mode, S.k1, S.k2, S.cursor, S.swipe]); // eslint-disable-line
  const toggleSwipe = () => set((s) => s.swipe != null ? { swipe: null } : {
    swipe: (D.bbox.west + D.bbox.east) / 2, mode: "pair", relief: false, lens: false, playing: false,
  });
  const closeProfile = () => {
    mapRef.current?.showProbe(null);
    set({ profile: null, drawing: false });
  };
  const toggleProfile = () => Sref.current.profile && !Sref.current.profile.canal ? closeProfile() : set({ profile: { a: null }, drawing: true });
  const toggleCanal = () => {
    mapRef.current?.showProbe(null);
    set(Sref.current.profile?.canal ? { profile: null, drawing: false } : { profile: { canal: true }, drawing: false });
  };

  /* ---------- playback ---------- */
  useEffect(() => {
    if (!S.playing) return;
    const id = setInterval(() => set((s) => (s.cursor >= N - 1 ? { playing: false } : { cursor: s.cursor + 1 })), reduceMotion ? 900 : 360);
    return () => clearInterval(id);
  }, [S.playing, N, set]);
  const togglePlay = () => set((s) => (s.playing ? { playing: false } : { playing: true, mode: "breathe", cursor: s.cursor >= N - 1 || s.mode !== "breathe" ? 0 : s.cursor }));
  const step = (d) => set((s) => (s.mode === "pair" ? {} : { playing: false, mode: "breathe", cursor: Math.max(0, Math.min(N - 1, s.cursor + d)) }));

  /* ---------- shareable link ---------- */
  useEffect(() => { if (!S.playing) writeHash(S); }, [S]);
  const share = async () => {
    writeHash(S);
    try { await navigator.clipboard.writeText(location.href); setFlash("Link copied. It opens this exact view."); }
    catch { setFlash("Copy the address bar to share this exact view."); }
    setTimeout(() => setFlash(null), 2600);
  };

  /* ---------- walkthrough ---------- */
  const goStep = useCallback((k) => {
    if (k < 0 || k >= steps.length) return;
    const st = steps[k];
    stopListening();
    set({ ...st.state, tour: k, listenK: null });
    const sel = st.state.sel ?? Sref.current.sel;
    // after React has applied the state (and the 3D camera effect has run)
    setTimeout(() => {
      if (st.camera === "fit") mapRef.current?.fitAll(!!st.state.relief);
      const tilted = !!(st.state.relief ?? Sref.current.relief);
      if (st.camera === "sel" && sel >= 0) { const b = cellBounds(D, sel); mapRef.current?.flyTo([b.lng, b.lat], 10, tilted); }
      else if (st.camera?.center) mapRef.current?.flyTo(st.camera.center, st.camera.zoom, tilted);
    }, 60);
  }, [steps, set, D]);
  const endTour = () => set({ tour: -1, playing: false });
  useEffect(() => { if (startTour) setTimeout(() => goStep(0), 400); }, []); // eslint-disable-line

  /* ---------- command bar ---------- */
  const commandItems = () => {
    const G = D.grid;
    const fastest = [];
    for (let i = 0; i < D.n; i++) if (G.net_change_m[i] != null && (G.label[i] === 1 || G.label[i] === 3)) fastest.push([i, G.net_change_m[i]]);
    fastest.sort((a, b) => a[1] - b[1]);
    return [
      ...PLACES.map((p) => ({ id: "p" + p.name, group: "Places", label: p.name, icon: MapPin, run: () => { if (!p.ll) mapRef.current?.fitAll(); else { mapRef.current?.flyTo(p.ll, p.z); const i = cellAt(D, ...p.ll); if (i >= 0) select(i); } } })),
      ...D.stations.map((st) => ({ id: "s" + st.station, group: "GPS stations", label: `GPS ${st.station}`, hint: st.role === "reference" ? "reference" : "independent check", icon: Satellite, run: () => { set({ gps: true }); select(st.cell_index, { fly: true }); } })),
      ...fastest.slice(0, 3).map(([i, v], n) => ({ id: "f" + i, group: "Sinking fastest", label: placeName(i), hint: cm(v), icon: Activity, run: () => select(i, { fly: true }) })),
      ...MODES.map((m) => ({ id: "m" + m.id, group: "Views", label: m.name, key: m.key, icon: MODE_ICONS[m.id], run: () => setMode(m.id) })),
      { id: "t-play", group: "Tools", label: "Play the record", key: "Space", icon: Play, run: togglePlay },
      { id: "t-swipe", group: "Tools", label: "Swipe date A against date B", key: "S", icon: SplitSquareHorizontal, run: toggleSwipe },
      { id: "t-lens", group: "Tools", label: "Radar lens", key: "L", icon: ScanSearch, run: () => set({ lens: true, relief: false }) },
      { id: "t-3d", group: "Tools", label: "3D view", key: "D", icon: Box, run: () => set({ relief: true, lens: false }) },
      { id: "t-prof", group: "Tools", label: "Draw a cross-section", key: "P", icon: Route, run: toggleProfile },
      ...(D.canal ? [{ id: "t-canal", group: "Tools", label: "California Aqueduct profile", key: "A", icon: Droplets, run: toggleCanal }] : []),
      { id: "t-gps", group: "Tools", label: S.gps ? "Hide GPS check" : "Show GPS check", key: "G", icon: Satellite, run: () => set({ gps: !Sref.current.gps }) },
      { id: "t-fields", group: "Tools", label: "Crop fields: polarization and coverage", key: "F", icon: Sprout, run: () => set({ fields: true, field: null }) },
      { id: "t-tour", group: "Tools", label: "Walkthrough", key: "W", icon: Compass, run: () => goStep(0) },
      { id: "t-share", group: "Tools", label: "Copy a link to this view", icon: Share2, run: share },
      { id: "t-limits", group: "Tools", label: "What this map can and can't tell you", icon: Info, run: () => setLimits(true) },
      { id: "t-story", group: "Tools", label: "Back to the story", icon: BookIcon, run: onStory },
    ];
  };

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e) => {
      const s = Sref.current;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((o) => !o); return; }
      if (e.key === "Escape") {
        if (cmd) setCmd(false);
        else if (limits) setLimits(false);
        else if (s.tour >= 0) endTour();
        else if (s.field) set({ field: null });
        else if (s.profile) closeProfile();
        else if (s.awaitPin) set({ awaitPin: false });
        return;
      }
      if (cmd || limits || e.defaultPrevented || e.target.closest?.("input, select, textarea, [contenteditable], [role='slider']") || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === " " && !e.target.closest?.("button, a")) { e.preventDefault(); togglePlay(); }
      else if ("12345".includes(k) && k) setMode(MODES[+k - 1].id);
      else if (k === "g") set({ gps: !s.gps });
      else if (k === "d") set({ relief: !s.relief, lens: false });
      else if (k === "l") set({ lens: !s.lens, relief: false });
      else if (k === "s") toggleSwipe();
      else if (k === "p") toggleProfile();
      else if (k === "a" && D.canal) toggleCanal();
      else if (k === "w") goStep(0);
      else if (k === "f") set({ fields: !s.fields, field: null });
      else if (k === "arrowright") step(1);
      else if (k === "arrowleft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const hv = hover && (() => {
    const v = S.mode === "labels" ? null : cellValue(D, S, hover.i);
    const series = D.values[hover.i];
    const ok = series?.filter((x) => x != null) || [];
    let pts = "";
    if (ok.length > 2) {
      const lo = Math.min(...ok), hi = Math.max(...ok), sp = hi - lo || 1;
      pts = series.map((x, k) => (x == null ? null : `${((k / (series.length - 1)) * 86 + 2).toFixed(1)},${(2 + (1 - (x - lo) / sp) * 20).toFixed(1)}`)).filter(Boolean).join(" ");
    }
    return { text: S.mode === "labels" ? D.meta.labels[String(D.grid.label[hover.i])] : v == null ? "No measurement here" : cm(v), pts };
  })();

  return (
    <div className="lg:h-full flex flex-col">

      <header className="shrink-0 flex items-center gap-3 2xl:gap-6 px-5 max-sm:px-3 h-[60px] border-b border-hair bg-space max-lg:flex-wrap max-lg:h-auto max-lg:py-2 max-lg:gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onStory} title="Back to the story" aria-label="Back to the story" className="shrink-0 rounded-full hover:scale-105 transition"><Mark size={32} /></button>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-[21px] max-sm:text-[18px] leading-none truncate">The Breathing Ground</h1>
            <p className="text-[12px] text-mute mt-1 truncate max-[1500px]:hidden">Corcoran–Mendota, San Joaquin Valley, seen by NISAR L-band radar</p>
          </div>
          <DataStatus D={D} />
        </div>
        <nav aria-label="Map view" className="flex gap-1 mx-auto max-lg:order-3 max-lg:w-full max-lg:overflow-x-auto">
          {MODES.map((m) => {
            const Icon = MODE_ICONS[m.id], on = S.mode === m.id;
            return (
              <button key={m.id} onClick={() => setMode(m.id)} aria-pressed={on} title={`${m.name} (${m.key})`}
                className={`relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 font-display text-[15px] font-medium transition-colors ${on ? "text-accent-2 bg-accent/10" : "text-mute hover:text-ink hover:bg-deck-2"}`}>
                <Icon size={15} className="shrink-0" /> <span className="lg:max-2xl:sr-only">{m.name}</span>
                {on && <span className="absolute left-3 right-3 -bottom-[11px] h-[2px] bg-accent shadow-[0_0_10px_#6FA8FF] max-lg:hidden" />}
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-1.5">
          <button onClick={() => set({ gps: !S.gps })} aria-pressed={S.gps}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-[14px] border ${S.gps ? "border-accent/60 text-accent-2 bg-accent/10" : "border-hair text-ink/85 hover:border-hair-2"}`}>
            <Satellite size={15} /> GPS check
          </button>
          <button onClick={onStory} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[14px] text-ink/85 hover:text-ink hover:bg-deck-2">
            <BookOpen size={15} /> <span className="lg:max-xl:sr-only">Story</span>
          </button>
          <button onClick={() => setLimits(true)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[14px] text-ink/85 hover:text-ink hover:bg-deck-2">
            <Info size={15} /> <span className="lg:max-xl:sr-only">Limits</span>
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_clamp(360px,32vw,440px)] max-lg:flex max-lg:flex-col">
        <div className="min-h-0 flex flex-col">
          <div className="@container relative flex-1 min-h-[420px] overflow-hidden max-lg:flex-none max-lg:h-[62svh] max-lg:min-h-[360px]">
            <MapView ref={mapRef} D={D} S={S} domain={domain} onCell={onCell} onStation={onStation}
              onProfilePoint={onProfilePoint} onProfileDrag={onProfileDrag} onHover={setHover} onSwipe={(lon) => set({ swipe: lon })} onField={(f) => set({ field: f })} />
            {S.fields && <FieldCard field={S.field} onClose={() => set({ field: null })} />}

            {S.mode === "breathe" && !S.relief && (
              // a radar swath sweeps the map on every new pass
              <div key={S.cursor} aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-[38%] z-[3] bg-[linear-gradient(90deg,transparent,rgba(111,168,255,.16)_45%,rgba(169,203,255,.32)_50%,rgba(111,168,255,.16)_55%,transparent)] animate-[sweep_.9s_ease-out_both] motion-reduce:hidden" />
            )}
            <div role="toolbar" aria-label="Map tools" className="absolute top-3.5 left-4 z-10 flex max-w-[calc(100%-5.5rem)] overflow-x-auto rounded-lg border border-hair-2 bg-space/90 backdrop-blur shadow-[0_8px_30px_rgba(0,0,0,.4)]">
              <button onClick={() => setCmd(true)} title="Search (Ctrl+K)" aria-label="Search places, views and tools"
                className="inline-flex items-center gap-2 px-3 py-2 text-[14px] text-ink/90 hover:bg-deck-2 border-r border-hair-2">
                <Search size={15} className="text-accent" /><kbd className="font-mono text-[11px] text-mute border border-hair-2 rounded px-1 whitespace-nowrap @max-[700px]:hidden">Ctrl K</kbd>
              </button>
              <label className="relative flex items-center @max-[560px]:hidden">
                <MapPin size={15} className="absolute left-3 text-accent pointer-events-none" />
                <select aria-label="Go to a place" value="" onChange={(e) => {
                  const v = e.target.value;
                  if (v[0] === "p") { const p = PLACES[+v.slice(1)]; if (!p.ll) mapRef.current?.fitAll(); else { mapRef.current?.flyTo(p.ll, p.z); const i = cellAt(D, ...p.ll); if (i >= 0) select(i); } }
                  if (v[0] === "s") { const st = D.stations.find((x) => x.station === v.slice(1)); set({ gps: true }); select(st.cell_index, { fly: true }); }
                }} className="appearance-none bg-transparent text-[14px] text-ink pl-9 pr-4 py-2 cursor-pointer outline-none [&>option]:bg-deck">
                  <option value="">Go to…</option>
                  {PLACES.map((p, k) => <option key={p.name} value={`p${k}`}>{p.name}</option>)}
                  {D.stations.map((st) => <option key={st.station} value={`s${st.station}`}>GPS {st.station}{st.role === "reference" ? " (reference)" : ""}</option>)}
                </select>
              </label>
              {[
                { icon: Route, label: "Cross-section", on: !!S.profile && !S.profile.canal, act: toggleProfile, key: "P" },
                { icon: SplitSquareHorizontal, label: "Swipe", on: S.swipe != null, act: toggleSwipe, key: "S" },
                ...(D.canal ? [{ icon: Droplets, label: "Aqueduct", on: !!S.profile?.canal, act: toggleCanal, key: "A" }] : []),
                { icon: ScanSearch, label: "Lens", on: S.lens, act: () => set({ lens: !S.lens, relief: false }), key: "L" },
                { icon: Box, label: "3D", on: S.relief, act: () => set({ relief: !S.relief, lens: false }), key: "D" },
                { icon: Sprout, label: "Fields", on: S.fields, act: () => set({ fields: !S.fields, field: null }), key: "F" },
                { icon: Share2, label: "Share view", on: false, act: share },
              ].map(({ icon: Icon, label, on, act, key }) => (
                <button key={label} onClick={act} aria-pressed={key ? on : undefined} title={key ? `${label} (${key})` : label}
                  className={`inline-flex items-center gap-1.5 border-l border-hair-2 px-3 py-2 text-[14px] ${on ? "bg-accent text-space font-semibold" : "text-ink/90 hover:bg-deck-2"}`}>
                  <Icon size={15} className="shrink-0" /> <span className="whitespace-nowrap @max-[1080px]:sr-only">{label}</span>
                </button>
              ))}
              <button onClick={() => goStep(0)} title="Walkthrough (W)" className="inline-flex items-center gap-1.5 border-l border-hair-2 px-3 py-2 text-[14px] text-accent-2 hover:bg-deck-2">
                <Compass size={15} className="shrink-0" /> <span className="whitespace-nowrap @max-[1080px]:sr-only">Walkthrough</span>
              </button>
            </div>

            {S.drawing && !S.profile?.a && (
              <p className="absolute top-[66px] left-4 z-10 rounded-md bg-accent text-space text-[13.5px] font-semibold px-3 py-1.5">Click the first end of your line on the map</p>
            )}

            {S.tour < 0 && (
              <div className="absolute left-4 bottom-4 z-10 max-lg:hidden">
                <Legend D={D} S={S} domain={domain} />
              </div>
            )}

            {hv && hover && (
              <div className="pointer-events-none absolute z-20 flex items-center gap-2 rounded-md bg-space/95 border border-hair-2 px-2 py-1 text-[12.5px] shadow-lg"
                style={{ transform: `translate(${hover.x + 14}px, ${hover.y + 12}px)`, left: 0, top: 0 }}>
                <span>{hv.text}</span>
                {hv.pts && <svg viewBox="0 0 90 24" className="w-[90px] h-6" aria-hidden="true"><polyline points={hv.pts} fill="none" stroke="#F0705A" strokeWidth="1.6" /></svg>}
              </div>
            )}

            {S.tour >= 0 && (
              <TourCard step={steps[S.tour]} k={S.tour} n={steps.length}
                onPrev={() => goStep(S.tour - 1)} onNext={() => (S.tour >= steps.length - 1 ? endTour() : goStep(S.tour + 1))} onClose={endTour} />
            )}
            {S.sel < 0 && S.tour < 0 && !S.drawing && S.swipe == null && (
              <div className="pointer-events-none absolute left-1/2 top-[68px] -translate-x-1/2 z-10 flex items-center gap-2.5 rounded-full border border-accent/40 bg-space/85 backdrop-blur px-4 py-2 text-[13.5px] shadow-[0_0_30px_rgba(111,168,255,.18)] [animation:rise-in_.6s_.4s_both] max-md:hidden">
                <span className="relative flex w-2.5 h-2.5"><span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-60" /><span className="relative w-2.5 h-2.5 rounded-full bg-accent" /></span>
                <MousePointerClick size={15} className="text-accent" /> Click any spot to open its record
              </div>
            )}
          </div>

          <div className="lg:hidden px-3 pt-3"><Legend D={D} S={S} domain={domain} /></div>
          {S.profile && (
            <ProfilePanel D={D} S={S} valueAt={valueAt} onClose={closeProfile}
              onProbe={(ll) => mapRef.current?.showProbe(ll)} onPick={(i) => select(i)} />
          )}
          <Timeline D={D} S={S} trace={S.sel >= 0 ? D.values[S.sel] : null}
            onScrub={(k) => set({ cursor: k, mode: "breathe", playing: false })}
            onPair={(key, k) => set((s) => ({ [key]: key === "k1" ? Math.max(0, Math.min(k, s.k2 - 1)) : Math.min(N - 1, Math.max(k, s.k1 + 1)) }))}
            onPlay={togglePlay} onStep={step} />
        </div>

        <div className="min-h-0 min-w-0 overflow-hidden border-l border-hair bg-deck/40 max-lg:border-l-0 max-lg:border-t max-lg:overflow-visible">
          <Inspector D={D} S={S} set={set} actions={actions} stationAt={stationAt} placeName={placeName} />
        </div>
      </main>

      {cmd && <CommandBar open={cmd} onClose={() => setCmd(false)} items={commandItems()} />}
      {limits && <Limits D={D} onClose={() => setLimits(false)} />}
      {flash && <div role="status" className="fixed left-1/2 bottom-8 -translate-x-1/2 z-50 rounded-lg bg-accent text-space font-semibold px-4 py-2.5 shadow-[0_0_30px_rgba(111,168,255,.45)]">{flash}</div>}
    </div>
  );
}

function initialState(D) {
  const N = D.dates.length;
  const S = { mode: "net", sel: -1, pin: -1, k1: 0, k2: N - 1, cursor: N - 1, gps: false, split: false, playing: false,
    relief: false, drawing: false, profile: null, awaitPin: false, tour: -1, listenK: null, swipe: null, lens: false, fields: false, field: null };
  const h = readHash();
  const int = (x, lo, hi) => { const n = parseInt(x, 10); return isNaN(n) ? null : Math.max(lo, Math.min(hi, n)); };
  if (MODES.some((m) => m.id === h.mode)) S.mode = h.mode;
  if (h.a != null) S.k1 = int(h.a, 0, N - 2) ?? 0;
  if (h.b != null) S.k2 = Math.max(S.k1 + 1, int(h.b, 1, N - 1) ?? N - 1);
  if (h.t != null) S.cursor = int(h.t, 0, N - 1) ?? N - 1;
  if (h.cell) S.sel = int(h.cell, 0, D.n - 1) ?? -1;
  if (h.pin) S.pin = int(h.pin, 0, D.n - 1) ?? -1;
  if (h.gps === "1") S.gps = true;
  if (h.relief === "1") S.relief = true;
  if (!S.relief && h.lens === "1") S.lens = true;
  if (h.fields === "1") { S.fields = true; if (h.field) S.field = { field_id: h.field }; }
  if (h.split === "1") S.split = true;
  if (S.mode === "pair" && !S.relief && h.swipe != null) {
    const swipe = Number(h.swipe);
    if (Number.isFinite(swipe) && swipe >= D.bbox.west && swipe <= D.bbox.east) S.swipe = swipe;
  }
  if (h.prof) {
    const parts = h.prof.split(",");
    const q = parts.map(Number);
    if (q.length === 4 && parts.every((part) => part.trim() !== "")
      && q.every((n, k) => Number.isFinite(n) && Math.abs(n) <= (k % 2 ? 85 : 180))) {
      S.profile = { a: [q[0], q[1]], b: [q[2], q[3]] };
    }
  }
  return S;
}

function Failure({ msg }) {
  return (
    <div className="h-full grid place-items-center p-8">
      <div className="max-w-lg">
        <h1 className="font-display text-2xl font-semibold">The data didn't load</h1>
        <p className="text-mute mt-2">{msg}</p>
        <p className="mt-3 text-ink/85">Put the app files in <code>frontend/public/data/</code>, or run <code>python3 contracts/samples/make_samples.py</code> and copy the samples into <code>frontend/public/samples/</code>.</p>
      </div>
    </div>
  );
}
