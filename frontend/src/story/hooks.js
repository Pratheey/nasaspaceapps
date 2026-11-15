import { useEffect, useRef, useState } from "react";

export const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** true once the element has scrolled into view */
export function useInView(threshold = 0.25) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), io.disconnect()), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen];
}

/** 0..1 progress of the viewport through a tall (sticky) section */
export function useProgress() {
  const ref = useRef(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      setP(Math.max(0, Math.min(1, span > 0 ? -r.top / span : 0)));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);
  return [ref, p];
}

/** window scrollY, throttled to animation frames */
export function useScrollY() {
  const [y, setY] = useState(0);
  useEffect(() => {
    let raf = 0;
    const on = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; setY(window.scrollY); }); };
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);
  return y;
}

export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const seg = (p, a, b) => clamp01((p - a) / (b - a)); // progress within [a,b]
export const ease = (t) => 1 - Math.pow(1 - t, 3);

/** Eases a changing number toward its target every animation frame (smooth scroll-driven charts). */
export function useSmooth(target, rate = 9) {
  const [v, setV] = useState(target);
  const cur = useRef(target);
  const goal = useRef(target);
  goal.current = target;
  useEffect(() => {
    let raf = 0, last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const d = goal.current - cur.current;
      if (Math.abs(d) < 0.0005) { cur.current = goal.current; setV(goal.current); raf = 0; return; }
      cur.current += d * (1 - Math.exp(-rate * dt));
      setV(cur.current);
      raf = requestAnimationFrame(step);
    };
    if (!raf) raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, rate]);
  return v;
}
