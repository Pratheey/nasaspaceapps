import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, GitCompareArrows, Satellite, Volume2, VolumeX, Sparkles, LineChart, CalendarRange, ShieldCheck } from "lucide-react";
import Chart, { ChartKey } from "./Chart.jsx";
import Gauge from "./Gauge.jsx";
import PairMatrix from "./PairMatrix.jsx";
import SeasonClock from "./SeasonClock.jsx";
import { cellBounds, fitAt, pairDiff, mostMisleadingPair } from "../lib/data.js";
import { cm, mm, pm, fmtShort, MONTH_NAMES } from "../lib/fmt.js";
import { LABEL_COLORS, rgb } from "../lib/colors.js";

const LABEL_TEXT = { 0: "text-mute", 1: "text-sink", 2: "text-rise", 3: "text-violet" };

function Section({ title, children, aside }) {
  return (
    <section className="border-t border-hair pt-4 mt-5">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="font-display text-[17px] font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

const Tool = ({ icon: Icon, children, ...p }) => (
  <button {...p} className="inline-flex items-center gap-1.5 text-[13.5px] text-ink/85 hover:text-accent-2 px-2 py-1 rounded-md hover:bg-deck-2 border border-transparent hover:border-hair">
    <Icon size={14} className="text-accent" /> {children}
  </button>
);

export default function Inspector({ D, S, set, actions, stationAt, placeName }) {
  const scroller = useRef(null);
  const last = useRef(-1);
  useEffect(() => { if (last.current !== S.sel && scroller.current) scroller.current.scrollTop = 0; last.current = S.sel; }, [S.sel]);

  return (
    <aside ref={scroller} aria-label="Selected spot" className="scroll-thin overflow-y-auto h-full px-6 pt-5 pb-12">
      {S.sel < 0 ? <Overview D={D} actions={actions} /> : <Spot {...{ D, S, set, actions, stationAt, placeName }} />}
    </aside>
  );
}

// Animates a number toward its new value (skipped for reduced motion).
function useCountUp(target, ms = 700) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (target == null || !isFinite(target) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    const a = from.current ?? 0, t0 = performance.now();
    let raf;
    const step = (now) => { const k = Math.min(1, (now - t0) / ms); const e = 1 - Math.pow(1 - k, 3); setV(a + (target - a) * e); if (k < 1) raf = requestAnimationFrame(step); else from.current = target; };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const TABS = [["record", "The record", LineChart], ["dates", "Two dates", CalendarRange], ["evidence", "Evidence", ShieldCheck]];

function Spot({ D, S, set, actions, stationAt, placeName }) {
  const [tab, setTab] = useState("record");
  useEffect(() => { if (S.mode === "pair") setTab("dates"); }, [S.mode, S.k1, S.k2]);
  const i = S.sel, G = D.grid, cb = cellBounds(D, i);
  const st = stationAt(i);
  const sig = G.seasonal_significant[i] === true;
  const v = D.values[i] || [];
  const gps = S.gps && st?.gps ? { dates: st.gps.dates.map((s) => new Date(s + "T00:00:00Z")), los: st.gps.los_m } : null;
  const compare = S.pin >= 0 && S.pin !== i ? { values: D.values[S.pin] || [], label: placeName(S.pin) } : null;
  const d12 = pairDiff(D, i, S.k1, S.k2);
  const days = Math.round((D.dates[S.k2] - D.dates[S.k1]) / 864e5);
  const expected = G.trend_m_per_yr[i] == null ? null : G.trend_m_per_yr[i] * (days / 365.25);
  const lie = mostMisleadingPair(D, i);
  const cursor = S.listenK ?? (S.mode === "breathe" ? S.cursor : null);
  const pairs = D.meta.pairs || [];
  const L = G.label[i];
  const net = useCountUp(G.net_change_m[i]);

  return (
    <div key={i} className="[animation:rise-in_.45s_cubic-bezier(.2,.7,.2,1)_both]">
      <button onClick={actions.clearSel} className="inline-flex items-center gap-1.5 text-[13px] text-mute hover:text-accent-2 mb-3">
        <ArrowLeft size={14} /> Back to the overview
      </button>
      <p className="text-[13px] text-mute flex items-center gap-1.5">
        {st && <><Satellite size={13} className="text-accent" /> GPS station {st.station}{st.role === "reference" ? " (reference)" : ""}, </>}
        {cb.lat.toFixed(3)}° N, {Math.abs(cb.lng).toFixed(3)}° W
      </p>
      <h2 className={`font-display text-[25px] leading-tight font-semibold mt-1 ${LABEL_TEXT[L]}`}>{D.meta.labels[String(L)]}</h2>

      <div className="grid grid-cols-[128px_1fr] gap-4 mt-4 items-start">
        <Gauge dates={D.dates} values={v} cursor={cursor ?? D.dates.length - 1} />
        <dl className="divide-y divide-hair">
          <div className="pb-3">
            <dt className="text-[13px] text-mute">Change, first to last date</dt>
            <dd className="font-display font-bold text-[42px] leading-none mt-1 tracking-tight" style={{ color: G.net_change_m[i] < 0 ? "#F0705A" : "#E6EAF2", textShadow: G.net_change_m[i] < 0 ? "0 0 22px rgba(240,112,90,.35)" : "none" }}>{cm(net)}</dd>
            <dd className="text-[12.5px] text-mute mt-1">{pm(G.net_change_sigma_m[i])}</dd>
          </div>
          <div className="py-3">
            <dt className="text-[13px] text-mute">Seasonal movement</dt>
            {sig ? (
              <>
                <dd className="text-[16px]">{mm(G.amp_m[i])} up and down</dd>
                <dd className="text-[12.5px] text-mute">{pm(G.amp_sigma_m[i], "mm")}, highest in {MONTH_NAMES[(G.peak_month[i] || 1) - 1]}</dd>
              </>
            ) : <dd className="text-[15px] text-mute">Not significant here</dd>}
          </div>
          <div className="pt-3">
            <dt className="text-[13px] text-mute">Fitted trend</dt>
            <dd className="text-[16px]">{G.trend_m_per_yr[i] == null ? "no value" : `${cm(G.trend_m_per_yr[i])} a year`}</dd>
            <dd className="text-[12.5px] text-mute">{pm(G.trend_sigma_m_per_yr[i])}. Less than a year of data, so never the headline.</dd>
          </div>
        </dl>
      </div>

      <div role="tablist" aria-label="Details" className="sticky -top-5 z-10 -mx-6 px-6 pt-3 pb-0 mt-5 bg-[#141b29]/95 backdrop-blur border-b border-hair flex gap-1">
        {TABS.map(([id, name, Icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`relative inline-flex items-center gap-1.5 px-3 pb-2.5 pt-1 text-[14px] font-medium transition-colors ${tab === id ? "text-accent-2" : "text-mute hover:text-ink"}`}>
            <Icon size={14} /> {name}
            {tab === id && <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-accent shadow-[0_0_8px_#6FA8FF]" />}
          </button>
        ))}
      </div>

      <div key={tab} className="[animation:rise-in_.35s_both]">
      {tab === "record" && <>
      <Section title="Every measurement here" aside={
        <label className="inline-flex items-center gap-2 text-[13px] text-ink/85 cursor-pointer">
          <input type="checkbox" checked={S.split} onChange={(e) => set({ split: e.target.checked })} className="accent-[#6FA8FF] w-4 h-4" />
          Split trend and seasonal
        </label>}>
        <Chart dates={D.dates} values={v} tYears={D.tYears} fit={(t) => fitAt(D, i, t)} split={S.split} gps={gps} compare={compare}
          pair={S.mode === "pair" ? [S.k1, S.k2] : null} cursor={cursor} seasonalSig={sig}
          onPickDate={(k) => actions.scrubTo(k)} />
        <ChartKey split={S.split} gps={gps} seasonalSig={sig} compare={compare} />
        <div className="flex flex-wrap gap-1 mt-2 -ml-2">
          <Tool icon={S.listenK != null ? VolumeX : Volume2} onClick={actions.toggleListen}>{S.listenK != null ? "Stop" : "Listen to this spot"}</Tool>
          {compare
            ? <Tool icon={GitCompareArrows} onClick={() => actions.setPin(-1)}>Stop comparing</Tool>
            : <Tool icon={GitCompareArrows} onClick={() => set({ awaitPin: true })}>Compare with another spot</Tool>}
          <Tool icon={Download} onClick={actions.csv}>Download the numbers</Tool>
        </div>
        {S.awaitPin && <p className="mt-2 text-[13.5px] rounded-md border border-accent/40 bg-accent/10 px-3 py-2">Now click another spot on the map to compare it with this one.</p>}
        <p className="text-[13px] text-mute mt-3">Click the chart to jump the map to that date.</p>
      </Section>
      <Section title="The year as a circle">
        <SeasonClock D={D} i={i} />
      </Section>
      </>}

      {tab === "dates" && <>
      <Section title="Two dates">
        <p className="text-[14.5px] leading-relaxed">
          From {fmtShort(D.dates[S.k1])} to {fmtShort(D.dates[S.k2])} ({days} days) this spot moved <strong className="text-ink">{cm(d12)}</strong>.
          {expected != null && <> The fitted trend over the same {days} days is {cm(expected)}.</>}
        </p>
        {lie ? (
          <div className="mt-3 rounded-lg border border-accent/35 bg-gradient-to-br from-accent/10 to-transparent p-3.5">
            <p className="text-[14.5px] leading-relaxed">
              Pick the wrong two dates and this spot looks {lie.diff >= 0 ? "like it rose" : "stable"}: {fmtShort(D.dates[lie.k1])} to {fmtShort(D.dates[lie.k2])} shows <strong>{cm(lie.diff)}</strong>, while the trend says {cm(lie.expected)}.
            </p>
            <button onClick={() => actions.showPair(lie.k1, lie.k2)} className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-accent text-space font-semibold text-sm px-3 py-1.5 hover:bg-accent-2">
              <Sparkles size={14} /> Show me those two dates
            </button>
          </div>
        ) : <p className="text-[14px] text-mute mt-2">No two dates here hide the sinking by more than the measurement uncertainty.</p>}
        <h4 className="font-display text-[15.5px] font-semibold mt-5 mb-2">Every pair of dates at this spot</h4>
        <PairMatrix D={D} i={i} k1={S.k1} k2={S.k2} onPick={actions.showPair} />
      </Section>
      </>}

      {tab === "evidence" && <>
      {!st && <Section title="GPS check"><p className="text-[14px] text-mute">No GPS station at this spot. Open one of the four stations on the map to see the radar checked against it.</p></Section>}

      {st && (
        <Section title="GPS check">
          {!S.gps && <button onClick={() => set({ gps: true })} className="text-[13.5px] text-accent-2 hover:underline mb-2">Show GPS on the chart</button>}
          {st.role === "reference"
            ? <p className="text-[14.5px]">{st.station} is the reference station. All radar values are tied to it, so it can't check itself.</p>
            : st.residuals && (
              <>
                <table className="w-full text-[14px]">
                  <tbody className="divide-y divide-hair">
                    <tr><th scope="row" className="text-left font-normal text-mute py-1.5">Radar minus GPS, first to last date</th><td className="text-right font-semibold">{cm(st.residuals.net_m)}</td></tr>
                    <tr><th scope="row" className="text-left font-normal text-mute py-1.5">Typical disagreement per pair</th><td className="text-right font-semibold">{cm(st.residuals.pairs_rms_m).replace(/^[+−]/, "")}</td></tr>
                    <tr><th scope="row" className="text-left font-normal text-mute py-1.5">Pairs compared</th><td className="text-right font-semibold">{st.residuals.n_pairs}</td></tr>
                  </tbody>
                </table>
                <p className="text-[13px] text-mute mt-2">{st.station} was never used to calibrate the radar.{st.residuals.unwrap_flagged_pairs?.length ? ` ${st.residuals.unwrap_flagged_pairs.length} pair(s) flagged for unwrapping errors.` : ""}</p>
              </>
            )}
        </Section>
      )}

      <details open className="mt-6 rounded-lg border border-hair-2 bg-deck/60 open:bg-deck group">
        <summary className="cursor-pointer px-4 py-3 font-display text-[15.5px] font-semibold marker:text-accent">How we got these numbers</summary>
        <dl className="px-4 pb-4 text-[13px] space-y-2">
          {[
            ["Satellite product", `${D.meta.product}, ${D.meta.product_maturity}. Track ${D.meta.track} ${D.meta.direction}, frame ${D.meta.frame}.`],
            ["Dates measured here", `${G.n_valid_dates[i]} of ${D.dates.length}. Missing dates stay missing.`],
            ["Pairs in the fit", `${pairs.filter((p) => p.used_in_fit).length} of ${pairs.length}. Ionosphere corrected on ${pairs.every((p) => p.iono_applied) ? "every pair" : "some pairs only"}.`],
            ["Reference", `GPS station ${D.meta.reference_station}. Held out for checking: ${D.meta.held_out_stations.join(", ")}.`],
            ["Uncertainty", `${pm(D.meta.sigma_net_m)} on the net change, from ${D.meta.sigma_source}.`],
            ["Seasonal test", `${D.meta.significance}.`],
            ["Model", D.meta.fit.model],
            ["First and last granule", `${pairs[0]?.granule_id ?? "?"} … ${pairs[pairs.length - 1]?.granule_id ?? "?"}`],
          ].map(([k, val]) => (
            <div key={k}><dt className="text-mute">{k}</dt><dd className="break-all">{val}</dd></div>
          ))}
        </dl>
      </details>
      </>}
      </div>
    </div>
  );
}

function Spark({ v, color }) {
  const ok = v.filter((x) => x != null);
  if (ok.length < 3) return null;
  const lo = Math.min(...ok), hi = Math.max(...ok), sp = hi - lo || 1;
  const pts = v.map((x, k) => (x == null ? null : `${((k / (v.length - 1)) * 76 + 2).toFixed(1)},${(2 + (1 - (x - lo) / sp) * 18).toFixed(1)}`)).filter(Boolean).join(" ");
  return <svg viewBox="0 0 80 22" className="w-20 h-[22px]" aria-hidden="true"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" /></svg>;
}

// Where to look first: the fastest-sinking spots and the strongest seasonal breathing.
function Leaders({ D, actions }) {
  const [tab, setTab] = useState("sink");
  const G = D.grid;
  const name = (i) => { const st = D.stations.find((s) => s.cell_index === i); const b = cellBounds(D, i); return st ? `GPS ${st.station}` : `${b.lat.toFixed(2)}° N, ${Math.abs(b.lng).toFixed(2)}° W`; };
  const rows = [];
  for (let i = 0; i < D.n; i++) {
    if (tab === "sink" && G.net_change_m[i] != null && (G.label[i] === 1 || G.label[i] === 3)) rows.push([i, G.net_change_m[i]]);
    if (tab === "breathe" && G.seasonal_significant[i] === true && G.amp_m[i] != null) rows.push([i, G.amp_m[i]]);
  }
  rows.sort((x, y) => (tab === "sink" ? x[1] - y[1] : y[1] - x[1]));
  return (
    <Section title="Where to look first" aside={
      <div className="flex rounded-md border border-hair overflow-hidden text-[12.5px]">
        {[["sink", "Sinking fastest"], ["breathe", "Breathing most"]].map(([id, t]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-2.5 py-1 ${tab === id ? "bg-accent/15 text-accent-2" : "text-mute hover:text-ink"}`}>{t}</button>
        ))}
      </div>}>
      <ol className="divide-y divide-hair">
        {rows.slice(0, 5).map(([i, val], n) => (
          <li key={i}>
            <button onClick={() => actions.select(i, { fly: true })} className="w-full flex items-center gap-3 py-2 text-left hover:bg-deck-2/60 rounded px-1 -mx-1 group">
              <span className="font-display text-[15px] text-mute w-4">{n + 1}</span>
              <span className="flex-1 text-[13.5px] group-hover:text-accent-2">{name(i)}</span>
              <Spark v={D.values[i] || []} color={tab === "sink" ? "#F0705A" : "#5FC9E0"} />
              <span className={`font-display text-[16px] font-semibold w-[72px] text-right ${tab === "sink" ? "text-sink" : "text-rise"}`}>{tab === "sink" ? cm(val) : mm(val)}</span>
            </button>
          </li>
        ))}
        {!rows.length && <li className="py-2 text-[13.5px] text-mute">Nothing here passes the significance test yet.</li>}
      </ol>
      <p className="text-[12.5px] text-mute mt-2">{tab === "sink" ? "Change over the whole record, among spots where the sinking is beyond 2σ." : "Size of the yearly cycle, among spots where it is significant."}</p>
    </Section>
  );
}

function Overview({ D, actions }) {
  const ref = useRef(null);
  const pts = useRef([]);
  const counts = [0, 0, 0, 0];
  D.grid.label.forEach((v) => counts[v]++);
  const pct = (k) => Math.round((counts[k] / D.grid.label.length) * 100);

  useEffect(() => {
    const c = ref.current;
    const x = c.getContext("2d");
    const W = c.width, H = c.height, P = { l: 70, r: 18, t: 16, b: 58 };
    const G = D.grid;
    const p = [];
    for (let i = 0; i < D.n; i++) {
      if (G.seasonal_significant[i] !== true || G.amp_m[i] == null || G.trend_m_per_yr[i] == null) continue;
      p.push({ i, tx: G.trend_m_per_yr[i] * 100, ay: G.amp_m[i] * 1000, L: G.label[i] });
    }
    x.clearRect(0, 0, W, H);
    if (!p.length) return;
    const xmin = Math.min(0, ...p.map((q) => q.tx)), xmax = Math.max(0.5, ...p.map((q) => q.tx));
    const ymax = Math.max(...p.map((q) => q.ay)) * 1.1;
    const X = (v) => P.l + ((v - xmin) / (xmax - xmin)) * (W - P.l - P.r);
    const Y = (v) => H - P.b - (v / ymax) * (H - P.t - P.b);
    x.strokeStyle = "rgba(170,190,230,0.25)"; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(X(0), P.t); x.lineTo(X(0), H - P.b); x.moveTo(P.l, H - P.b); x.lineTo(W - P.r, H - P.b); x.stroke();
    x.fillStyle = "#8D97AB"; x.font = "22px 'Public Sans', sans-serif";
    x.textAlign = "center"; x.fillText("Fitted trend, cm a year (sinking to the left)", (P.l + W - P.r) / 2, H - 14);
    x.save(); x.translate(24, (P.t + H - P.b) / 2); x.rotate(-Math.PI / 2); x.fillText("Seasonal size, mm", 0, 0); x.restore();
    x.fillText(xmin.toFixed(0), X(xmin) + 8, H - P.b + 26); x.fillText("0", X(0), H - P.b + 26);
    x.globalCompositeOperation = "lighter";
    pts.current = p.map((q) => ({ ...q, X: X(q.tx), Y: Y(q.ay) }));
    pts.current.forEach((q) => {
      x.fillStyle = rgb(LABEL_COLORS[q.L] || [140, 150, 170]);
      x.globalAlpha = 0.5;
      x.beginPath(); x.arc(q.X, q.Y, 3.4, 0, 7); x.fill();
    });
    x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
  }, [D]);

  const click = (e) => {
    const c = ref.current, r = c.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * c.width, my = ((e.clientY - r.top) / r.height) * c.height;
    let best = null, bd = 500;
    pts.current.forEach((q) => { const d = (q.X - mx) ** 2 + (q.Y - my) ** 2; if (d < bd) { bd = d; best = q; } });
    if (best) actions.select(best.i, { fly: true });
  };

  return (
    <div>
      <h2 className="font-display text-[27px] leading-[1.12] font-semibold">The valley rises and falls with the seasons. Underneath, parts of it keep sinking.</h2>
      <p className="text-[15px] leading-relaxed text-ink/85 mt-3">Groundwater pumping lowers the water pressure underground, and the ground settles. Some of that comes back when the water returns each winter, and some doesn't. Compare the wrong two dates and sinking ground can look stable.</p>
      <p className="text-[15px] leading-relaxed text-ink/85 mt-3">Click anywhere on the map, or a GPS station, to see every measurement at that spot and how sure we are.</p>
      <div className="grid grid-cols-2 gap-2 mt-5">
        {[
          [1, "Seasonal movement with persistent sinking"], [3, "Persistent sinking, seasonal component uncertain"],
          [2, "Seasonal movement, no resolved trend"], [0, "Insufficient evidence"],
        ].map(([k, label]) => (
          <div key={k} className="rounded-lg border border-hair bg-deck/70 px-3 py-2.5">
            <div className={`font-display text-[26px] font-bold leading-none ${LABEL_TEXT[k]}`}>{pct(k)}%</div>
            <div className="text-[12.5px] text-mute mt-1 leading-snug">{label}</div>
          </div>
        ))}
      </div>
      <Leaders D={D} actions={actions} />
      <Section title="Seasonal size against trend">
        <canvas ref={ref} width="760" height="440" onClick={click} className="w-full h-auto cursor-pointer" aria-label="Scatter of seasonal size against trend. Click a dot to open that spot." />
        <p className="text-[13px] text-mute mt-1">Only spots where the seasonal cycle is significant. Click a dot to open it.</p>
      </Section>
    </div>
  );
}
