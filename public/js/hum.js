// The hum: the audio engine, the tune-in, the chord walk, the tap tones and the fades.
import {
  TAU, W, r, cx, cy, points, vis, dent, DENT_STRENGTH, DENT_RADIUS, DENT_RISE, DENT_FOLLOW, DENT_LEAVE, lens,
} from './field.js';

// The verse, as the hum needs it: when the void and the verse land, s after the tap. Set by main.js.
export const verse = { landing: () => 0 };

// ---- The hum --------------------------------------------------------------
// A chord on the year tone (C♯) in just ratios off the harmonic series, each voice breathing on
// its own period so the texture never quite repeats. Room tone, not music.
// Off until asked; everything is built inside the tap, which is what phones require.
const ROOT = 68.05;   // C♯2: the Earth year (1 / 365.2422 days) raised 32 octaves → 136.10 Hz, here one octave down
// The chord travels the verse: from sameness (an open fifth) through harmony to the edge of noise
// (a cluster), on the same root. A slow random walk between neighbours; dissonance is a short
// visit that always resolves. Tones are just ratios within one octave.
const CHORDS = {
  open:    { tones: [1, 3/2],               hold: [35, 55],  next: { major: 5, sus2: 2.5, sus4: 2.5 } },
  major:   { tones: [1, 5/4, 3/2],          hold: [35, 55],  next: { open: 2, sus2: 2, sus4: 2, dom7: 2.5, minor: 1.5 } },
  sus2:    { tones: [1, 9/8, 3/2],          hold: [25, 45],   next: { major: 4, minor: 3.5, open: 2.5 } },
  sus4:    { tones: [1, 4/3, 3/2],          hold: [25, 45],   next: { major: 4.5, dom7: 3, cluster: 1.5 } },
  minor:   { tones: [1, 6/5, 3/2],          hold: [25, 45],  next: { min7: 3.5, sus2: 2.5, neutral: 2.5, cluster: 1.5 } },
  min7:    { tones: [1, 6/5, 3/2, 9/5],     hold: [25, 45],   next: { minor: 5, tritone: 2, sus4: 3 } },
  dom7:    { tones: [1, 5/4, 3/2, 7/4],     hold: [25, 45],   next: { major: 5.5, tritone: 2, sus4: 2.5 } },
  neutral: { tones: [1, 11/9, 3/2],         hold: [25, 40],   next: { minor: 4, major: 4, open: 2 } },
  cluster: { tones: [1, 16/15, 3/2],        hold: [12, 20],   next: { sus2: 5, minor: 5 } },        // the edge of noise
  tritone: { tones: [1, 45/32, 7/4],        hold: [12, 20],   next: { dom7: 4, sus4: 3, major: 3 } },
};
// Each voice keeps its register and takes the nearest chord tone there, so movement is by small steps.
const snap = (r0, tones, isRoot) => {
  if (isRoot) return r0;
  let best = r0, bd = Infinity;
  for (const tn of tones) for (let k = -1; k <= 4; k++) {
    const c = tn * Math.pow(2, k), d = Math.abs(Math.log2(c / r0));
    if (d < bd) { bd = d; best = c; }
  }
  return best;
};
const pickNext = (name) => {
  const opts = Object.entries(CHORDS[name].next), total = opts.reduce((a, [, w]) => a + w, 0);
  let x = Math.random() * total;
  for (const [n, w] of opts) { x -= w; if (x <= 0) return n; }
  return opts[0][0];
};
const MAIN_R0 = [1, 3/2, 2, 5/2, 7/2];   // the top voice sits where a 7th can land
const LFO_PERIODS = [13, 17, 19, 23, 29];
const VOICE_GAIN = [0.07, 0.09, 0.08, 0.072, 0.064];                  // the root is felt more than heard
// Upper harmony: the series one and two octaves up (×4 … ×12), pure sines that drift in
// and out on long incommensurate cycles and sit slightly apart in the stereo field.
const UPPER = [4, 5, 6, 8], UPPER_PERIODS = [31, 37, 41, 43];
const UPPER_GAIN = [0.038, 0.034, 0.029, 0.019], UPPER_PAN = [-0.45, 0.35, -0.2, 0.5];
// Choir, humming: low alto to mezzo (×3 … ×7, ~200–480 Hz). A hum is mostly fundamental,
// muffled through the nose (a dip in the upper mids). Each voice is a few singers who drift a
// little, breathe on their own schedule, and scoop up into the note when they come back in.
// Strings: an octave over the choir (~540–820 Hz), silent until a swell brings them in.
const STRINGS = [8, 10, 12], STRING_GAIN = [0.021, 0.018, 0.015], STRING_PAN = [-0.55, 0.5, -0.1];
const CHOIR = [3, 4, 5, 6, 7], CHOIR_PERIODS = [53, 59, 61, 67, 71];
const CHOIR_GAIN = [0.029, 0.027, 0.026, 0.022, 0.018], CHOIR_PAN = [0.3, -0.35, 0.45, -0.4, 0.15];

