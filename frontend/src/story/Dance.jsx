// "The dance": every cell of the valley as one point whose height is its measured position at the current pass.
// 2D canvas for floor and rings, raw WebGL for points, stems and streaks; hand-written 3D projection, no libraries. Real data only; exaggeration and interpolation are labelled.
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Play, Pause, Volume2, VolumeX, EyeOff, ArrowRight } from "lucide-react";
import { cellBounds } from "../lib/data.js";
import { diverging, legendGradient } from "../lib/colors.js";
import { cm, fmtDate } from "../lib/fmt.js";
import { prepareDance } from "./danceData.js";
import { createDanceAudio } from "./danceAudio.js";

/* ---------- tuning constants ---------- */
const PASS_SEC = 1.15;              // seconds per radar pass (26 passes = 25 s of motion)
const SWEEP_SEC = 0.35;           // the radar swath crosses the field in this time
const END_SETTLE_SEC = 0.8;       // hold on the last pass before the net-change frame
const END_MORPH_SEC = 2.2;        // ease into the net-change frame
const END_HOLD_SEC = 6;           // hold the net-change frame
const END_RETURN_SEC = 1.6;       // ease back to the first pass, then loop
const HEIGHT_FRAC = 0.30;         // the 99th-percentile movement spans this share of the field width
const TRACK_HEADING_DEG = -10;    // approximate heading of the ascending track, clockwise from north (display only)
const DOT_PX = 2.4;               // dot size in CSS px (scaled 0.8 to 1.35 by nearness)
const HALO_PX = 6.5;              // glow size
const DOT_ALPHA = 0.9;
const HALO_ALPHA = 0.10;
const DIM_ALPHA = 0.4;            // cells with a missing pass beside this moment
const SOLO_DIM = 0.25;            // other points while one is soloed
const DUST_ALPHA = 0.2, DUST_PX = 1.4;
const STEM_ALPHA = 0.16;
const TRAIL_PASSES = 0.55;        // how far back a motion streak reaches, in passes
const TRAIL_ALPHA = 0.2;
const BEAT_BOOST = 1.1;           // extra brightness where the swath is crossing
const END_DIM = 0.28;             // brightness of cells within the uncertainty in the net-change frame
const END_LIT = 1.3;              // brightness of cells that sank beyond the uncertainty
const COLOUR_LIFT = 34;           // lifts the "still" colour so dots read on the dark ground
const NBINS = 41;                 // colour bins (odd so the middle is exactly zero)
const PITCH_BASE = 36, PITCH_MIN = 18, PITCH_MAX = 82, PITCH_END_DROP = 8; // degrees above the horizon
const YAW_BASE = 18, YAW_SWING = 24, ORBIT_PERIOD_SEC = 34, ORBIT_RESUME_SEC = 4;
const ZOOM_MIN = 0.6, ZOOM_MAX = 2.6;
const CAM_DIST_KM = 280;          // perspective strength (smaller = stronger)
const FIT_W_KM = 150, FIT_H_KM = 120; // the field plus swing and height must fit in this many km of canvas
const PICK_PX = 12;
const PAD_GAIN = 0.05, DRONE_GAIN = 0.03, SOLO_GAIN = 0.035, TICK_GAIN = 0.06;
const PAD_BASE_HZ = 130.8, DRONE_BASE_HZ = 110, SOLO_BASE_HZ = 392, TICK_HZ = 1320;
const DPR_CAP = 1.5;             // device-pixel-ratio cap for both canvases
const LITE_FRAME_MS = 30;        // frames slower than this (under ~33 fps) switch off glow and streaks switch off glow and streaks
const BG = "#161514";

const ease = (f) => 0.5 - 0.5 * Math.cos(Math.PI * f);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const reduceMotionQuery = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Dance({ D, onClose, onOpenSpot }) {
  if (!D) return null;
  return <DanceInner D={D} onClose={onClose} onOpenSpot={onOpenSpot} />;
}

