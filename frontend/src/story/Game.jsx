import { useEffect, useMemo, useState } from "react";
import { useInView, reduceMotion } from "./hooks.js";

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
    [<CountUp to={s.area} run={seen} suffix="km²" />, "of ground measured"],
    [<CountUp to={(s.sinking / s.measured) * 100} run={seen} suffix="%" />, "of it sinking beyond the uncertainty"],
    [<CountUp to={s.worst * 100} decimals={1} run={seen} suffix="cm" />, "the most any spot moved in the record"],
  ];
  return (
    <section ref={ref} className="relative py-[12vh] border-y border-hair overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(240,112,90,.08),transparent_55%)]" />
      <div className="relative px-6 md:px-14 max-w-[1400px] mx-auto">
        <p className="text-[15px] text-mute">By the numbers{D.synthetic ? ", from the preview data" : ""}</p>
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