const SWELL = 4, LEVEL = 2.0;                                          // which voice the hot spots lean on; master ceiling
const btn = document.getElementById('hum'), hint = document.getElementById('hum-hint');
const debug = location.hash === '#humdebug';
if (debug) window.__field = {   // for checks: the dent, and the mean drawn shift of the particles within DENT_RADIUS of it
  dent, constants: { DENT_STRENGTH, DENT_RADIUS, DENT_RISE, DENT_FOLLOW, DENT_LEAVE },
  taps() { return points.filter((p) => p.tap).map((p) => +(p.rad - r).toFixed(1)); },
  voices() { return tapVoices.length; },
  sample() { let n = 0, sum = 0, max = 0; for (const p of points) { const x = cx + Math.cos(p.a) * p.rad, y = cy + Math.sin(p.a) * p.rad; if (Math.hypot(x - dent.x, y - dent.y) < DENT_RADIUS) { const v = Math.hypot(...lens(x, y)); n++; sum += v; max = Math.max(max, v); } } return { n, mean: n ? sum / n : 0, max, m: dent.m }; },
};
const PULSE_HZ = (ROOT * 2) / 1024;
let pulseT0 = 0;
// What the ring is allowed to know: where the pulse is (0–1), scaled by how present the sound is.
vis.pulse = () => {
  if (!graph || !actx) return 0;
  const t = actx.currentTime - (actx.outputLatency || actx.baseLatency || 0);
  const presence = Math.min(1, Math.max(0, graph.master.gain.value / LEVEL));
  return presence * (1 + Math.sin(TAU * PULSE_HZ * (t - pulseT0))) / 2;
};
let actx = null, graph = null, on = false, timers = [], tearDown = 0, hideTimer = 0, silent = null;
let lastTick = 0, chord = 'major', detuning = false;

const remember = () => { try { localStorage.setItem('hum.heard', '1'); } catch (e) {} };
// The hint shows whenever the hum is off, which is how every visit starts. hum.heard only skips the entrance.
let hintTimer = 0;
hint.hidden = false;

