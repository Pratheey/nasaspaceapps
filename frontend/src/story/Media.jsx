import { useRef, useState } from "react";
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
  { date: "Aug 15, 2025", title: "The reflector blooms", text: "A 12-metre gold mesh antenna unfurls, the largest NASA has ever deployed in space.", img: MEDIA.reflector },
  { date: "Aug 21–23, 2025", title: "First light", text: "First radar images: Maine's coast and North Dakota farmland.", video: MEDIA.forestRiverVideo },
  { date: "Nov 2025", title: "Science begins", text: "NISAR enters its science phase, imaging nearly all land and ice every 12 days.", video: MEDIA.fleetVideo },
  { date: "Nov 2025 – Oct 2026", title: "Our valley", text: "The passes we used: eleven months over Corcoran and Mendota.", ours: true },
];

export function MissionTimeline() {
  const [ref, p] = useProgress();
  const track = useRef(null);
  const tw = track.current ? track.current.scrollWidth - window.innerWidth + 120 : 0;
  const active = Math.min(STEPS.length - 1, Math.floor(p * STEPS.length));
  return (
    <section ref={ref} className="relative h-[460vh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden flex flex-col justify-center">
        <div className="px-6 md:px-14 max-w-[1400px] w-full mx-auto">
          <Chapter n={5} title="Mission log" />
          <h2 className="font-display font-bold tracking-[-0.015em] leading-[1.02] text-[clamp(36px,4.6vw,68px)] mt-4">Three years to get here.</h2>
        </div>
        <div ref={track} className="flex gap-6 mt-10 pl-6 md:pl-14 will-change-transform" style={{ transform: `translate3d(${-p * tw}px,0,0)` }}>
          {STEPS.map((s, k) => (
            <article key={s.title} className={`shrink-0 w-[min(78vw,460px)] rounded-2xl overflow-hidden border transition-colors duration-500 ${k === active ? "border-accent/70 bg-deck" : "border-hair bg-deck/50"}`}>
              <div className="relative aspect-[16/10] bg-space overflow-hidden">
                {s.ours ? (
                  <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_50%_120%,rgba(240,112,90,.35),#0F1420_70%)]">
                    <span className="font-display font-bold text-[15px] text-sink">SAN JOAQUIN VALLEY</span>
                  </div>
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
        <div className="px-6 md:px-14 max-w-[1400px] w-full mx-auto mt-8 flex items-center gap-3">
          {STEPS.map((s, k) => <span key={k} className={`h-[3px] flex-1 rounded-full transition-colors ${k <= active ? "bg-accent shadow-[0_0_8px_#6FA8FF]" : "bg-hair-2"}`} />)}
        </div>
        <p className="px-6 md:px-14 max-w-[1400px] w-full mx-auto mt-3 text-[11.5px] text-mute">Photos and animations: NASA/JPL-Caltech, NASA Scientific Visualization Studio.</p>
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
            <a href="https://svs.gsfc.nasa.gov/14377/" target="_blank" rel="noreferrer" className="absolute inset-0 grid place-items-center text-center p-8 bg-[radial-gradient(ellipse_at_50%_120%,#1d3a5c,#0F1420_65%)]">
              <span><span className="font-display text-[22px]">Watch it on NASA's site</span><br /><span className="text-mute text-[14px]">svs.gsfc.nasa.gov/14377</span></span>
            </a>
          )}
          {!failed && !playing && (
            <button onClick={toggle} aria-label="Play the NASA video" className="absolute inset-0 grid place-items-center bg-space/30 hover:bg-space/10 transition">
              <span className="grid place-items-center w-20 h-20 rounded-full bg-accent text-space shadow-[0_0_50px_rgba(111,168,255,.7)] group-hover:scale-110 transition-transform"><Play size={30} className="ml-1" /></span>
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
  const [gone, setGone] = useState({});
  const tiles = [
    { id: "fr", v: MEDIA.forestRiverVideo, t: "North Dakota, first light", s: "Aug 23, 2025: farmland and wetlands along the Forest River.", cls: "md:col-span-2 md:row-span-2" },
    { id: "me", v: MEDIA.maineVideo, t: "Mount Desert Island, Maine", s: "Aug 21, 2025: forest in green, built-up ground in magenta." },
    { id: "fleet", v: MEDIA.fleetVideo, t: "NISAR among NASA's fleet", s: "Its orbit and radar swath in orange, other Earth satellites in cyan." },
    { id: "amazon", i: MEDIA.amazonFlood, t: "Flooded forest, Peru", s: "Airborne L-band radar from 2013: the kind of image NISAR makes of wetlands." },
    { id: "ant", i: MEDIA.antarctica, t: "Over Antarctica", s: "Artist's concept. NISAR also tracks ice sheets and glaciers." },
    { id: "india", i: MEDIA.india, t: "Over northeastern India", s: "Artist's concept of NISAR's orbit." },
  ].filter((x) => !gone[x.id]);
  return (
    <section ref={ref} className="relative py-[12vh] px-6 md:px-14 max-w-[1400px] mx-auto">
      <Chapter n={8} title="First light" />
      <h2 className="font-display font-bold tracking-[-0.015em] leading-[1.02] text-[clamp(36px,4.6vw,68px)] mt-4">Radar sees through clouds and dark.</h2>
      <div className={`grid md:grid-cols-4 auto-rows-[230px] gap-4 mt-10 transition-all duration-1000 ${seen ? "opacity-100" : "opacity-0 translate-y-8"}`}>
        {tiles.map((x) => (
          <figure key={x.id} className={`group relative overflow-hidden rounded-2xl border border-hair-2 bg-deck ${x.cls || ""}`}>
            {x.v
              ? <NasaVideo srcs={x.v} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-[1600ms]" fallback={<SatelliteArt className="absolute inset-0 m-auto w-[70%] h-full opacity-60" />} />
              : <MaybeImage srcs={x.i} alt={x.t} onFail={() => setGone((g) => ({ ...g, [x.id]: true }))} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-[1600ms]" />}
            <div className="absolute inset-0 bg-gradient-to-t from-space/95 via-space/10 to-transparent" />
            <figcaption className="absolute inset-x-0 bottom-0 p-4">
              <p className="font-display text-[18px] font-semibold">{x.t}</p>
              <p className="text-[13px] text-ink/70 mt-0.5 max-h-0 group-hover:max-h-20 overflow-hidden transition-all duration-500">{x.s}</p>
            </figcaption>
            <span className="absolute top-3 right-3 font-mono text-[10.5px] text-ink/55">{x.v ? "NASA SVS" : "NASA/JPL-Caltech"}</span>
          </figure>
        ))}
      </div>
    </section>
  );
}
