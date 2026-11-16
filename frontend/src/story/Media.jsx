import { useLayoutEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2 } from "lucide-react";
import { useProgress, useInView, reduceMotion } from "./hooks.js";
import { MEDIA, NasaVideo, MaybeImage } from "./Space.jsx";
import { SatelliteArt } from "./art.jsx";

/* ---------------- chapter mark ---------------- */
// Each part of the story gets a number, a wide technical title and a serif line, so sections
// don't all share one template.
export function Chapter({ n, title, kicker, align = "left" }) {
  return (
    <div className={`flex items-baseline gap-3 ${align === "center" ? "justify-center" : ""}`}>
      <span className="font-mono text-[13px] text-accent-2">{String(n).padStart(2, "0")}</span>
      <span className="text-[15px] text-mute">{title}</span>
    </div>
  );
}

/* ---------------- mission timeline ---------------- */
// Vertical scroll drives a horizontal filmstrip of NISAR's journey, from the factory to orbit.
const STEPS = [
  { date: "Mar 3, 2023", title: "Shipped to India", text: "The science payload leaves JPL for Bengaluru, to be joined with the spacecraft body.", img: MEDIA.shipped },
  { date: "May 16, 2025", title: "At the launch site", text: "The satellite reaches Satish Dhawan Space Centre on India's southeastern coast.", img: MEDIA.arrives },
  { date: "Jul 18, 2025", title: "Into the fairing", text: "Sealed inside the nose cone that protects it from pressure and heat on the way up.", img: MEDIA.fairing },
  { date: "Jul 30, 2025", title: "Launch", text: "A GSLV rocket lifts NISAR into a near-polar, sun-synchronous orbit.", video: MEDIA.heroVideo },
  { date: "Aug 15, 2025", title: "Reflector deployed", text: "A 12-metre gold mesh antenna unfurls, the largest NASA has ever deployed in space.", img: MEDIA.reflector },
  { date: "Aug 21–23, 2025", title: "First light", text: "First radar images: Maine's coast and North Dakota farmland. Shown here: Forest River, North Dakota.", img: MEDIA.northDakota },
  { date: "Nov 2025", title: "Science begins", text: "NISAR enters its science phase, imaging nearly all land and ice every 12 days.", video: MEDIA.fleetVideo },
  { date: "Nov 2025 – Oct 2026", title: "Our valley", text: "The passes we used: eleven months over Corcoran and Mendota.", ours: true },
];