function impulse(ac, secs) {   // a room, synthesized: decaying noise, ~5 s
  const n = Math.round(ac.sampleRate * secs), buf = ac.createBuffer(2, n, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-6 * i / n) * Math.min(1, i / 400);
  }
  return buf;
}
function noiseBuf(ac) {
  const n = ac.sampleRate * 2, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function build() {
  const ac = actx, now = ac.currentTime, sources = [];
  const master = ac.createGain(); master.gain.value = 0;
  const filter = ac.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 2400; filter.Q.value = 0.5;
  const pan = ac.createStereoPanner();
  const dry = ac.createGain(); dry.gain.value = 0.8;
  const conv = ac.createConvolver(); conv.buffer = impulse(ac, 5);
  const wet = ac.createGain(); wet.gain.value = 0.4;
  // Pull the low end back: a gentle shelf, so the bass is a floor, not the room.
  // The pulse: the year tone again, 10 octaves below the root's octave (136.10 Hz / 1024 = one
  // swell every ~7.5 s). The whole hum leans louder and brighter on it; the ring reads the same clock.
  const pulse = ac.createGain(); pulse.gain.value = 1;
  const po = ac.createOscillator(); po.frequency.value = PULSE_HZ;
  const pdg = ac.createGain(); pdg.gain.value = 0.2; po.connect(pdg); pdg.connect(pulse.gain);
  const pfg = ac.createGain(); pfg.gain.value = 250; po.connect(pfg); pfg.connect(filter.frequency);
  po.start(now); sources.push(po); pulseT0 = now;
  const shelf = ac.createBiquadFilter(); shelf.type = 'lowshelf'; shelf.frequency.value = 150; shelf.gain.value = -6;
  filter.connect(pulse); pulse.connect(shelf); shelf.connect(pan); pan.connect(dry); pan.connect(conv); conv.connect(wet);
  dry.connect(master); wet.connect(master); master.connect(ac.destination);
  // Taps come in after the hum's own filter and lean, each panned by itself, into the same room.
  const taps = ac.createGain(); taps.gain.value = 1; taps.connect(dry); taps.connect(conv);
  // Air: the lowpass wanders 1700–3100 Hz over ~40 s, open enough for the upper voices.
  const fl = ac.createOscillator(); fl.frequency.value = 1 / 40;
  const flg = ac.createGain(); flg.gain.value = 700;
  fl.connect(flg); flg.connect(filter.frequency); fl.start(now); sources.push(fl);
  // Drift: a panner wanders around its home on a slow sine of its own (20–70 s a sweep, random start).
  const drift = (pan, home, width) => {
    pan.value = home;
    const o = ac.createOscillator(); o.frequency.value = 1 / (20 + Math.random() * 50);
    const k = ac.createGain(); k.gain.value = width;
    o.connect(k); k.connect(pan); o.start(now + Math.random() * 20); sources.push(o);
  };
  // Vibrato, idle until a bloom: a ~5–6 Hz sine into each pitch's detune, depth 0 at rest.
  const vibrato = (targets) => {
    const o = ac.createOscillator(); o.frequency.value = 5.5;
    const depth = ac.createGain(); depth.gain.value = 0;
    o.connect(depth); for (const p of targets) depth.connect(p);
    o.start(now); sources.push(o);
    return { rate: o.frequency, depth: depth.gain };
  };
  // Soft partials; sines read as sub on small speakers.
  const pw = ac.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.16, 0.05, 0.015]));
  const swell = ac.createGain(); swell.gain.value = 1; swell.connect(filter);
  const tune = () => (aimTuneIn ? Math.pow(2, Math.random() * 2 - 1) : 1);   // tuning in (the entrance only): each tone starts up to an octave off
  const voices = MAIN_R0.map((r0, i) => {
    const osc = ac.createOscillator(); osc.setPeriodicWave(pw); osc.frequency.value = ROOT * snap(r0, CHORDS[chord].tones, i === 0) * tune();
    const g = ac.createGain(); g.gain.value = VOICE_GAIN[i] * 0.65;
    const lfo = ac.createOscillator(); lfo.frequency.value = 1 / LFO_PERIODS[i];
    const lg = ac.createGain(); lg.gain.value = VOICE_GAIN[i] * 0.35;
    lfo.connect(lg); lg.connect(g.gain);
    // The floor holds the middle: root and fifth dead centre, the higher three spread a little.
    const sp = ac.createStereoPanner(); if (i >= 2) drift(sp.pan, [0, 0, -0.15, 0.15, -0.1][i], 0.2);
    osc.connect(g); g.connect(sp); sp.connect(i === SWELL ? swell : filter);
    osc.start(now); lfo.start(now); sources.push(osc, lfo);
    return { osc, g, vib: vibrato([osc.detune]), kind: 'main' };
  });
  const upper = UPPER.map((ratio, i) => {
    const osc = ac.createOscillator(); osc.type = 'sine'; osc.frequency.value = ROOT * snap(ratio, CHORDS[chord].tones, false) * tune();
    const g = ac.createGain(); g.gain.value = UPPER_GAIN[i] * 0.8;   // swells 60–100%: the drone holds
    const lfo = ac.createOscillator(); lfo.frequency.value = 1 / UPPER_PERIODS[i];
    const lg = ac.createGain(); lg.gain.value = UPPER_GAIN[i] * 0.2;
    const sp = ac.createStereoPanner(); drift(sp.pan, UPPER_PAN[i] * 0.6, 0.55);
    lfo.connect(lg); lg.connect(g.gain);
    const trem = ac.createGain(); trem.gain.value = 1;
    osc.connect(g); g.connect(trem); trem.connect(sp); sp.connect(filter);
    osc.start(now); lfo.start(now + Math.random() * UPPER_PERIODS[i]); sources.push(osc, lfo);
    return { osc, trem, r0: ratio, f: ROOT * snap(ratio, CHORDS[chord].tones, false), vib: vibrato([osc.detune]), kind: 'upper' };
  });
  // A voice-like source: many harmonics rolling off ~1/n^1.7, like vocal folds rather than an organ pipe.
  const vh = new Float32Array(16); for (let n = 1; n < 16; n++) vh[n] = Math.pow(n, -1.7);
  const vox = ac.createPeriodicWave(new Float32Array(16), vh);
  const nzb = noiseBuf(ac);
  // Human irregularity: slow-ish random noise (lowpassed to a few Hz) wobbling pitch and level.
  const wobble = (dest, scale, hz) => {
    const n = ac.createBufferSource(); n.buffer = nzb; n.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = hz; lp.Q.value = 0.5;
    const k = ac.createGain(); k.gain.value = scale;
    n.connect(lp); lp.connect(k); k.connect(dest); n.start(now, Math.random() * 2); sources.push(n);
  };
  // The nose: a dip around 1.1 kHz and a soft lowpass; lips closed.
  const nasal = ac.createBiquadFilter(); nasal.type = 'peaking'; nasal.frequency.value = 1100; nasal.Q.value = 1.4; nasal.gain.value = -14;
  const lips = ac.createBiquadFilter(); lips.type = 'lowpass'; lips.frequency.value = 1300; lips.Q.value = 0.4;
  nasal.connect(lips); lips.connect(filter);
  // Inhales: a whisper of filtered noise, bumped when a voice breathes.
  const inz = ac.createBufferSource(); inz.buffer = noiseBuf(ac); inz.loop = true;
  const ibp = ac.createBiquadFilter(); ibp.type = 'bandpass'; ibp.frequency.value = 1800; ibp.Q.value = 0.7;
  const inhale = ac.createGain(); inhale.gain.value = 0;
  inz.connect(ibp); ibp.connect(inhale); inhale.connect(filter); inz.start(now); sources.push(inz);
  const choir = CHOIR.map((ratio, i) => {
    const g = ac.createGain(); g.gain.value = CHOIR_GAIN[i] * 0.8;   // swells 60–100%: present, not coming and going
    const lfo = ac.createOscillator(); lfo.frequency.value = 1 / CHOIR_PERIODS[i];
    const lg = ac.createGain(); lg.gain.value = CHOIR_GAIN[i] * 0.2;
    const phrase = ac.createGain(); phrase.gain.value = 1;                                 // breath gaps
    const trem = ac.createGain(); trem.gain.value = 1;                                     // rhythm pulses
    const sp = ac.createStereoPanner(); drift(sp.pan, CHOIR_PAN[i] * 0.6, 0.5);
    lfo.connect(lg); lg.connect(g.gain); g.connect(phrase); phrase.connect(trem); trem.connect(sp); sp.connect(nasal);
    const oscs = [], k = tune();                                                          // one person: one starting pitch
    for (const cents of [-6, 0, 5]) {                                                      // a few singers on one note
      const osc = ac.createOscillator(); osc.setPeriodicWave(vox);
      osc.frequency.value = ROOT * snap(ratio, CHORDS[chord].tones, false) * k; osc.detune.value = cents;
      // Drift, not vibrato: two slow, uneven wanders of a few cents per singer.
      for (const [hz, depth] of [[0.07 + Math.random() * 0.08, 3], [0.17 + Math.random() * 0.1, 2]]) {
        const w = ac.createOscillator(); w.frequency.value = hz;
        const wd = ac.createGain(); wd.gain.value = depth;
        w.connect(wd); wd.connect(osc.detune); w.start(now + Math.random() * 10); sources.push(w);
      }
      wobble(osc.detune, 300, 6 + Math.random() * 4);                                     // jitter: ~4¢ RMS (lowpassed noise is ~0.0135 RMS)
      const sg = ac.createGain(); sg.gain.value = 1; wobble(sg.gain, 2.2, 4 + Math.random() * 3);   // shimmer: ~3% of level
      osc.connect(sg); sg.connect(g); osc.start(now); sources.push(osc); oscs.push(osc);
    }
    // Breath in the tone: air through the folds, pulsing at the voice's own pitch.
    const air = ac.createBufferSource(); air.buffer = nzb; air.loop = true;
    const ahp = ac.createBiquadFilter(); ahp.type = 'highpass'; ahp.frequency.value = 700;
    const am = ac.createGain(); am.gain.value = 0;
    const pulse = ac.createOscillator(); pulse.frequency.value = ROOT * snap(ratio, CHORDS[chord].tones, false) * k;
    const pd = ac.createGain(); pd.gain.value = 0.5;
    const off = ac.createConstantSource(); off.offset.value = 0.5;
    pulse.connect(pd); pd.connect(am.gain); off.connect(am.gain);
    const al = ac.createGain(); al.gain.value = 0.35;
    air.connect(ahp); ahp.connect(am); am.connect(al); al.connect(g);
    air.start(now, Math.random() * 2); pulse.start(now); off.start(now); sources.push(air, pulse, off);
    lfo.start(now + Math.random() * CHOIR_PERIODS[i]); sources.push(lfo);
    return { phrase, trem, oscs, pulse, vib: vibrato(oscs.map((o) => o.detune)), kind: 'choir', r0: ratio, f: ROOT * snap(ratio, CHORDS[chord].tones, false) };
  });
  // Strings: a bowed tone (bright 1/n partials, softened), three desks a few cents apart,
  // each with its own vibrato that only opens once the note has sounded a while.
  const sh = new Float32Array(14); for (let n = 1; n < 14; n++) sh[n] = Math.pow(n, -1.15);
  const bow = ac.createPeriodicWave(new Float32Array(14), sh);
  const strings = STRINGS.map((ratio, i) => {
    const f = ROOT * snap(ratio, CHORDS[chord].tones, false);
    const g = ac.createGain(); g.gain.value = 0;
    const body = ac.createBiquadFilter(); body.type = 'lowpass'; body.frequency.value = 2400; body.Q.value = 0.3;
    const sp = ac.createStereoPanner(); drift(sp.pan, STRING_PAN[i] * 0.7, 0.4);
    const trem = ac.createGain(); trem.gain.value = 1;
    g.connect(trem); trem.connect(body); body.connect(sp); sp.connect(filter);
    const oscs = [];
    for (const cents of [-8, 0, 7]) {
      const osc = ac.createOscillator(); osc.setPeriodicWave(bow); osc.frequency.value = f; osc.detune.value = cents;
      wobble(osc.detune, 200, 3 + Math.random() * 3);                 // bow pressure: a little unsteady
      const og = ac.createGain(); og.gain.value = 1 / 3;
      osc.connect(og); og.connect(g); osc.start(now); sources.push(osc); oscs.push(osc);
    }
    return { g, trem, oscs, r0: ratio, f, peak: STRING_GAIN[i], vib: vibrato(oscs.map((o) => o.detune)), busy: false };
  });
  // Colour: the harmonic 7th, below the fifth, mostly absent.
  const col = ac.createOscillator(); col.setPeriodicWave(pw); col.frequency.value = ROOT * 7 / 4;
  const colour = ac.createGain(); colour.gain.value = 0;
  col.connect(colour); colour.connect(filter); col.start(now); sources.push(col);
  // Breath: filtered noise, nearly subliminal.
  const nz = ac.createBufferSource(); nz.buffer = noiseBuf(ac); nz.loop = true;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.8;
  const breath = ac.createGain(); breath.gain.value = 0.006;
  const bl = ac.createOscillator(); bl.frequency.value = 1 / 11;
  const blg = ac.createGain(); blg.gain.value = 0.004;
  bl.connect(blg); blg.connect(breath.gain);
  nz.connect(bp); bp.connect(breath); breath.connect(filter); nz.start(now); bl.start(now); sources.push(nz, bl);
  // Key: one shared offset, in cents, under every pitch — the whole hum can move and come home.
  const key = ac.createConstantSource(); key.offset.value = 0; key.start(now); sources.push(key);
  for (const o of [...voices.map((v) => v.osc), ...upper.map((u) => u.osc), ...choir.flatMap((c) => [...c.oscs, c.pulse]), ...strings.flatMap((sg) => sg.oscs), col])
    key.connect(o.detune);
  graph = { master, filter, pan, swell, voices, upper, colour, sources, choir, inhale, strings, key, taps };
}
function destroy() {
  for (const v of tapVoices) for (const o of v.oscs) { try { o.stop(); } catch (e) {} }
  tapVoices = [];
  for (const id of timers) clearTimeout(id);
  timers = []; detuning = false; blooming = 0; away = false;
  for (const s of graph.sources) { try { s.stop(); } catch (e) {} }
  graph.master.disconnect();
  graph = null;
  actx.suspend().catch(() => {});
  if (silent) silent.pause();
}
// Stop a param where it is right now — mid-ramp included — instead of snapping back to the
// ramp's start (what a bare cancelScheduledValues does).
const freeze = (p, t) => {
  if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
  else { const v = p.value; p.cancelScheduledValues(t); p.setValueAtTime(v, t); }
};
const later = (fn, ms) => timers.push(setTimeout(fn, ms));
if (debug) setTimeout(() => { window.__tapTone = tapTone; });
// ---- A tap's tone ----------------------------------------------------------
// A soft bell on one of the chord's tones (with the key's lean), its octave by how far from the void the
// tap is: near the ring low and dark, far out high and clear, climbing the chord's tones through
// TAP_OCTAVES. Panned by x. It sinks up to TAP_REDSHIFT cents as its point falls and goes as it crosses.
// At most TAP_VOICES at once; a new one takes the oldest's place.
const TAP_OCTAVES = [2, 5], TAP_GAIN = 0.05, TAP_DECAY = 4, TAP_REDSHIFT = 40,
      TAP_CROSS = 0.3, TAP_VOICES = 4, TAP_PAN = 0.8;
