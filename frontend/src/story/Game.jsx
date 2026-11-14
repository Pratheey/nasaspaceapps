import { useEffect, useMemo, useState } from "react";
import { Check, X, Shuffle, Trophy } from "lucide-react";
import { useInView, reduceMotion } from "./hooks.js";
import { mostMisleadingPair, cellBounds } from "../lib/data.js";
import { cm, fmtShort } from "../lib/fmt.js";

/* ---------------- Spot the lie ---------------- */
// Three rounds. You see only two passes at a real spot and guess what the ground is doing.
// Then the whole record and its trend are revealed.
function makeRound(D, seed) {
  const G = D.grid, sig = D.meta.sigma_net_m || 0.01;
  const pool = [];
  for (let i = 0; i < D.n; i++) if (G.net_change_m[i] != null && G.n_valid_dates[i] >= D.dates.length - 2) pool.push(i);
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  // two out of three rounds use a spot where some pair of dates hides the sinking
  for (let tries = 0; tries < 400; tries++) {
    const i = pool[Math.floor(rnd() * pool.length)];
    const lie = mostMisleadingPair(D, i);
    if (seed % 3 !== 2 && lie) {
      const truth = G.net_change_m[i] < -2 * sig ? "sinking" : Math.abs(G.net_change_m[i]) <= 2 * sig ? "stable" : "rising";
      return { i, k1: lie.k1, k2: lie.k2, truth };
    }
    if (seed % 3 === 2) {
      const k1 = Math.floor(rnd() * (D.dates.length - 8)), k2 = k1 + 6 + Math.floor(rnd() * 3);
      const v = D.values[i];
      if (v[k1] == null || v[k2] == null) continue;
      const truth = G.net_change_m[i] < -2 * sig ? "sinking" : Math.abs(G.net_change_m[i]) <= 2 * sig ? "stable" : "rising";
      return { i, k1, k2, truth };
    }
  }
  return null;
}

