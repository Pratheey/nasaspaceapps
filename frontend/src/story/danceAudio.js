// WebAudio voices for "The dance". No files. Created only from a click; every change is ramped.
// Every pitch is snapped to a five-note (major pentatonic) scale, so the measurements play as a tune:
// one plucked note per radar pass, and silence where a pass is missing.
const PENTA = [0, 2, 4, 7, 9]; // semitones above the base note
/** norm 0..1 -> a scale note between baseHz and `octaves` octaves above it. */
export function scaleHz(baseHz, norm, octaves = 2) {
  const steps = 5 * octaves, i = Math.round(Math.min(1, Math.max(0, norm)) * steps);
  return baseHz * Math.pow(2, (12 * Math.floor(i / 5) + PENTA[i % 5]) / 12);
}
export function createDanceAudio(o) {
  const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  let ctx;
  try { ctx = new AC(); } catch { return null; }
  const all = [], oscs = [];
  const node = (n) => { all.push(n); return n; };
  const master = node(ctx.createGain());
  master.gain.value = 0;
  master.connect(ctx.destination);
  const voice = (types, freq, cutoff, gain) => {
    const lp = node(ctx.createBiquadFilter()); lp.type = "lowpass"; lp.frequency.value = cutoff;
    const g = node(ctx.createGain()); g.gain.value = gain;
    lp.connect(g); g.connect(master);
    const os = types.map(([type, detune]) => {
      const x = ctx.createOscillator(); x.type = type; x.frequency.value = freq; x.detune.value = detune;
      x.connect(lp); x.start(); oscs.push(x); return x;
    });
    return { os, g };
  };
  const pad = voice([["triangle", -7], ["sine", 8]], o.padBaseHz, o.padCutoffHz, o.padGain);
  const drone = voice([["sine", 0]], o.droneBaseHz, 400, o.droneGain);
  const solo = voice([["triangle", 0]], o.soloBaseHz, 1600, 0);
  let stopped = false;
  const ramp = (param, v, tc) => { try { param.setTargetAtTime(v, ctx.currentTime, tc); } catch { /* context closed */ } };
  ramp(master.gain, 1, 0.3);
  ctx.resume?.().catch(() => {});

  return {
    // pad 0..1 (higher ground = higher), drone 0..1 (share of cells below their start), soloNorm 0..1 or null
    update({ pad: p, drone: d, solo: s, level = 1 }) {
      if (stopped) return;
      ramp(master.gain, level, 0.12); // fades out when paused, back in on play
      const f = scaleHz(o.padBaseHz, p);
      pad.os.forEach((x) => ramp(x.frequency, f, 0.06));
      ramp(drone.os[0].frequency, scaleHz(o.droneBaseHz, 1 - d, 1), 0.08);
      if (s == null) ramp(solo.g.gain, 0, 0.25);
      else { ramp(solo.os[0].frequency, scaleHz(o.soloBaseHz, s), 0.05); ramp(solo.g.gain, o.soloGain, 0.25); }
    },
    // One plucked note per radar pass. norm 0..1 = where the valley's mean ground sits in its range.
    note(norm) {
      if (stopped) return;
      const t = ctx.currentTime, x = ctx.createOscillator(), g = ctx.createGain();
      x.type = "triangle"; x.frequency.value = scaleHz(o.noteBaseHz, norm);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.noteGain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      x.connect(g); g.connect(master);
      x.onended = () => { try { x.disconnect(); g.disconnect(); } catch { /* already gone */ } };
      x.start(t); x.stop(t + 0.95);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      ramp(master.gain, 0, 0.04);
      setTimeout(() => {
        oscs.forEach((x) => { try { x.stop(); } catch { /* already stopped */ } try { x.disconnect(); } catch { /* ok */ } });
        all.forEach((n) => { try { n.disconnect(); } catch { /* ok */ } });
        ctx.close?.().catch(() => {});
      }, 220);
    },
  };
}