// Softer as it rises: the attack lengthens from TAP_ATTACK[0] at the bottom rung to TAP_ATTACK[1] at the
// top; the level falls TAP_TAPER_DB across the range; the upper partials fade above TAP_SOFT_HZ; and a
// gentle lowpass follows the note at TAP_LP_MULT × its pitch, never above TAP_LP_MAX Hz.
const TAP_ATTACK = [0.015, 0.07], TAP_TAPER_DB = 5, TAP_SOFT_HZ = 900, TAP_LP_MULT = 3.5, TAP_LP_MAX = 4500;
const TAP_PARTIALS = [[1, 1, 1], [2.76, 0.22, 0.45], [5.4, 0.07, 0.25]];   // [ratio, gain, decay share]: a soft glass bell
let tapVoices = [];
// Distance sets the register, but the note is drawn from the TAP_SPREAD rungs nearest it, the closest most
// likely; the note just played keeps only TAP_REPEAT of its weight, so repeats happen but rarely.
const TAP_SPREAD = 3, TAP_REPEAT = 0.2;
let tapLast = 0;
function tapPitch(u) {   // u: 0 at the ring … 1 far out → a chord tone (Hz, before the key's lean)
  const tones = CHORDS[chord].tones, ladder = [];
  for (let k = TAP_OCTAVES[0]; k < TAP_OCTAVES[1]; k++) for (const t of tones) ladder.push(t * 2 ** k);
  ladder.push(2 ** TAP_OCTAVES[1]);
  ladder.sort((a, b) => a - b);
  const pos = Math.min(1, Math.max(0, u)) * (ladder.length - 1);
  const near = ladder.map((ratio, i) => ({ ratio, d: Math.abs(i - pos) })).sort((a, b) => a.d - b.d).slice(0, TAP_SPREAD);
  for (const c of near) c.w = (1 / (0.5 + c.d)) * (Math.abs(c.ratio - tapLast) < 1e-9 ? TAP_REPEAT : 1);
  let x = Math.random() * near.reduce((a, c) => a + c.w, 0), ratio = near[0].ratio;
  for (const c of near) { x -= c.w; if (x <= 0) { ratio = c.ratio; break; } }
  tapLast = ratio;
  return { hz: ROOT * ratio, ratio };
}
function tapRelease(v, secs) {
  if (v.gone) return; v.gone = true;
  const t = actx.currentTime;
  freeze(v.env.gain, t); v.env.gain.setTargetAtTime(0, t, secs / 3);
  for (const o of v.oscs) { try { o.stop(t + secs + 0.2); } catch (e) {} }
  tapVoices = tapVoices.filter((x) => x !== v);
}
function tapRedshift(v, f) {   // f: 0 where it was tapped … 1 at the ring
  if (v.gone || !graph) return;
  v.shift.offset.setTargetAtTime(-TAP_REDSHIFT * Math.min(1, Math.max(0, f)) ** 1.5, actx.currentTime, 0.1);
}
function tapTone(x, u) {
  if (!graph || !on) return null;
  while (tapVoices.length >= TAP_VOICES) tapRelease(tapVoices[0], 0.08);   // steal the oldest
  const ac = actx, t = ac.currentTime, { hz, ratio } = tapPitch(u);
  const up = Math.min(1, Math.max(0, (Math.log2(ratio) - TAP_OCTAVES[0]) / (TAP_OCTAVES[1] - TAP_OCTAVES[0])));   // 0 bottom … 1 top
  const attack = TAP_ATTACK[0] + (TAP_ATTACK[1] - TAP_ATTACK[0]) * up;
  const env = ac.createGain(); env.gain.value = 0;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5; lp.frequency.value = Math.min(TAP_LP_MAX, hz * TAP_LP_MULT);
  const sp = ac.createStereoPanner(); sp.pan.value = Math.max(-1, Math.min(1, ((x / W) * 2 - 1) * TAP_PAN));
  env.connect(lp); lp.connect(sp); sp.connect(graph.taps);
  const shift = ac.createConstantSource(); shift.offset.value = 0; shift.start(t);
  const oscs = [shift];
  for (const [k, g, share] of TAP_PARTIALS) {
    const o = ac.createOscillator(); o.frequency.value = hz * k;
    graph.key.connect(o.detune); shift.connect(o.detune);
    const soft = k > 1 ? 1 / (1 + (hz / TAP_SOFT_HZ) ** 2) : 1;
    const pg = ac.createGain(); pg.gain.value = 0;
    pg.gain.setValueAtTime(0, t); pg.gain.linearRampToValueAtTime(g * soft, t + attack);
    pg.gain.setTargetAtTime(0, t + attack, (TAP_DECAY * share) / 4);
    o.connect(pg); pg.connect(env); o.start(t); o.stop(t + TAP_DECAY + 1); oscs.push(o);
  }
  env.gain.setValueAtTime(TAP_GAIN * 10 ** (-TAP_TAPER_DB * up / 20), t);
  const v = { env, out: lp, oscs, shift, gone: false };
  if (debug) window.__lastTap = v;
  tapVoices.push(v);
  later(() => { tapVoices = tapVoices.filter((x) => x !== v); }, (TAP_DECAY + 1) * 1000);
  if (debug) console.log('[hum] tap', hz.toFixed(2) + 'Hz', 'ratio ' + ratio.toFixed(4), 'octave ' + Math.floor(Math.log2(ratio)), 'chord ' + chord, 'u ' + u.toFixed(2));
  return v;
}
const hold = (p, from, to, up, stay, down, t) => {   // ramp up, hold, ramp back
  p.cancelScheduledValues(t); p.setValueAtTime(from, t);
  p.linearRampToValueAtTime(to, t + up); p.setValueAtTime(to, t + up + stay); p.linearRampToValueAtTime(from, t + up + stay + down);
};