export function MissionTimeline() {
  const [ref, scrollProgress] = useProgress();
  const [completed, setCompleted] = useState(false);
  const [manualProgress, setManualProgress] = useState(1);
  const track = useRef(null);
  const scrubMotion = useRef({ frame: 0, value: 1, drag: null });
  const setScrubPosition = (value) => {
    const bounded = Math.max(0, Math.min(1, value));
    scrubMotion.current.value = bounded;
    setManualProgress(bounded);
  };
  useLayoutEffect(() => () => cancelAnimationFrame(scrubMotion.current.frame), []);
  const beginScrub = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.dataset.pointerFocus = "true";
    event.currentTarget.focus({ preventScroll: true });
    const motion = scrubMotion.current;
    cancelAnimationFrame(motion.frame);
    const rect = event.currentTarget.getBoundingClientRect();
    const thumbWidth = Math.min(rect.width, Math.max(48, Math.min(160, window.innerWidth * .12)));
    const travel = Math.max(1, rect.width - thumbWidth);
    const localX = event.clientX - rect.left;
    const thumbLeft = motion.value * travel;
    if (localX >= thumbLeft && localX <= thumbLeft + thumbWidth) {
      motion.drag = { pointerId: event.pointerId, startX: event.clientX, startValue: motion.value, travel };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const target = Math.max(0, Math.min(1, (localX - thumbWidth / 2) / travel));
    if (reduceMotion) { setScrubPosition(target); return; }
    const from = motion.value;
    let start;
    const animate = (now) => {
      start ??= now;
      const t = Math.min(1, Math.max(0, (now - start) / 650));
      // Smooth acceleration and deceleration, with no overshoot.
      const eased = t * t * (3 - 2 * t);
      setScrubPosition(from + (target - from) * eased);
      if (t < 1) motion.frame = requestAnimationFrame(animate);
    };
    motion.frame = requestAnimationFrame(animate);
  };
  const dragScrub = (event) => {
    const drag = scrubMotion.current.drag;
    if (drag?.pointerId === event.pointerId) setScrubPosition(drag.startValue + (event.clientX - drag.startX) / drag.travel);
  };
  const endScrub = (event) => {
    if (scrubMotion.current.drag?.pointerId !== event.pointerId) return;
    scrubMotion.current.drag = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const previousBottom = useRef(null);
  const [tw, setTw] = useState(0);
  const p = completed ? manualProgress : scrollProgress;
  useLayoutEffect(() => {
    const measure = () => setTw(Math.max(0, track.current.scrollWidth - window.innerWidth + 120));
    const observer = new ResizeObserver(measure);
    observer.observe(track.current);
    window.addEventListener("resize", measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  useLayoutEffect(() => {
    if (!completed && scrollProgress >= 1) {
      previousBottom.current = ref.current.getBoundingClientRect().bottom;
      setCompleted(true);
    }
  }, [scrollProgress, completed, ref]);
  useLayoutEffect(() => {
    if (!completed || previousBottom.current === null) return;
    // Keep the following content in the same screen position as the pinning space is removed.
    const delta = ref.current.getBoundingClientRect().bottom - previousBottom.current;
    previousBottom.current = null;
    const top = Math.max(0, window.scrollY + delta);
    window.scrollTo({ top, behavior: "instant" });
    window.dispatchEvent(new CustomEvent("story-layout-scroll", { detail: top }));
  }, [completed, ref]);
  const active = Math.min(STEPS.length - 1, Math.floor(p * STEPS.length));
  return (
    <section ref={ref} className={completed ? "relative" : "relative h-[460vh]"} style={{ overflowAnchor: "none" }}>
      <div className={`${completed ? "relative" : "sticky top-0"} h-[100svh] overflow-hidden flex flex-col justify-center`}>
        <div className="px-6 md:px-14 max-w-[1400px] w-full mx-auto">
          <Chapter n={5} title="Mission log" />
          <h2 className="font-display font-bold tracking-[-0.015em] leading-[1.02] text-[clamp(36px,4.6vw,68px)] mt-4">NISAR mission timeline</h2>
        </div>
        <div ref={track} className="flex gap-6 mt-10 pl-6 md:pl-14 will-change-transform" style={{ transform: `translate3d(${-p * tw}px,0,0)` }}>
          {STEPS.map((s, k) => (
            <article key={s.title} className={`shrink-0 w-[min(78vw,460px)] rounded-2xl overflow-hidden border transition-colors duration-500 ${k === active ? "border-accent/70 bg-deck" : "border-hair bg-deck/50"}`}>
              <div className="relative aspect-[16/10] bg-space overflow-hidden">
                {s.ours ? (
                  <img src="./media/san-joaquin-valley.svg" alt="Map of California’s San Joaquin Valley with Mendota and Corcoran marked" className="absolute inset-0 w-full h-full object-contain" />
                ) : s.video ? (
                  <NasaVideo srcs={s.video} className="absolute inset-0 w-full h-full object-cover" fallback={<SatelliteArt className="absolute inset-0 m-auto w-[70%] h-full" />} />
                ) : (
                  <>
                    <SatelliteArt className="absolute inset-0 m-auto w-[60%] h-full opacity-40" />
                    <MaybeImage srcs={s.img} alt={s.title} className="absolute inset-0 w-full h-full object-cover" />
                  </>
                )}
                <span className="absolute left-3 top-3 font-mono text-[12px] bg-space/80 backdrop-blur rounded px-2 py-0.5 text-accent-2">{s.date}</span>
              </div>
              <div className="p-5">
                <h3 className="font-display text-[22px] font-semibold">{s.title}</h3>
                <p className="text-[14.5px] text-ink/75 mt-1.5 leading-snug">{s.text}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="px-6 md:px-14 max-w-[1400px] w-full mx-auto mt-8">
          <div className={`mission-scrubber ${completed ? "is-ready" : ""}`}>
            <div className="mission-progress" aria-hidden="true">
              {STEPS.map((s, k) => <span key={k} style={{ background: k <= active ? "var(--color-accent)" : "var(--color-hair-2)" }} />)}
            </div>
            <input className="mission-scrollbar" id="mission-timeline-position" aria-label="Mission timeline position" type="range" min="0" max="1" step="0.001" value={manualProgress} disabled={!completed} aria-valuetext={STEPS[active].title} onKeyDown={event => { delete event.currentTarget.dataset.pointerFocus; }} onBlur={event => { delete event.currentTarget.dataset.pointerFocus; }} onPointerDown={beginScrub} onPointerMove={dragScrub} onPointerUp={endScrub} onPointerCancel={endScrub} onLostPointerCapture={() => { scrubMotion.current.drag = null; }} onChange={event => { cancelAnimationFrame(scrubMotion.current.frame); setScrubPosition(Number(event.target.value)); }} />
          </div>
        </div>
        <p className="px-6 md:px-14 max-w-[1400px] w-full mx-auto mt-3 text-[11.5px] text-mute">Photos and animations: NASA/JPL-Caltech, NASA Scientific Visualization Studio. Valley map: © OpenStreetMap contributors.</p>
      </div>
    </section>
  );
}

/* ---------------- NASA video player ---------------- */
export function WatchNasa() {
  const v = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [prog, setProg] = useState(0);
  const [failed, setFailed] = useState(false);
  const [ref, seen] = useInView(0.2);
  const toggle = () => { const el = v.current; if (!el) return; if (el.paused) { el.play(); setPlaying(true); } else { el.pause(); setPlaying(false); } };
  return (
    <section ref={ref} className="relative py-[14vh] px-6 md:px-14 max-w-[1400px] mx-auto">
      <div className="grid lg:grid-cols-[0.8fr_1.6fr] gap-12 items-center">
        <div>
          <Chapter n={10} title="From nasa" />
          <h2 className="font-display font-bold tracking-[-0.015em] leading-[1.02] text-[clamp(36px,4.6vw,68px)] mt-4">Advancing Earth science with NISAR</h2>
          <p className="text-[18px] text-ink/75 leading-relaxed mt-5">A short film from NASA on what the mission will watch: ice, forests, crops, and ground that moves.</p>
          <p className="text-[12px] text-mute mt-5">Video: NASA Scientific Visualization Studio.</p>
        </div>
        <div className={`group relative aspect-video rounded-2xl overflow-hidden border border-hair-2 bg-black shadow-[0_40px_120px_rgba(0,0,0,.6)] transition-all duration-1000 ${seen ? "opacity-100" : "opacity-0 scale-[0.97]"}`}>
          {!failed ? (
            <video ref={v} src={MEDIA.explainer[1]} poster={MEDIA.explainerPoster} muted={muted} playsInline preload="metadata"
              className="absolute inset-0 w-full h-full object-cover" onError={() => setFailed(true)}
              onTimeUpdate={(e) => setProg(e.target.currentTime / (e.target.duration || 1))} onEnded={() => setPlaying(false)} onClick={toggle} />
          ) : (
            <a href="https://svs.gsfc.nasa.gov/14377/" target="_blank" rel="noreferrer" className="absolute inset-0 grid place-items-center text-center p-8 bg-[radial-gradient(ellipse_at_50%_120%,#2A2826,#161514_65%)]">
              <span><span className="font-display text-[22px]">Watch it on NASA's site</span><br /><span className="text-mute text-[14px]">svs.gsfc.nasa.gov/14377</span></span>
            </a>
          )}
          {!failed && !playing && (
            <button onClick={toggle} aria-label="Play the NASA video" className="absolute inset-0 grid place-items-center bg-space/30 hover:bg-space/10 transition">
              <span className="grid place-items-center w-20 h-20 rounded-full bg-accent text-space shadow-[0_0_50px_rgba(157,176,138,.7)] group-hover:scale-110 transition-transform"><Play size={30} className="ml-1" /></span>
            </button>
          )}
          {!failed && (
            <div className="absolute inset-x-0 bottom-0 p-3 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="text-ink">{playing ? <Pause size={18} /> : <Play size={18} />}</button>
              <div className="flex-1 h-1 rounded bg-white/20 cursor-pointer" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const el = v.current; if (el?.duration) el.currentTime = ((e.clientX - r.left) / r.width) * el.duration; }}>
                <div className="h-full rounded bg-accent" style={{ width: `${prog * 100}%` }} />
              </div>
              <button onClick={() => setMuted(!muted)} aria-label={muted ? "Unmute" : "Mute"} className="text-ink">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
              <button onClick={() => v.current?.requestFullscreen?.()} aria-label="Full screen" className="text-ink"><Maximize2 size={17} /></button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- "what NISAR has seen" ---------------- */
export function SeenWall() {
  const [ref, seen] = useInView(0.15);
  const tiles = [
    { id: "fr", image: MEDIA.northDakota, title: "Forest River, North Dakota", date: "23 August 2025", description: "Fields, forests and wetlands reveal different radar responses. Circular plots mark center-pivot irrigation.", alt: "NISAR radar image of farmland along the Forest River, with annotated wetlands, crop fields and circular irrigation plots.", source: "https://svs.gsfc.nasa.gov/31360/" },
    { id: "me", image: MEDIA.mountDesert, title: "Mount Desert Island, Maine", date: "21 August 2025", description: "Green highlights forest. Magenta marks hard surfaces such as buildings and bare ground, including Bar Harbor.", alt: "NISAR radar image of Mount Desert Island and Bar Harbor, showing green forests, magenta built-up areas and dark waterways.", source: "https://www.jpl.nasa.gov/images/pia26616-nasa-isro-radar-satellite-captures-first-image-of-mount-desert-island/" },
    { id: "fleet", image: MEDIA.fleetStill, title: "NISAR among NASA’s fleet", date: "Orbit visualization", description: "A view of NISAR’s path around Earth and the strip of ground scanned by its radar.", alt: "NASA visualization of NISAR’s orbit and radar coverage around Earth.", source: "https://svs.gsfc.nasa.gov/5615/", credit: "NASA Scientific Visualization Studio" },
    { id: "ant", image: MEDIA.antarctica, title: "Over Antarctica", date: "Artist’s concept", description: "NISAR above the Antarctic ice sheet. The mission observes changes in glaciers and ice sheets as well as land.", alt: "Artist’s concept of the NISAR satellite above Antarctica, with its large radar reflector deployed.", source: "https://photojournal.jpl.nasa.gov/catalog/PIA26493" },
    { id: "india", image: MEDIA.india, title: "Over northeastern India", date: "Artist’s concept", description: "The joint NASA–ISRO satellite above northeastern India, showing its radar reflector and solar panels.", alt: "Artist’s concept of NISAR in orbit over northeastern India.", source: "https://photojournal.jpl.nasa.gov/catalog/PIA26496" },
  ];
  return (
    <section ref={ref} className="relative py-[12vh] px-6 md:px-14 max-w-[1400px] mx-auto">
      <Chapter n={8} title="First light" />
      <h2 className="font-display font-bold tracking-[-0.015em] leading-[1.02] text-[clamp(36px,4.6vw,68px)] mt-4">First NISAR images</h2>
      <p className="text-mute text-[15px] mt-4 max-w-[680px]">Radar views of Earth’s surface. These colors describe land cover and radar response, not ground motion.</p>
      <div className={`grid md:grid-cols-2 gap-6 mt-10 transition-all duration-1000 ${seen ? "opacity-100" : "opacity-0 translate-y-8"}`}>
        {tiles.map((tile) => (
          <div key={tile.id} className="contents">
          {tile.id === "fleet" && <div className="md:col-span-2 mt-6"><h3 className="font-display text-[28px] font-semibold">The mission in context</h3><p className="text-mute text-[14px] mt-2">Orbit visualizations and artist’s concepts of the satellite.</p></div>}
          <figure className="overflow-hidden rounded-2xl border border-hair-2 bg-deck">
            <a href={tile.image[0]} target="_blank" rel="noreferrer" aria-label={`View full image: ${tile.title}`} className="block bg-black focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px]">
              <MaybeImage srcs={tile.image} alt={tile.alt} className="w-full aspect-[1.85] object-contain" />
            </a>
            <figcaption className="p-5">
              <p className="text-[12px] text-mute">{tile.date}</p>
              <h3 className="font-display text-[23px] font-semibold mt-1">{tile.title}</h3>
              <p className="text-[14px] leading-relaxed text-ink/75 mt-2">{tile.description}</p>
              <a href={tile.source} target="_blank" rel="noreferrer" className="inline-block text-[12px] text-accent-2 underline underline-offset-4 mt-4">{tile.credit || "NASA/JPL-Caltech"} · Image source ↗</a>
            </figcaption>
          </figure>
          </div>
        ))}
      </div>
    </section>
  );
}