function DanceInner({ D, onClose, onOpenSpot }) {
  const P = useMemo(() => prepareDance(D, { heightFrac: HEIGHT_FRAC, headingDeg: TRACK_HEADING_DEG }), [D]);
  const N = P.N;
  const reduce = useMemo(reduceMotionQuery, []);
  const PLAY_END = (N - 1) * PASS_SEC, T1 = PLAY_END + END_SETTLE_SEC, T2 = T1 + END_MORPH_SEC, T3 = T2 + END_HOLD_SEC, LOOP = T3 + END_RETURN_SEC;
  const NET_CLOCK = T2 + 0.5;

  const wrapRef = useRef(null), canvasRef = useRef(null), glRef = useRef(null), fpsRef = useRef(null), trackRef = useRef(null), fillRef = useRef(null), headRef = useRef(null);
  const curLineRef = useRef(null), curDotRef = useRef(null), closeRef = useRef(null);
  const [playing, setPlayingState] = useState(!reduce);
  const [soundOn, setSoundOn] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [note, setNote] = useState(false);
  const [readK, setReadK] = useState(0);
  const [cap, setCap] = useState({ key: "p0", text: P.parts[0].text });
  const [solo, setSoloState] = useState(-1);

  const E = useRef(null);
  if (!E.current) {
    E.current = {
      clock: reduce ? NET_CLOCK : 0, playing: !reduce, calm: reduce, lite: false, slow: 0, sel: -1, hover: -1, lastBeat: -1, readK: -1, capKey: "", speed: 0,
      yawOff: 0, pitchOff: 0, zoom: 1, orbit: 0, lastInteract: -1e9, down: false, moved: 0, ptrs: new Map(),
      mx: -1e4, my: -1e4, mIn: false, W: 0, H: 0, dpr: 1, pxKm: 4, bgGrad: null, audio: null, soloNorm: null, selPos: 0,
      cursorX: 0,
    };
  }
  const A = useRef({}); // latest actions for the key handler

  const setPlaying = (v) => {
    const e = E.current;
    if (v) { e.calm = false; if (e.clock > PLAY_END) { e.clock = 0; e.lastBeat = -1; } } // pressing Play is an explicit choice: run fully, from the first pass if on the ending frame
    e.playing = v; setPlayingState(v);
  };
  const setSel = (i) => { E.current.sel = i; setSoloState(i); };
  const stopSound = () => { const e = E.current; if (e.audio) { e.audio.stop(); e.audio = null; } setSoundOn(false); };
  const toggleSound = () => {
    const e = E.current;
    if (e.audio) { stopSound(); return; }
    const a = createDanceAudio({ padGain: PAD_GAIN, droneGain: DRONE_GAIN, soloGain: SOLO_GAIN, tickGain: TICK_GAIN, padBaseHz: PAD_BASE_HZ, droneBaseHz: DRONE_BASE_HZ, soloBaseHz: SOLO_BASE_HZ, tickHz: TICK_HZ, padCutoffHz: 900 });
    if (a) { e.audio = a; setSoundOn(true); }
  };
  const toggleHidden = () => setHidden((h) => { const nh = !h; if (nh) setNote(true); return nh; });
  const stepPass = (d) => {
    const e = E.current, c = e.clock;
    setPlaying(false);
    const cur = c > PLAY_END ? N - 1 : Math.round(c / PASS_SEC);
    if (d > 0) e.clock = cur >= N - 1 ? NET_CLOCK : (cur + 1) * PASS_SEC;
    else e.clock = c > PLAY_END ? PLAY_END : Math.max(0, cur - 1) * PASS_SEC;
  };
  A.current = { setPlaying, toggleSound, toggleHidden, stepPass, onClose, setSel };

  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(false), 2000); return () => clearTimeout(t); }, [note]);

  /* ---------- keyboard (captured so the page underneath never sees it) ---------- */
  useEffect(() => {
    const down = (ev) => {
      if (ev.key === "Tab" || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const k = ev.key.toLowerCase(), a = A.current, e = E.current;
      ev.stopPropagation();
      if (k === "escape") { ev.preventDefault(); if (e.sel >= 0) a.setSel(-1); else a.onClose(); }
      else if (k === " ") { ev.preventDefault(); a.setPlaying(!e.playing); }
      else if (k === "arrowright") { ev.preventDefault(); a.stepPass(1); }
      else if (k === "arrowleft") { ev.preventDefault(); a.stepPass(-1); }
      else if (k === "h") a.toggleHidden();
      else if (k === "s") a.toggleSound();
    };
    const up = (ev) => { if (ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); } };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    return () => { window.removeEventListener("keydown", down, true); window.removeEventListener("keyup", up, true); };
  }, []);

  /* ---------- focus, hidden tab, cleanup ---------- */
  useEffect(() => {
    const prev = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    const vis = () => { if (document.hidden) stopSound(); };
    document.addEventListener("visibilitychange", vis);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      const e = E.current; if (e.audio) { e.audio.stop(); e.audio = null; }
      try { prev?.focus?.({ preventScroll: true }); } catch { /* element gone */ }
    };
  }, []); // eslint-disable-line

  /* ---------- the scene ---------- */
  useEffect(() => {
    const e = E.current, canvas = canvasRef.current, glc = glRef.current, wrap = wrapRef.current;
    const ctx = canvas.getContext("2d");
    const { n, X: Xc, Y: Yc, U, H, Vm, net, hasNet, sig, anyIdx, dustOnly, kmPerM, domain } = P;
    const nAny = anyIdx.length, nDust = dustOnly.length;
    const showFps = /(^|[#&])fps=1/.test(location.hash);

    // colour bins: same ramp as the map, lifted a little so still ground is visible as glowing dots
    const binCol = [], binRGB = new Float32Array(NBINS * 3);
    for (let b = 0; b < NBINS; b++) {
      const v = ((b / (NBINS - 1)) * 2 - 1) * domain, m = Math.min(1, Math.abs(v) / domain), c = diverging(v, domain);
      const rgb = [0, 1, 2].map((k) => Math.min(255, Math.round(c[k] * 1.1 + COLOUR_LIFT * (1 - m))));
      binCol.push(`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`);
      for (let k = 0; k < 3; k++) binRGB[b * 3 + k] = rgb[k] / 255;
    }
    // buffers, allocated once. points: x, y, size, r, g, b, a. lines: x, y, r, g, b, a.
    const sxA = new Float32Array(n), syA = new Float32Array(n), alive = new Uint8Array(n);
    const dB = new Uint8Array(nAny);
    const pts = new Float32Array(nAny * 7), lines = new Float32Array(nAny * 24), dust = new Float32Array((nDust + nAny) * 7);
    const corners = new Float32Array(8), pr = new Float32Array(2);
    const halfW = P.fieldW / 2, halfH = P.fieldH / 2;
    const hd = (TRACK_HEADING_DEG * Math.PI) / 180, trkX = Math.sin(hd), trkY = Math.cos(hd);
    const uMinKm = (() => { let lo = Infinity, hi = -Infinity; for (const [x, y] of [[-halfW, -halfH], [halfW, -halfH], [halfW, halfH], [-halfW, halfH]]) { const u = x * trkX + y * trkY; lo = Math.min(lo, u); hi = Math.max(hi, u); } return [lo, hi]; })();
    const FX = [-halfW, halfW, halfW, -halfW], FY = [-halfH, -halfH, halfH, halfH];

    /* ---- WebGL: one program for lines, one for sprites; falls back to the 2D canvas if anything fails ---- */
    const VS_PT = "attribute vec2 aPos;attribute float aSize;attribute vec4 aCol;uniform vec2 uRes;uniform float uDpr;varying vec4 vCol;void main(){vec2 c=aPos/uRes*2.0-1.0;gl_Position=vec4(c.x,-c.y,0.0,1.0);gl_PointSize=aSize*uDpr;vCol=aCol;}";
    const FS_PT = "precision mediump float;varying vec4 vCol;uniform float uMode;uniform float uLite;uniform float uCore;uniform float uHalo;" +
      "void main(){float d=length(gl_PointCoord-0.5)*2.0;if(d>1.0)discard;" +
      "if(uMode>0.5){float a=vCol.a*smoothstep(1.0,0.7,d);gl_FragColor=vec4(vCol.rgb*a,a);return;}" +
      "float a;if(uLite>0.5){a=vCol.a*uCore*smoothstep(1.0,0.55,d);}else{float core=smoothstep(0.38,0.26,d);float halo=(1.0-d)*(1.0-d);a=vCol.a*(uCore*core+uHalo*halo);}" +
      "gl_FragColor=vec4(vCol.rgb*a,0.0);}";
    const VS_LN = "attribute vec2 aPos;attribute vec4 aCol;uniform vec2 uRes;varying vec4 vCol;void main(){vec2 c=aPos/uRes*2.0-1.0;gl_Position=vec4(c.x,-c.y,0.0,1.0);vCol=aCol;}";
    const FS_LN = "precision mediump float;varying vec4 vCol;void main(){gl_FragColor=vec4(vCol.rgb*vCol.a,0.0);}";
    let gl = null, G = null, glLost = false;
    const buildGL = () => {
      const g = glc.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false }) || glc.getContext("experimental-webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
      if (!g || g.isContextLost()) return null;
      const prog = (vs, fs) => {
        const mk = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error("shader"); return s; };
        const p = g.createProgram(); g.attachShader(p, mk(g.VERTEX_SHADER, vs)); g.attachShader(p, mk(g.FRAGMENT_SHADER, fs)); g.linkProgram(p);
        if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error("link");
        return p;
      };
      try {
        const pp = prog(VS_PT, FS_PT), lp = prog(VS_LN, FS_LN);
        const buf = (arr) => { const b = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, b); g.bufferData(g.ARRAY_BUFFER, arr.byteLength, g.DYNAMIC_DRAW); return b; };
        return {
          g, pp, lp, bPts: buf(pts), bLn: buf(lines), bDust: buf(dust),
          pu: { res: g.getUniformLocation(pp, "uRes"), dpr: g.getUniformLocation(pp, "uDpr"), mode: g.getUniformLocation(pp, "uMode"), lite: g.getUniformLocation(pp, "uLite"), core: g.getUniformLocation(pp, "uCore"), halo: g.getUniformLocation(pp, "uHalo") },
          pa: { pos: g.getAttribLocation(pp, "aPos"), size: g.getAttribLocation(pp, "aSize"), col: g.getAttribLocation(pp, "aCol") },
          lu: { res: g.getUniformLocation(lp, "uRes") },
          la: { pos: g.getAttribLocation(lp, "aPos"), col: g.getAttribLocation(lp, "aCol") },
        };
      } catch { return null; }
    };
    const freeGL = () => {
      if (!G) return;
      try { const g = G.g; g.deleteBuffer(G.bPts); g.deleteBuffer(G.bLn); g.deleteBuffer(G.bDust); g.deleteProgram(G.pp); g.deleteProgram(G.lp); } catch { /* context already gone */ }
      G = null;
    };
    const sizeGL = () => { if (gl) gl.viewport(0, 0, glc.width, glc.height); };
    G = buildGL();
    gl = G && G.g;
    if (!G) { e.lite = true; glc.style.display = "none"; }
    e.gl = !!G;
    const onLost = (ev) => { ev.preventDefault(); glLost = true; };
    const onRestored = () => {
      G = buildGL(); gl = G && G.g; glLost = false;
      if (!G) { e.lite = true; e.gl = false; glc.style.display = "none"; } else sizeGL();
    };
    glc.addEventListener("webglcontextlost", onLost);
    glc.addEventListener("webglcontextrestored", onRestored);

    const attr = (loc, size, stride, off) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride * 4, off * 4); };
    const drawGL = (nPts, nLn, nDustD) => {
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      if (nDustD) {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(G.pp); gl.uniform2f(G.pu.res, e.W, e.H); gl.uniform1f(G.pu.dpr, e.dpr); gl.uniform1f(G.pu.mode, 1);
        gl.bindBuffer(gl.ARRAY_BUFFER, G.bDust); gl.bufferSubData(gl.ARRAY_BUFFER, 0, dust.subarray(0, nDustD * 7));
        attr(G.pa.pos, 2, 7, 0); attr(G.pa.size, 1, 7, 2); attr(G.pa.col, 4, 7, 3);
        gl.drawArrays(gl.POINTS, 0, nDustD);
      }
      gl.blendFunc(gl.ONE, gl.ONE);
      if (nLn) {
        gl.useProgram(G.lp); gl.uniform2f(G.lu.res, e.W, e.H);
        gl.bindBuffer(gl.ARRAY_BUFFER, G.bLn); gl.bufferSubData(gl.ARRAY_BUFFER, 0, lines.subarray(0, nLn * 6));
        attr(G.la.pos, 2, 6, 0); attr(G.la.col, 4, 6, 2);
        gl.drawArrays(gl.LINES, 0, nLn);
      }
      if (nPts) {
        gl.useProgram(G.pp); gl.uniform2f(G.pu.res, e.W, e.H); gl.uniform1f(G.pu.dpr, e.dpr); gl.uniform1f(G.pu.mode, 0);
        gl.uniform1f(G.pu.lite, e.lite ? 1 : 0); gl.uniform1f(G.pu.core, DOT_ALPHA); gl.uniform1f(G.pu.halo, HALO_ALPHA * 1.4);
        gl.bindBuffer(gl.ARRAY_BUFFER, G.bPts); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pts.subarray(0, nPts * 7));
        attr(G.pa.pos, 2, 7, 0); attr(G.pa.size, 1, 7, 2); attr(G.pa.col, 4, 7, 3);
        gl.drawArrays(gl.POINTS, 0, nPts);
      }
    };
    // 2D fallback: plain dots and dust, no stems, streaks or glow
    const draw2D = (nPts, nDustD) => {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgb(168,164,156)";
      for (let d = 0; d < nDustD; d++) { ctx.globalAlpha = dust[d * 7 + 6]; ctx.fillRect(dust[d * 7] - DUST_PX / 2, dust[d * 7 + 1] - DUST_PX / 2, DUST_PX, DUST_PX); }
      ctx.globalCompositeOperation = "lighter";
      for (let d = 0; d < nPts; d++) { const o = d * 7, s = pts[o + 2]; ctx.fillStyle = binCol[dB[d]]; ctx.globalAlpha = pts[o + 6] * DOT_ALPHA; ctx.fillRect(pts[o] - s / 2, pts[o + 1] - s / 2, s, s); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    };

    // frame state shared with the projection helper
    let cyw = 1, syw = 0, sinEl = 1, cosEl = 0, pk = 4, cx = 0, cy = 0;
    const projFloor = (x, y) => {
      const x1 = x * cyw - y * syw, y1 = x * syw + y * cyw, sc = CAM_DIST_KM / (CAM_DIST_KM + y1 * cosEl);
      pr[0] = cx + x1 * sc * pk; pr[1] = cy - y1 * sinEl * sc * pk;
    };
    const ring = (i, r, a) => { ctx.strokeStyle = `rgba(236,233,226,${a})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(sxA[i], syA[i], r, 0, 6.2832); ctx.stroke(); };

    const resize = () => {
      const r = wrap.getBoundingClientRect(), dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
      e.W = Math.max(320, r.width); e.H = Math.max(320, r.height); e.dpr = dpr;
      for (const c of [canvas, glc]) { c.width = Math.round(e.W * dpr); c.height = Math.round(e.H * dpr); c.style.width = e.W + "px"; c.style.height = e.H + "px"; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeGL();
      e.pxKm = Math.min((e.W * 0.62) / FIT_W_KM, (e.H * 0.84) / FIT_H_KM);
      const g = ctx.createRadialGradient(e.W / 2, e.H * 0.5, 0, e.W / 2, e.H * 0.5, Math.max(e.W, e.H) * 0.62);
      g.addColorStop(0, "rgba(52,49,44,0.55)"); g.addColorStop(1, "rgba(22,21,20,0)");
      e.bgGrad = g;
    };
    const ro = new ResizeObserver(resize); ro.observe(wrap); resize();

    /* ---- pointer, wheel (all on the 2D canvas) ---- */
    const local = (ev) => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    const pick = (x, y) => {
      let best = -1, bd = PICK_PX * PICK_PX;
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        const dx = sxA[i] - x, dy = syA[i] - y, d2 = dx * dx + dy * dy;
        if (d2 < bd) { bd = d2; best = i; }
      }
      return best;
    };
    const touch = () => { e.lastInteract = performance.now(); };
    const onDown = (ev) => {
      const [x, y] = local(ev);
      try { canvas.setPointerCapture(ev.pointerId); } catch { /* ok */ }
      e.ptrs.set(ev.pointerId, { x, y });
      if (e.ptrs.size === 1) { e.down = true; e.moved = 0; }
      touch();
    };
    const onMove = (ev) => {
      const [x, y] = local(ev);
      e.mx = x; e.my = y; e.mIn = true; e.hoverDirty = true;
      const p = e.ptrs.get(ev.pointerId);
      if (!p) return;
      if (e.ptrs.size === 1) {
        const dx = x - p.x, dy = y - p.y;
        e.moved += Math.abs(dx) + Math.abs(dy);
        if (e.moved > 5) { e.yawOff += dx * 0.35; e.pitchOff = clamp(e.pitchOff + dy * 0.25, PITCH_MIN - PITCH_BASE, PITCH_MAX - PITCH_BASE); }
      } else if (e.ptrs.size === 2) {
        let other = null;
        for (const [id, q] of e.ptrs) if (id !== ev.pointerId) other = q;
        if (other) {
          const d0 = Math.hypot(p.x - other.x, p.y - other.y), d1 = Math.hypot(x - other.x, y - other.y);
          if (d0 > 8) e.zoom = clamp(e.zoom * (d1 / d0), ZOOM_MIN, ZOOM_MAX);
        }
        e.moved = 99;
      }
      p.x = x; p.y = y; touch();
    };
    const onUp = (ev) => {
      const wasClick = e.ptrs.size === 1 && e.moved <= 5 && ev.type === "pointerup";
      e.ptrs.delete(ev.pointerId);
      if (e.ptrs.size === 0) e.down = false;
      touch();
      if (wasClick) { const [x, y] = local(ev); A.current.setSel(pick(x, y)); }
    };
    const onLeave = () => { e.mIn = false; e.hoverDirty = true; };
    const onWheel = (ev) => { ev.preventDefault(); e.zoom = clamp(e.zoom * Math.exp(-ev.deltaY * 0.0012), ZOOM_MIN, ZOOM_MAX); touch(); };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    wrap.addEventListener("wheel", onWheel, { passive: false });

    /* ---- the frame ---- */
    let raf = 0, last = 0, audioAt = 0, fc = 0, fpsAt = 0, fpsN = 0, lastProg = -1, lastCx = -1;
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) { last = 0; return; }
      const raw = last ? now - last : 0;
      const dt = last ? Math.min(0.1, raw / 1000) : 0; last = now; fc++;
      // adaptive quality: if frames take too long for a while, drop the glow and streaks (the cheap core dots stay)
      if (raw > 0 && raw < 400) { e.slow += ((raw > LITE_FRAME_MS ? 1 : 0) - e.slow) * 0.04; if (!e.lite && e.slow > 0.6) e.lite = true; }
      if (showFps) {
        fpsN++;
        if (now - fpsAt > 500) { if (fpsRef.current && fpsAt) fpsRef.current.textContent = `${Math.round((fpsN * 1000) / (now - fpsAt))} fps, ${e.gl && !glLost ? "gl" : "2d"}${e.lite ? ", lite" : ""}. `; fpsAt = now; fpsN = 0; }
      }
      const W = e.W, Hh = e.H, N1 = N - 1;

      // clock and phases
      if (e.playing && dt) { e.clock += dt; if (e.clock >= LOOP) e.clock -= LOOP; }
      e.speed += ((e.playing ? 1 : 0) - e.speed) * Math.min(1, dt * 6);
      const c = e.clock;
      let t, em = 0, q = 0;
      if (c <= PLAY_END) t = c / PASS_SEC;
      else {
        t = N1;
        if (c > T1) { if (c < T2) em = ease((c - T1) / END_MORPH_SEC); else if (c < T3) em = 1; else { q = ease((c - T3) / END_RETURN_SEC); em = 1 - q; } }
      }
      const inEnd = c > T1;

      // beat
      const bk = c <= PLAY_END ? Math.min(N1, Math.floor(c / PASS_SEC + 1e-6)) : N1;
      const bp = c - bk * PASS_SEC;
      if (bk !== e.lastBeat) { if (e.playing && e.lastBeat !== -1) e.audio?.tick(); e.lastBeat = bk; }
      const beatOn = e.playing && bp < SWEEP_SEC + 0.5 && c <= PLAY_END + SWEEP_SEC + 0.5;
      const sweepS = -0.06 + (bp / SWEEP_SEC) * 1.3; // 0 = south edge, 1 = north edge (the track heads north)

      // readout, caption, progress (React state only changes a few times a loop)
      const rk = Math.min(N1, Math.floor(t + 1e-6));
      if (rk !== e.readK) { e.readK = rk; setReadK(rk); }
      const key = inEnd ? "end" : "p" + (t < P.parts[1].start ? 0 : t < P.parts[2].start ? 1 : 2);
      if (key !== e.capKey) {
        e.capKey = key;
        setCap({ key, text: key === "end" ? `After ${P.monthsText} months: ${P.nSig.toLocaleString("en-US")} of ${P.mNet.toLocaleString("en-US")} measured cells ended lower than they started, beyond the uncertainty.` : P.parts[+key[1]].text });
      }
      const prog = Math.round(Math.min(1, t / N1) * 2000) / 20;
      if (prog !== lastProg) {
        lastProg = prog;
        if (fillRef.current) fillRef.current.style.width = prog + "%";
        if (headRef.current) headRef.current.style.left = prog + "%";
      }

      // camera
      const interacting = e.down || now - e.lastInteract < ORBIT_RESUME_SEC * 1000;
      if (!e.calm && !interacting) {
        e.orbit += (dt * 2 * Math.PI) / ORBIT_PERIOD_SEC;
        const k = Math.exp(-dt / 2.2); e.yawOff *= k; e.pitchOff *= k;
      }
      const yaw = ((YAW_BASE + (e.calm ? 0 : YAW_SWING * Math.sin(e.orbit)) + e.yawOff) * Math.PI) / 180;
      const pitch = (clamp(PITCH_BASE - PITCH_END_DROP * em + e.pitchOff, PITCH_MIN, PITCH_MAX) * Math.PI) / 180;
      cyw = Math.cos(yaw); syw = Math.sin(yaw); sinEl = Math.sin(pitch); cosEl = Math.cos(pitch);
      pk = e.pxKm * e.zoom; cx = W / 2; cy = Hh * 0.5;

      // 2D layer: background, floor, grid, outline
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, Hh);
      ctx.fillStyle = e.bgGrad; ctx.fillRect(0, 0, W, Hh);
      for (let k = 0; k < 4; k++) { projFloor(FX[k], FY[k]); corners[k * 2] = pr[0]; corners[k * 2 + 1] = pr[1]; }
      ctx.beginPath(); ctx.moveTo(corners[0], corners[1]); ctx.lineTo(corners[2], corners[3]); ctx.lineTo(corners[4], corners[5]); ctx.lineTo(corners[6], corners[7]); ctx.closePath();
      ctx.fillStyle = "rgba(236,233,226,0.018)"; ctx.fill();
      ctx.strokeStyle = "rgba(236,233,226,0.055)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let g = 1; g < 10; g++) {
        const fx = -halfW + (P.fieldW * g) / 10, fy = -halfH + (P.fieldH * g) / 10;
        projFloor(fx, -halfH); ctx.moveTo(pr[0], pr[1]); projFloor(fx, halfH); ctx.lineTo(pr[0], pr[1]);
        projFloor(-halfW, fy); ctx.moveTo(pr[0], pr[1]); projFloor(halfW, fy); ctx.lineTo(pr[0], pr[1]);
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(236,233,226,0.2)"; ctx.beginPath(); ctx.moveTo(corners[0], corners[1]); ctx.lineTo(corners[2], corners[3]); ctx.lineTo(corners[4], corners[5]); ctx.lineTo(corners[6], corners[7]); ctx.closePath(); ctx.stroke();

      // the radar swath: one thin bright line across the floor, along the track direction
      if (beatOn && sweepS > -0.04 && sweepS < 1.04) {
        const u = uMinKm[0] + sweepS * (uMinKm[1] - uMinKm[0]), L = 200, px = trkY, py = -trkX;
        ctx.save();
        ctx.beginPath(); ctx.moveTo(corners[0], corners[1]); ctx.lineTo(corners[2], corners[3]); ctx.lineTo(corners[4], corners[5]); ctx.lineTo(corners[6], corners[7]); ctx.closePath(); ctx.clip();
        projFloor(u * trkX - px * L, u * trkY - py * L); const ax = pr[0], ay = pr[1];
        projFloor(u * trkX + px * L, u * trkY + py * L);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(pr[0], pr[1]);
        ctx.strokeStyle = "rgba(236,233,226,0.07)"; ctx.lineWidth = 16; ctx.stroke();
        ctx.strokeStyle = "rgba(236,233,226,0.16)"; ctx.lineWidth = 5; ctx.stroke();
        ctx.strokeStyle = "rgba(236,233,226,0.8)"; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.restore();
      }

      // pass indices for the current time and for the streak behind it
      let k0 = Math.floor(t), f;
      if (k0 >= N1) { k0 = N - 2; f = 1; } else f = t - k0;
      const f2 = f * f, f3 = f2 * f;
      const k1 = k0 + 1;
      const trailOn = !e.calm && !e.lite && e.speed > 0.02 && !inEnd;
      const stemsOn = !e.lite;
      const tp = Math.max(0, t - TRAIL_PASSES * e.speed);
      let kp0 = Math.floor(tp), fp;
      if (kp0 >= N1) { kp0 = N - 2; fp = 1; } else fp = tp - kp0;
      const glOn = !!G && !glLost;
      const lineGain = Math.min(2, e.dpr), sizeMul = e.lite ? 1.6 : 3;

      const sel = e.sel, kLift = kmPerM;
      let nDraw = 0, nDustD = 0, nLn = 0, selPos = e.selPos;

      for (let j = 0; j < nDust; j++) {
        const i = dustOnly[j];
        const x1 = Xc[i] * cyw - Yc[i] * syw, y1 = Xc[i] * syw + Yc[i] * cyw, sc0 = CAM_DIST_KM / (CAM_DIST_KM + y1 * cosEl);
        const o = nDustD++ * 7;
        dust[o] = cx + x1 * sc0 * pk; dust[o + 1] = cy - y1 * sinEl * sc0 * pk; dust[o + 2] = DUST_PX * 1.6; dust[o + 3] = 0.66; dust[o + 4] = 0.64; dust[o + 5] = 0.61; dust[o + 6] = DUST_ALPHA;
      }

      for (let j = 0; j < nAny; j++) {
        const i = anyIdx[j], b = i * N;
        const x1 = Xc[i] * cyw - Yc[i] * syw, y1 = Xc[i] * syw + Yc[i] * cyw;
        const dz0 = y1 * cosEl, sc0 = CAM_DIST_KM / (CAM_DIST_KM + dz0);
        const fx = cx + x1 * sc0 * pk, fy = cy - y1 * sinEl * sc0 * pk;
        alive[i] = 0;
        const a0 = H[b + k0], a1 = H[b + k1];
        if (a0 !== a0 || a1 !== a1) { const o = nDustD++ * 7; dust[o] = fx; dust[o + 1] = fy; dust[o + 2] = DUST_PX * 1.6; dust[o + 3] = 0.66; dust[o + 4] = 0.64; dust[o + 5] = 0.61; dust[o + 6] = DUST_ALPHA; continue; } // no value yet: dust on the floor
        let am = k0 > 0 ? H[b + k0 - 1] : a0, a2 = k1 < N1 ? H[b + k1 + 1] : a1;
        if (am !== am) am = a0; if (a2 !== a2) a2 = a1;
        let p = 0.5 * (2 * a0 + (a1 - am) * f + (2 * am - 5 * a0 + 4 * a1 - a2) * f2 + (3 * a0 - am - 3 * a1 + a2) * f3);
        const w = Vm[b + k0] * (1 - f) + Vm[b + k1] * f;
        let al = DIM_ALPHA + (1 - DIM_ALPHA) * w, vc = p;
        if (em > 0 || q > 0) {
          if (hasNet[i]) {
            p += (net[i] - p) * em;
            if (sig[i]) al *= 1 + (END_LIT - 1) * em;
            else { al *= 1 - em * (1 - END_DIM); vc = p * (1 - 0.85 * em); }
            vc = sig[i] ? p : vc;
          } else {
            al *= 1 - em;
            const o = nDustD++ * 7; dust[o] = fx; dust[o + 1] = fy; dust[o + 2] = DUST_PX * 1.6; dust[o + 3] = 0.66; dust[o + 4] = 0.64; dust[o + 5] = 0.61; dust[o + 6] = DUST_ALPHA * em;
          }
          if (q > 0) { p *= 1 - q; vc = p; }
        } else vc = p;
        if (i === sel) selPos = p;
        const z = p * kLift, dz = y1 * cosEl - z * sinEl, sc = CAM_DIST_KM / (CAM_DIST_KM + dz);
        const sx = cx + x1 * sc * pk, sy = cy - (y1 * sinEl + z * cosEl) * sc * pk;
        if (sel >= 0 && i !== sel) al *= SOLO_DIM;
        let g = 0;
        if (beatOn) {
          const d = sweepS - U[i];
          g = d >= 0 ? Math.exp(-d / 0.1) : Math.exp(-(d * d) / 0.0016);
          al *= 1 + BEAT_BOOST * g;
        }
        if (al > 1) al = 1;
        if (al < 0.01) continue;
        const bin = Math.round((clamp(vc / domain, -1, 1) * 0.5 + 0.5) * (NBINS - 1));
        sxA[i] = sx; syA[i] = sy; alive[i] = 1;
        const size = DOT_PX * clamp(sc, 0.8, 1.35) * (1 + 0.3 * g), o = nDraw * 7;
        pts[o] = sx; pts[o + 1] = sy; pts[o + 2] = glOn ? size * sizeMul : size; pts[o + 3] = binRGB[bin * 3]; pts[o + 4] = binRGB[bin * 3 + 1]; pts[o + 5] = binRGB[bin * 3 + 2]; pts[o + 6] = al;
        dB[nDraw++] = bin;
        if (!glOn) continue;
        // stem: floor to dot
        if (stemsOn && (sy - fy > 1.5 || fy - sy > 1.5)) {
          const a = STEM_ALPHA * lineGain;
          const l = nLn * 6; nLn += 2;
          lines[l] = fx; lines[l + 1] = fy; lines[l + 2] = 0.745; lines[l + 3] = 0.714; lines[l + 4] = 0.659; lines[l + 5] = a;
          lines[l + 6] = sx; lines[l + 7] = sy; lines[l + 8] = 0.745; lines[l + 9] = 0.714; lines[l + 10] = 0.659; lines[l + 11] = a;
        }
        // streak: from where the dot was a moment ago (fades toward the tail)
        if (trailOn) {
          const h0 = H[b + kp0], h1 = H[b + kp0 + 1];
          if (h0 === h0 && h1 === h1) {
            const pp = h0 + (h1 - h0) * fp, zp = pp * kLift;
            if (Math.abs(pp - p) * kLift * pk > 1.2) {
              const dzp = y1 * cosEl - zp * sinEl, scp = CAM_DIST_KM / (CAM_DIST_KM + dzp);
              const down = pp > p; // was higher = it is sinking
              const r = down ? 0.882 : 0.275, gg = down ? 0.431 : 0.588, bb = down ? 0.216 : 0.843, a = TRAIL_ALPHA * 1.6 * lineGain;
              const l = nLn * 6; nLn += 2;
              lines[l] = cx + x1 * scp * pk; lines[l + 1] = cy - (y1 * sinEl + zp * cosEl) * scp * pk; lines[l + 2] = r; lines[l + 3] = gg; lines[l + 4] = bb; lines[l + 5] = 0;
              lines[l + 6] = sx; lines[l + 7] = sy; lines[l + 8] = r; lines[l + 9] = gg; lines[l + 10] = bb; lines[l + 11] = a;
            }
          }
        }
      }
      e.selPos = selPos;

      // hover (only when the mouse or the picture moved) and solo rings, on the 2D layer
      if (e.mIn && !e.down) {
        if (e.hoverDirty || (fc % 3 === 0 && (e.playing || !e.calm))) {
          e.hoverDirty = false;
          const hv = pick(e.mx, e.my);
          if (hv !== e.hover) { e.hover = hv; canvas.style.cursor = hv >= 0 ? "pointer" : "grab"; }
        }
      } else if (e.hover !== -1) { e.hover = -1; canvas.style.cursor = "grab"; }
      if (e.hover >= 0 && e.hover !== sel && alive[e.hover]) ring(e.hover, 9, 0.7);
      if (sel >= 0 && alive[sel]) {
        ring(sel, 10, 0.95);
        ctx.strokeStyle = "rgba(236,233,226,0.35)"; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(sxA[sel], syA[sel] - Hh * 0.28); ctx.lineTo(sxA[sel], syA[sel] + Hh * 0.28); ctx.stroke();
      }

      // the heavy drawing
      if (glOn) drawGL(nDraw, nLn, nDustD); else draw2D(nDraw, nDustD);

      // chart cursor in the solo panel
      if (sel >= 0 && curLineRef.current) {
        const x = Math.round((8 + (Math.min(t, N1) / N1) * 284) * 10) / 10;
        if (x !== lastCx) {
          lastCx = x;
          curLineRef.current.setAttribute("x1", x); curLineRef.current.setAttribute("x2", x);
          if (curDotRef.current) { curDotRef.current.setAttribute("cx", x); curDotRef.current.setAttribute("cy", 8 + 32 - (clamp(selPos / (e.chartSpan || 0.05), -1, 1)) * 32); }
        }
      }

      // sound follows the ground
      if (e.audio && now - audioAt > 90) {
        audioAt = now;
        const mk = Math.min(N1 - 1e-6, t), mi = Math.floor(mk), mf = ease(mk - mi);
        const mean = P.meanSeries[mi] + (P.meanSeries[mi + 1] - P.meanSeries[mi]) * mf;
        const share = P.shareSeries[mi] + (P.shareSeries[mi + 1] - P.shareSeries[mi]) * mf;
        e.audio.update({ level: e.speed, pad: clamp((mean - P.meanLo) / (P.meanHi - P.meanLo || 1), 0, 1), drone: clamp(share, 0, 1), solo: sel >= 0 ? clamp(selPos / (2 * domain) + 0.5, 0, 1) : null });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave); wrap.removeEventListener("wheel", onWheel);
      glc.removeEventListener("webglcontextlost", onLost); glc.removeEventListener("webglcontextrestored", onRestored);
      freeGL();
    };
  }, [P]); // eslint-disable-line

  /* ---------- track scrubbing ---------- */
  const scrub = (ev) => {
    const r = trackRef.current.getBoundingClientRect(), f = clamp((ev.clientX - r.left) / r.width, 0, 1);
    setPlaying(false);
    E.current.clock = f > 0.995 ? NET_CLOCK : f * PLAY_END;
  };
  const onTrackDown = (ev) => { ev.currentTarget.setPointerCapture(ev.pointerId); scrub(ev); };
  const onTrackMove = (ev) => { if (ev.buttons) scrub(ev); };

  /* ---------- solo panel data ---------- */
  const spot = useMemo(() => {
    if (solo < 0) return null;
    const v = D.values[solo] || [], ok = v.filter((x) => x != null);
    const span = Math.max(0.02, ...ok.map(Math.abs));
    E.current.chartSpan = span;
    const b = cellBounds(D, solo);
    let path = "", open = false;
    v.forEach((x, k) => { if (x == null) { open = false; return; } path += `${open ? "L" : "M"}${(8 + (k / (N - 1)) * 284).toFixed(1)},${(40 - (x / span) * 32).toFixed(1)}`; open = true; });
    const pts = v.map((x, k) => (x == null ? null : [8 + (k / (N - 1)) * 284, 40 - (x / span) * 32]));
    const netM = D.grid.net_change_m[solo];
    return { span, path, pts, netM, label: `${Math.abs(b.lat).toFixed(3)}° ${b.lat >= 0 ? "N" : "S"}, ${Math.abs(b.lng).toFixed(3)}° ${b.lng >= 0 ? "E" : "W"}` };
  }, [solo, D, N]);

  const inEndCaption = cap.key === "end";
  const maturity = D.meta.product_maturity ? D.meta.product_maturity[0].toUpperCase() + D.meta.product_maturity.slice(1) : "Provisional";
  const ui = `transition-opacity duration-500 ${hidden ? "opacity-0 pointer-events-none" : "opacity-100"}`;
  const btn = "pointer-events-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-hair-2 bg-space/70 backdrop-blur px-3 py-2 text-[14px] text-ink/90 hover:border-accent/60 hover:text-ink transition";

  return (
    <div ref={wrapRef} role="dialog" aria-modal="true" aria-label="The dance" data-lenis-prevent
      className="fixed inset-0 z-[70] bg-space text-ink overflow-hidden select-none">
      <canvas ref={canvasRef} role="img" tabIndex={-1} style={{ touchAction: "none", cursor: "grab" }} className="absolute inset-0 outline-none"
        aria-label={`Animated 3D view of ${P.anyIdx.length.toLocaleString("en-US")} one-square-kilometre cells of the San Joaquin Valley. Each point's height is how far the ground moved relative to the first of ${N} NISAR radar passes, from ${fmtDate(D.dates[0])} to ${fmtDate(D.dates[N - 1])}. Heights are exaggerated.`} />
      <canvas ref={glRef} aria-hidden="true" className="pointer-events-none absolute inset-0" />

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-5 md:p-7">
        <div className={`flex items-start justify-between gap-4 ${ui}`}>
          <div className="max-w-[420px]">
            <h2 className="font-display font-bold text-[clamp(30px,3.4vw,46px)] leading-none tracking-[-0.01em]">The dance</h2>
            <p className="text-[14.5px] leading-snug text-ink/75 mt-3">Each point is one square kilometre of the San Joaquin Valley. Its height is how far the ground moved, measured by NISAR on {N} passes.</p>
            <div className="mt-5 w-[220px]" aria-label="Colour key">
              <div className="h-2 rounded-full" style={{ background: legendGradient() }} />
              <div className="flex justify-between text-[11.5px] text-mute mt-1"><span>Sinking</span><span>Still</span><span>Rising</span></div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex flex-wrap justify-end gap-1.5">
              <button type="button" onClick={toggleSound} aria-pressed={soundOn} title="Sound (S)" className={`${btn} ${soundOn ? "border-accent/60 text-accent-2" : ""}`}>
                {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />} Sound
              </button>
              <button type="button" onClick={toggleHidden} title="Hide controls (H)" className={btn}><EyeOff size={15} /> Hide controls</button>
              <button ref={closeRef} type="button" onClick={onClose} title="Close (Esc)" className={btn}><X size={15} /> Close</button>
            </div>
            <div className="text-right mt-2" aria-hidden="true">
              <p className="font-mono text-[13px] text-mute">{inEndCaption ? "Net change" : `Pass ${readK + 1} of ${N}`}</p>
              <p className="font-display font-semibold text-[clamp(22px,2.4vw,32px)] leading-tight">{inEndCaption ? `${fmtDate(D.dates[0])} to ${fmtDate(D.dates[N - 1])}` : fmtDate(D.dates[readK])}</p>
            </div>
          </div>
        </div>

        <div className={ui}>
          <div className="flex items-end justify-between gap-6">
            <p key={cap.key} aria-live="polite" className="font-display text-[clamp(19px,2vw,28px)] leading-snug max-w-[min(640px,55vw)] [animation:rise-in_.7s_both]">{cap.text}</p>
            {spot && (
              <div className="pointer-events-auto w-[316px] shrink-0 rounded-lg border border-hair-2 bg-space/85 backdrop-blur p-3 max-sm:hidden">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[12px] text-mute">Selected point</p>
                  <p className="font-mono text-[12px] text-ink/85">{spot.label}</p>
                </div>
                <svg viewBox="0 0 300 80" className="chart w-full h-[84px] mt-2" role="img" aria-label="Position of this point on each pass, in centimetres">
                  <line className="zero" x1="8" x2="292" y1="40" y2="40" />
                  <path d={spot.path} fill="none" stroke="var(--color-ink)" strokeWidth="1.5" opacity="0.8" />
                  {spot.pts.map((p, k) => p && <circle key={k} cx={p[0]} cy={p[1]} r="1.8" fill="var(--color-ink)" />)}
                  <line ref={curLineRef} className="cursor" x1="8" x2="8" y1="4" y2="76" strokeWidth="1.2" opacity="0.8" />
                  <circle ref={curDotRef} cx="8" cy="40" r="3.4" fill="var(--color-accent)" />
                  <text x="10" y="10">+{(spot.span * 100).toFixed(0)} cm</text>
                  <text x="10" y="78">−{(spot.span * 100).toFixed(0)} cm</text>
                </svg>
                <p className="text-[13px] mt-1">{spot.netM != null ? <>Net change <span className="font-mono">{cm(spot.netM)}</span></> : "Not every pass was measured here, so there is no net change."}</p>
                <button type="button" onClick={() => onOpenSpot?.(solo)} className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent text-space font-semibold text-[13.5px] px-3 py-2 hover:bg-accent-2 transition">
                  Open this spot on the map <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>

          <div className="pointer-events-auto flex items-center gap-3 mt-3">
            <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause" : "Play"} title="Play or pause (Space)"
              className="shrink-0 w-9 h-9 grid place-items-center rounded-full border border-hair-2 bg-space/70 hover:border-accent/60 transition">
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <div ref={trackRef} role="slider" tabIndex={0} aria-label="Radar pass" aria-valuemin={1} aria-valuemax={N} aria-valuenow={readK + 1} aria-valuetext={`Pass ${readK + 1} of ${N}, ${fmtDate(D.dates[readK])}`}
              onPointerDown={onTrackDown} onPointerMove={onTrackMove} className="relative flex-1 h-9 cursor-pointer touch-none">
              <div className="absolute inset-x-0 top-1/2 h-px bg-hair-2" />
              <div ref={fillRef} className="absolute left-0 top-1/2 h-px bg-accent" style={{ width: "0%" }} />
              {Array.from({ length: N }, (_, k) => <span key={k} className="absolute top-1/2 w-px h-2.5 -translate-y-1/2 bg-ink/35" style={{ left: `${(k / (N - 1)) * 100}%` }} />)}
              <span ref={headRef} className="absolute top-1/2 w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_10px_rgba(157,176,138,.7)]" style={{ left: "0%" }} />
            </div>
          </div>

          <p className="mt-2 text-[11.5px] leading-snug text-mute max-w-[1100px]">
            {D.synthetic && <span className="inline-flex items-center gap-1 mr-2 rounded-full border border-sink/60 bg-sink/10 px-2 py-0.5 text-sink font-medium">Synthetic preview: sample data, not NASA measurements.</span>}
            {/(^|[#&])fps=1/.test(location.hash) && <span ref={fpsRef} className="font-mono text-accent-2 mr-1" />}
            Heights exaggerated ×{P.exag.toLocaleString("en-US")}. Movement between the {N} measured passes is interpolated for display. Grey points: no reliable measurement. Dimmer points: some passes missing, last value held. {maturity} NISAR data, relative to GPS station {D.meta.reference_station || "P304"}.
          </p>
        </div>
      </div>

      <div onPointerEnter={() => hidden && setHidden(false)} className={`absolute top-0 inset-x-0 h-10 ${hidden ? "" : "pointer-events-none"}`} aria-hidden="true" />
      <p role="status" className={`pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 rounded-md bg-space/80 border border-hair-2 px-3 py-1.5 text-[13px] text-ink/85 transition-opacity duration-500 ${hidden && note ? "opacity-100" : "opacity-0"}`}>Press H to show controls</p>
    </div>
  );
}