// Tension held: one voice drifts a few cents off pure, beats, then comes home. Never two at once.
function scheduleDetune() {
  later(() => {
    if (!graph) return;
    if (!detuning && actx.currentTime >= settled) {
      detuning = true;
      const v = graph.voices[1 + Math.floor(Math.random() * 4)];
      const cents = (3 + Math.random() * 6) * (Math.random() < 0.5 ? -1 : 1), stay = 6 + Math.random() * 6;
      hold(v.osc.detune, 0, cents, 4, stay, 4, actx.currentTime);
      later(() => { detuning = false; }, (stay + 8.5) * 1000);
    }
    scheduleDetune();
  }, 20000 + Math.random() * 20000);
}
// Shifting: the chord slides to a neighbouring voicing along the series. The root stays.
// Breathing, rarely: every 12–30 s one humming voice, chosen at random, lets go, breathes and
// scoops back in. The rest keep droning. Variance, not a pattern.
function scheduleBreath() {
  later(() => {
    if (!graph) return;
    const t = actx.currentTime;
    const still = graph.choir.filter((c) => !(c.until > t + 2));              // never breathe mid-glide
    const v = still[Math.floor(Math.random() * still.length)];
    if (!v) { scheduleBreath(); return; }
    const gap = 0.9 + Math.random() * 0.9;
    v.phrase.gain.cancelScheduledValues(t); v.phrase.gain.setTargetAtTime(0, t, 0.22);
    const ig = graph.inhale.gain;
    ig.setTargetAtTime(0.0035, t + 0.45, 0.12); ig.setTargetAtTime(0, t + gap - 0.15, 0.1);
    v.phrase.gain.setTargetAtTime(1, t + gap, 0.16);
    for (const o of v.oscs) {
      o.frequency.cancelScheduledValues(t + gap);
      o.frequency.setValueAtTime(v.f * Math.pow(2, -28 / 1200), t + gap);   // ~28¢ flat
      o.frequency.setTargetAtTime(v.f, t + gap, 0.11);
    }
    scheduleBreath();
  }, 12000 + Math.random() * 18000);
}
// The walk: hold a chord for an uneven time (mostly mid-range, sometimes a quick turn, sometimes
// a long settle), then glide to the next at an uneven speed (3–20 s). Voices don't move in lockstep:
// each sets off a little early or late and takes its own time, so for a few seconds the chord is
// between chords — some voices arrived, others still sliding. That passing friction is the warp.
function holdFor(lo, hi) {
  const x = Math.random();
  if (x < 0.12) return lo * (0.45 + Math.random() * 0.3);          // a quick turn
  if (x > 0.88) return hi * (1.2 + Math.random() * 0.6);           // a long settle
  return lo + (hi - lo) * (Math.random() + Math.random()) / 2;     // mostly the middle
}
// One glide for the walk and the opening: each tone sets off within `spread` and takes dur × (1 ± width),
// an exponential ramp from wherever it is. Returns when the last one lands.
// With `arrive` (an audio-clock time), every tone's glide is timed to land there, ± up to 0.4 s.
function slide(tones, dur, spread, width, strings, arrive) {
  const t = actx.currentTime, arrivals = [];
  let landed = t;
  const glide = (p, hz, off, d) => {
    freeze(p, t); p.setValueAtTime(p.value, t + off); p.exponentialRampToValueAtTime(hz, t + off + d);
  };
  const own = () => {
    const o = Math.random() * spread;
    const d = arrive ? Math.max(1, arrive + (Math.random() * 2 - 1) * 0.4 - t - o) : dur * (1 - width + Math.random() * 2 * width);
    landed = Math.max(landed, t + o + d); arrivals.push(o + d);
    return [o, d];
  };
  graph.voices.forEach((v, i) => { const [o, d] = own(); glide(v.osc.frequency, ROOT * snap(MAIN_R0[i], tones, i === 0), o, d); });
  graph.upper.forEach((u) => { const [o, d] = own(); u.f = ROOT * snap(u.r0, tones, false); glide(u.osc.frequency, u.f, o, d); });
  graph.choir.forEach((c) => {
    const [o, d] = own();                                              // one person: their singers move together
    c.f = ROOT * snap(c.r0, tones, false); c.until = t + o + d + 0.3; landed = Math.max(landed, c.until);
    for (const os of c.oscs) { const r = Math.random() * 0.3; glide(os.frequency, c.f, o + r, arrive ? d - r : d); }
    glide(c.pulse.frequency, c.f, o, d);
  });
  if (strings) graph.strings.forEach((sg) => {
    const [o, d] = own(), f = ROOT * snap(sg.r0, tones, false); sg.f = f;
    for (const os of sg.oscs) glide(os.frequency, f, o, d);
  });
  if (debug && arrive) console.log('[hum] arrivals after the tap', arrivals.map((a) => a.toFixed(2)).join(' '));
  return landed;
}
function scheduleGlide(wait = 0) {
  const [lo, hi] = CHORDS[chord].hold;
  later(() => {
    if (!graph) return;
    chord = pickNext(chord);
    const dur = 3 + 17 * Math.pow(Math.random(), 0.75);               // 3–20 s, leaning slow
    slide(CHORDS[chord].tones, dur, Math.min(4, dur * 0.35), 0.3, true);
    if (debug) console.log('[hum] chord →', chord, 'glide', dur.toFixed(1) + 's');
    scheduleGlide();
  }, (wait + holdFor(lo, hi)) * 1000);
}
// Tuning in: on a fresh build every tone starts off pitch and slides into the chord, slower and
// steadier than the walk (16–20 s, tighter spread). The walk, detunes and blooms wait for it to land.
let settled = 0;
// The tune-in plays only on the entrance with sound. Any build from the header starts on the chord the
// walk was on, everything running at once, and fades in over REFADE s.
const REFADE = 3;
// Through the door with sound, the glides are aimed at the moment the void is full and the verse has
// landed (landing(), shared with the entrance), so the chord locks as they do.
let aimTuneIn = false;
function tuneIn() {
  settled = slide(CHORDS[chord].tones, 0, 3, 0, false, actx.currentTime + verse.landing());
  if (debug) console.log('[hum] opening glide aimed at +' + verse.landing().toFixed(2) + 's');
}
// Blooms: now and then one tone leans in — vibrato swells up, holds, and lets go. Mostly the
// humming voices, wider and quicker; sometimes a synth voice, slower and narrower. At most two at once.
let blooming = 0;
function scheduleVibrato() {
  later(() => {
    if (!graph) return;
    if (blooming < 2 && actx.currentTime >= settled) {
      const pool = [...graph.choir, ...graph.choir, ...graph.voices.slice(1), ...graph.upper].filter((v) => !v.blooming);
      const v = pool[Math.floor(Math.random() * pool.length)];
      if (v) {
        const t = actx.currentTime, choir = v.kind === 'choir';
        const cents = choir ? 12 + Math.random() * 23 : 6 + Math.random() * 12;
        const rate = choir ? 4.8 + Math.random() * 1.6 : 4 + Math.random() * 1.5;
        const up = 1.5 + Math.random() * 3, stay = 2 + Math.random() * 7, down = 2 + Math.random() * 4;
        v.vib.rate.cancelScheduledValues(t); v.vib.rate.setValueAtTime(rate * 0.85, t);
        v.vib.rate.linearRampToValueAtTime(rate, t + up);                    // quickens as it opens
        hold(v.vib.depth, 0, cents, up, stay, down, t);
        v.blooming = true; blooming++;
        later(() => { v.blooming = false; blooming--; }, (up + stay + down) * 1000);
        if (debug) console.log('[hum] bloom', v.kind, cents.toFixed(0) + '¢', rate.toFixed(1) + 'Hz');
      }
    }
    scheduleVibrato();
  }, 6000 + Math.random() * 16000);
}
// The strings come in: every 50–130 s, one to three desks enter one after another, swell
// slowly (8–14 s), sing a while with vibrato opening late, then fade over 10–18 s.
function scheduleStrings() {
  later(() => {
    if (!graph) return;
    const free = graph.strings.filter((sg) => !sg.busy).sort(() => Math.random() - 0.5);
    const n = Math.min(free.length, 1 + Math.floor(Math.random() * 3));
    let enter = 0;
    for (const sg of free.slice(0, n)) {
      const t = actx.currentTime + enter;
      const up = 8 + Math.random() * 6, stay = 6 + Math.random() * 14, down = 10 + Math.random() * 8;
      const peak = sg.peak * (0.7 + Math.random() * 0.3);
      sg.g.gain.cancelScheduledValues(t); sg.g.gain.setValueAtTime(0.0001, t);
      sg.g.gain.exponentialRampToValueAtTime(peak * 0.25, t + up * 0.5);
      sg.g.gain.linearRampToValueAtTime(peak, t + up);
      sg.g.gain.setValueAtTime(peak, t + up + stay);
      sg.g.gain.setTargetAtTime(0, t + up + stay, down / 4);
      const vr = 4.8 + Math.random() * 1.2, vc = 8 + Math.random() * 10;
      sg.vib.rate.setValueAtTime(vr, t);
      hold(sg.vib.depth, 0, vc, up * 0.6, stay + up * 0.4, down * 0.5, t + up * 0.5);   // vibrato opens once the note is there
      sg.busy = true;
      later(() => { sg.busy = false; sg.g.gain.cancelScheduledValues(actx.currentTime); sg.g.gain.setValueAtTime(0, actx.currentTime); },
            (enter + up + stay + down + 2) * 1000);
      enter += 3 + Math.random() * 6;
    }
    if (debug) console.log('[hum] strings', n);
    scheduleStrings();
  }, 50000 + Math.random() * 80000);
}
// Rhythm from pitch: now and then one to three upper layers pulse in volume at their own pitch
// slowed by whole octaves — 4–8 pulses to the bar (sometimes an octave slower, 2–4), where the bar
// is the breath. A major chord's 4:5:6 becomes 4 against 5 against 6, all meeting on the downbeat
// (the breath's peak). Each episode fades in over a bar, pulses 2–6 bars, fades out over a bar.
const BAR = 1 / PULSE_HZ;
function scheduleTremolo() {
  later(() => {
    if (!graph) return;
    const pool = [...graph.choir, ...graph.upper, ...graph.strings.filter((sg) => sg.busy)].filter((v) => !v.pulsing);
    const n = Math.min(pool.length, 1 + Math.floor(Math.random() * 3));
    // next downbeat: the breath peaks a quarter-bar into each cycle
    const now = actx.currentTime, beat0 = pulseT0 + BAR / 4;
    const T = beat0 + Math.ceil((now + 0.5 - beat0) / BAR) * BAR;
    const bars = 2 + Math.floor(Math.random() * 5), dur = (bars + 2) * BAR;
    const picked = pool.sort(() => Math.random() - 0.5).slice(0, n);
    const counts = [];
    for (const v of picked) {
      let c = v.f / ROOT; while (c < 4) c *= 2; while (c >= 8) c /= 2;    // the pitch, folded into 4–8 per bar
      if (Math.random() < 0.3) c /= 2;                                  // sometimes half-time
      const depth = 0.35 + Math.random() * 0.3, N = Math.ceil(dur * 30), curve = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const x = (i / (N - 1)) * dur / BAR;                             // position in bars
        const env = Math.min(1, x, bars + 2 - x);                        // a bar in, a bar out
        curve[i] = 1 - depth * env * (1 - Math.cos(TAU * c * x)) / 2;    // peaks on every beat, all meet on the downbeat
      }
      v.trem.gain.cancelScheduledValues(T); v.trem.gain.setValueCurveAtTime(curve, T, dur);
      v.pulsing = true; later(() => { v.pulsing = false; }, (T - now + dur + 0.2) * 1000);
      counts.push(c.toFixed(2));
    }
    if (debug) console.log('[hum] rhythm', counts.join(' : '), 'per bar ×', bars);
    scheduleTremolo();
  }, 25000 + Math.random() * 35000);
}
// Leaning off home: every 3–6 min the whole hum swells (25–45 s, eased) a just half step
// (16/15) or whole step (9/8) up or down — half steps twice as likely — stays 1–2.5 min, then
// eases home to the year tone. Barely a key change; more a lean. Chords and rhythms ride along.
const KEYS = [-112, -112, 112, 112, -204, 204];
let away = false;
function scheduleKey(first) {
  later(() => {
    if (!graph) return;
    const p = graph.key.offset, t = actx.currentTime, from = p.value;
    const to = away ? 0 : KEYS[Math.floor(Math.random() * KEYS.length)];
    const dur = 25 + Math.random() * 20, curve = new Float32Array(96);
    for (let i = 0; i < 96; i++) { const x = i / 95; curve[i] = from + (to - from) * x * x * (3 - 2 * x); }
    p.cancelScheduledValues(t); p.setValueCurveAtTime(curve, t, dur);
    away = !away;
    if (debug) console.log('[hum] key →', to + '¢', dur.toFixed(0) + 's');
    scheduleKey(false);
  }, (first || !away ? 180000 + Math.random() * 180000 : 60000 + Math.random() * 90000));
}
function scheduleColour() {
  later(() => {
    if (!graph) return;
    hold(graph.colour.gain, 0, 0.03, 6, 8 + Math.random() * 8, 6, actx.currentTime);
    scheduleColour();
  }, 45000 + Math.random() * 45000);
}
// Once per frame from the ring loop, throttled: the sound leans toward the bright
// side, and one voice swells with the hot spots.
function humTick(now) {
  if (!graph || now - lastTick < 100) return;
  lastTick = now;
  const t = actx.currentTime;
  graph.pan.pan.setTargetAtTime(0.1 * Math.cos(vis.phi), t, 0.5);   // a hint of the bright side; the layers do the moving
  graph.swell.gain.setTargetAtTime(1 + 0.9 * Math.min(1, vis.hot), t, 0.7);
}
function ramp(to, secs) {
  const g = graph.master.gain, t = actx.currentTime;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + secs);
}
// Coming in: a slow, curved rise (x²) — near-silent at first, so the hum arrives rather than switches on.
function fadeIn(to, secs) {
  const g = graph.master.gain, t = actx.currentTime, from = g.value;
  const curve = new Float32Array(64).map((_, i) => from + (to - from) * Math.pow(i / 63, 2));
  g.cancelScheduledValues(t); g.setValueCurveAtTime(curve, t, secs);
}