export function SpotGame({ D }) {
  const [round, setRound] = useState(0);
  const [seedBase, setSeedBase] = useState(7);
  const [guess, setGuess] = useState(null);
  const [score, setScore] = useState(0);
  const [ref, seen] = useInView(0.25);
  const R = useMemo(() => makeRound(D, seedBase + round), [D, seedBase, round]);
  if (!R) return null;
  const v = D.values[R.i], N = D.dates.length;
  const W = 680, H = 260, P = { l: 46, r: 16, t: 20, b: 30 };
  const ok = v.filter((x) => x != null).map((x) => x * 100);
  const lo = Math.min(0, ...ok) - 1, hi = Math.max(0, ...ok) + 1;
  const X = (k) => P.l + (k / (N - 1)) * (W - P.l - P.r);
  const Y = (x) => P.t + ((hi - x) / (hi - lo)) * (H - P.t - P.b);
  const shown = guess != null;
  const diff = v[R.k2] - v[R.k1];
  const b = cellBounds(D, R.i);
  const done = round >= 2 && shown;
  const choose = (g) => { if (shown) return; setGuess(g); if (g === R.truth) setScore((s) => s + 1); };
  const next = () => { if (round >= 2) { setRound(0); setScore(0); setSeedBase((s) => s + 13); } else setRound(round + 1); setGuess(null); };
  return (
    <section ref={ref} className="relative py-[14vh] px-6 md:px-14 max-w-[1400px] mx-auto">
      <div className={`grid lg:grid-cols-[1fr_1.3fr] gap-12 items-center transition-all duration-1000 ${seen ? "opacity-100" : "opacity-0 translate-y-8"}`}>
        <div>
          <p className="font-serif italic text-accent-2 text-[22px] leading-none">Your turn</p>
          <h2 className="font-display font-bold text-[clamp(36px,4.4vw,64px)] leading-[0.98] mt-3">Spot the lie.</h2>
          <p className="text-[18px] leading-relaxed text-ink/80 mt-6">You get two radar passes at a real spot in the valley, nothing else. What is the ground doing over the whole year?</p>
          <div className="mt-6 flex items-center gap-4">
            <span className="font-mono text-[13px] text-mute">round {round + 1}/3</span>
            <span className="font-mono text-[13px] text-mute">score {score}</span>
            <div className="flex gap-1">{[0, 1, 2].map((n) => <span key={n} className={`h-1.5 w-8 rounded-full ${n < round || (n === round && shown) ? "bg-accent" : "bg-hair-2"}`} />)}</div>
          </div>
          {done && (
            <p className="mt-5 text-[17px] flex items-center gap-2"><Trophy size={18} className="text-accent" />
              {score === 3 ? "Three for three. You read past the seasons." : `${score} of 3. Two passes rarely tell the whole story, which is the point.`}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-hair-2 bg-deck/70 p-6">
          <p className="font-mono text-[12.5px] text-mute">{b.lat.toFixed(2)}° N, {Math.abs(b.lng).toFixed(2)}° W{D.synthetic ? ", synthetic data" : ""}</p>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto chart mt-2" role="img" aria-label={shown ? "Whole record revealed" : "Two passes shown"}>
            <line x1={P.l} x2={W - P.r} y1={Y(0)} y2={Y(0)} className="zero" />
            {shown && (
              <>
                <polyline points={v.map((x, k) => (x == null ? null : `${X(k)},${Y(x * 100)}`)).filter(Boolean).join(" ")} fill="none" stroke="#F0705A" strokeWidth="2" style={{ animation: reduceMotion ? "none" : "rise-in .6s both" }} />
                <line x1={X(0)} x2={X(N - 1)} y1={Y(v[0] * 100)} y2={Y((v[0] + D.grid.net_change_m[R.i]) * 100)} stroke="#F0705A" strokeDasharray="7 5" opacity="0.7" />
              </>
            )}
            {[R.k1, R.k2].map((k, n) => (
              <g key={n}>
                <circle cx={X(k)} cy={Y(v[k] * 100)} r="8" fill="#6FA8FF" style={{ filter: "drop-shadow(0 0 8px #6FA8FF)" }} />
                <text x={X(k)} y={H - 8} textAnchor="middle">{fmtShort(D.dates[k])}</text>
              </g>
            ))}
            {!shown && <line x1={X(R.k1)} x2={X(R.k2)} y1={Y(v[R.k1] * 100)} y2={Y(v[R.k2] * 100)} stroke="#6FA8FF" strokeWidth="2" strokeDasharray="4 4" />}
          </svg>
          <p className="text-[14.5px] mt-2">Between these passes the ground moved <strong>{cm(diff)}</strong>.</p>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {["sinking", "stable", "rising"].map((g) => {
              const right = shown && g === R.truth, wrong = shown && g === guess && g !== R.truth;
              return (
                <button key={g} onClick={() => choose(g)} disabled={shown}
                  className={`rounded-lg border px-3 py-3 text-[15px] font-semibold capitalize transition ${right ? "border-rise bg-rise/15 text-rise" : wrong ? "border-sink bg-sink/15 text-sink" : "border-hair-2 hover:border-accent hover:text-accent-2"} disabled:cursor-default`}>
                  <span className="inline-flex items-center gap-1.5">{right && <Check size={16} />}{wrong && <X size={16} />}{g}</span>
                </button>
              );
            })}
          </div>
          {shown && (
            <div className="mt-4 flex items-center justify-between gap-4 [animation:rise-in_.4s_both]">
              <p className="text-[14.5px] text-ink/85">Over the whole record this spot moved <strong>{cm(D.grid.net_change_m[R.i])}</strong>. {guess === R.truth ? "Right." : "The two passes hid it."}</p>
              <button onClick={next} className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-accent text-space font-semibold text-sm px-4 py-2 hover:bg-accent-2">
                {round >= 2 ? <><Shuffle size={14} /> Play again</> : "Next spot"}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- By the numbers ---------------- */
function CountUp({ to, decimals = 0, run, suffix = "", prefix = "" }) {
  const fmt = (x) => (x < 0 ? "−" : "") + Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (reduceMotion) { setV(to); return; }
    let raf; const t0 = performance.now();
    const step = (now) => { const k = Math.min(1, (now - t0) / 1600); setV(to * (1 - Math.pow(1 - k, 4))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run, to]);
  return <>{prefix}{fmt(v)}<span className="text-[0.5em] text-ink/60 ml-1">{suffix}</span></>;
}

export function Numbers({ D }) {
  const [ref, seen] = useInView(0.3);
  const G = D.grid;
  const s = useMemo(() => {
    let measured = 0, sinking = 0, breathing = 0, worst = 0, amp = 0;
    for (let i = 0; i < D.n; i++) {
      if (G.net_change_m[i] == null) continue;
      measured++;
      if (G.label[i] === 1 || G.label[i] === 3) sinking++;
      if (G.seasonal_significant[i] === true) { breathing++; amp = Math.max(amp, G.amp_m[i] || 0); }
      worst = Math.min(worst, G.net_change_m[i]);
    }
    const km2 = (D.meta.grid.step_deg * 111) * (D.meta.grid.step_deg * 111 * Math.cos((36.45 * Math.PI) / 180));
    return { measured, sinking, breathing, worst, amp, area: Math.round(measured * km2) };
  }, [D, G]);
  const items = [
    [<CountUp to={D.dates.length} run={seen} />, "radar passes, 12 days apart"],
    [<CountUp to={s.area} run={seen} suffix="km²" />, "of farmland measured"],
    [<CountUp to={(s.sinking / s.measured) * 100} run={seen} suffix="%" />, "of it sinking beyond the uncertainty"],
    [<CountUp to={s.worst * 100} decimals={1} run={seen} suffix="cm" />, "the most any spot moved in the record"],
  ];
  return (
    <section ref={ref} className="relative py-[12vh] border-y border-hair overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(240,112,90,.08),transparent_55%)]" />
      <div className="relative px-6 md:px-14 max-w-[1400px] mx-auto">
        <p className="font-serif italic text-accent-2 text-[22px] leading-none">By the numbers{D.synthetic ? ", from the preview data" : ""}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mt-10">
          {items.map(([num, label], n) => (
            <div key={n} className={`transition-all duration-1000 ${seen ? "opacity-100" : "opacity-0 translate-y-6"}`} style={{ transitionDelay: `${n * 120}ms` }}>
              <p className="font-mono text-[clamp(36px,3.6vw,58px)] font-medium leading-none tracking-tight whitespace-nowrap">{num}</p>
              <p className="text-[15.5px] text-ink/75 mt-3 max-w-[240px]">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