// iOS: claim the playback channel and keep a silent track looping, or the mute switch wins.
function unmute() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    if (!silent) {
      const n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
      const tag = (o, s) => { for (let i = 0; i < 4; i++) b[o + i] = s.charCodeAt(i); };
      tag(0, 'RIFF'); v.setUint32(4, 36 + n, true); tag(8, 'WAVE'); tag(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
      tag(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
      let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
      silent = new Audio('data:audio/wav;base64,' + btoa(s));
      silent.loop = true; silent.setAttribute('playsinline', '');
    }
    silent.play().catch(() => {});
  } catch (e) {}
}

function enable() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  unmute();
  actx.resume().catch(() => {});
  clearTimeout(tearDown);
  let secs = 8;
  if (!graph) {
    build();
    if (aimTuneIn) tuneIn(); else { settled = actx.currentTime; secs = REFADE; }
    aimTuneIn = false;
    scheduleDetune(); scheduleGlide(settled - actx.currentTime); scheduleColour(); scheduleBreath(); scheduleVibrato(); scheduleStrings(); scheduleTremolo(); scheduleKey(true);
  }
  fadeIn(LEVEL, secs);
  if (debug) window.__hum = { ctx: actx, master: graph.master, graph };
}
function disable() {
  if (!graph) return;
  ramp(0, 2);
  tearDown = setTimeout(() => { if (!on && graph) destroy(); }, 2400);
}

btn.addEventListener('click', () => {
  on = !on;
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? 'Turn the hum off' : 'Turn the hum on');
  document.title = on ? 'The Hum is happening' : 'The Hum';   // the tab says so while it sounds
  clearTimeout(hintTimer);
  if (on) {
    enable(); remember();
    hint.classList.add('fade'); hintTimer = setTimeout(() => { hint.hidden = true; }, 1700);
  } else {
    disable();
    hint.hidden = false; void hint.offsetWidth; hint.classList.remove('fade');   // unhide, then fade back in
  }
});

document.addEventListener('visibilitychange', () => {
  if (!graph || !on) return;
  clearTimeout(hideTimer);
  if (document.hidden) {
    ramp(0, 0.3);
    hideTimer = setTimeout(() => { if (document.hidden && graph) actx.suspend().catch(() => {}); }, 400);
  } else {
    actx.resume().then(() => { if (graph && on) ramp(LEVEL, 1.5); }).catch(() => {});
  }
});

// Leaving through the footer: let the hum fall away before the next page. New-tab clicks go straight through.
const LEAVE_FADE = 0.6;
document.querySelectorAll('.foot a').forEach((a) => a.addEventListener('click', (e) => {
  if (!graph || !on || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  ramp(0, LEAVE_FADE);
  setTimeout(() => { location.href = a.href; }, LEAVE_FADE * 1000 + 50);
}));
// Back from a link: the page can return from the back-forward cache with the hum faded out.
addEventListener('pageshow', (e) => {
  if (e.persisted && graph && on) actx.resume().then(() => { if (graph && on) ramp(LEVEL, 1.5); }).catch(() => {});
});

// For the entrance, which can't assign another module's bindings.
export function setAimTuneIn(v) { aimTuneIn = v; }

export {
  btn, on, graph, tearDown, destroy, tapTone, tapRedshift, tapRelease, TAP_CROSS, humTick,
};
