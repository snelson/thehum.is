// The field: the void, the ring, the particles that fall into it, the dent (#6) and the tap points (#9),
// and the frame loop that drives them, with the entrance's clock and cues.
const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
const voidEl = document.querySelector('.void');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const RING = '#b48cff', MAGENTA = '#ff5fb8', TEAL = '#4fd6c8';
const TAU = Math.PI * 2;

let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, r = 280, r0 = 280, maxR = 0, lastScale = 1;
let glow = null;      // cached outer glow, drawn once per resize
let ringGrad = null;  // cached conic tint
let points = [];
// The aperture: how open the void is, 1/3 at the door, 1 once entered. swing() eases it between:
// by default the long door swing (a held start, a rush, a long settle: quintic in-out, 2.4 s).
const SHUT = 1 / 3, SWING_MS = 2400;
const quint = (p) => p < 0.5 ? 16 * p ** 5 : 1 - (2 - 2 * p) ** 5 / 2;
// A CSS cubic-bezier as a function of progress, so a swing can ride the same curve as a transition.
const bezier = (x1, y1, x2, y2) => (x) => {
  let lo = 0, hi = 1, t = x;
  for (let i = 0; i < 24; i++) { t = (lo + hi) / 2; if (3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3 < x) lo = t; else hi = t; }
  return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3;
};
let aperture = document.documentElement.classList.contains('entering') ? SHUT : 1, apFrom = aperture, apTo = aperture, apAt = 0, apMs = SWING_MS, apEase = quint;
const swing = (to, at, ms = SWING_MS, ease = quint) => { apFrom = aperture; apTo = to; apAt = at; apMs = ms; apEase = ease; };
// The reset's close: ease-in-out expo, from where it is to exactly the door's size over CLOSE_MS,
// starting DRAWIN_LEAD s after the verse's draw-in.
const CLOSE_MS = 2000, DRAWIN_LEAD = 0.3;
const expoInOut = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2);

const mix = (a, b, t) => {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// Far points are dim and cool; near the ring they warm toward the ring itself.
const FAR = mix('#5e5484', TEAL, 0.35);
const NEAR = mix(RING, MAGENTA, 0.25);

function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx = W / 2; cy = H / 2;
  r0 = voidEl.offsetWidth / 2;   // layout size, unaffected by the pulse's scale or the aperture
  r = r0 * aperture;
  maxR = Math.hypot(W, H) / 2;

  // Glow: outside the ring only, so the interior stays flat.
  const gs = Math.ceil((r0 + 24) * 2), g = document.createElement('canvas');
  g.width = g.height = Math.round(gs * dpr);
  const gc = g.getContext('2d'); gc.scale(dpr, dpr);
  const grad = gc.createRadialGradient(gs / 2, gs / 2, 0, gs / 2, gs / 2, r0 + 18);
  const e = r0 / (r0 + 18);
  grad.addColorStop(0, 'rgba(180,140,255,0)');
  grad.addColorStop(e, 'rgba(180,140,255,0)');
  grad.addColorStop(e + 0.0001, 'rgba(180,140,255,0.22)');
  grad.addColorStop(e + (1 - e) * 0.35, 'rgba(180,140,255,0.07)');
  grad.addColorStop(1, 'rgba(180,140,255,0)');
  gc.fillStyle = grad; gc.fillRect(0, 0, gs, gs);
  glow = { c: g, s: gs };

  // Ring tint: magenta near 11 o'clock, teal near 5. Narrow, faint.
  if (ctx.createConicGradient) {
    ringGrad = ctx.createConicGradient(0, cx, cy);
    const m = rgba(mix(RING, MAGENTA, 0.5), 1), t = rgba(mix(RING, TEAL, 0.5), 1);
    [[0, RING], [0.10, RING], [0.1667, t], [0.24, RING], [0.60, RING], [0.6667, m], [0.73, RING], [1, RING]]
      .forEach(([s, col]) => ringGrad.addColorStop(s, col));
  } else ringGrad = RING;

  const target = W < 700 ? 130 : 300;   // tuned so the steady state matches the opening sky
  while (points.length < target) points.push(spawn(true));
  points.length = target;
}

// Shared rotation sense, small per-point variation.
const spin = Math.random() < 0.5 ? 1 : -1;
function spawn(initial) {
  // On a phone the ring overflows the sides; only the caps above and below
  // show sky. Lean the births that way so the field isn't empty there.
  let a = Math.random() * TAU;
  if (W < H && Math.random() < 0.7) a = (Math.random() < 0.5 ? -1 : 1) * Math.PI / 2 + (Math.random() - 0.5) * 1.2;
  const p = {
    a,
    // Born just past the screen's corners, so the sky refills as fast as it drains
    // (born far out, a point took over a minute to arrive and the field thinned).
    rad: initial ? r + 6 + Math.random() * (maxR * 1.1 - r - 6) : maxR * (1.0 + Math.random() * 0.1),
    born: maxR * (1.0 + Math.random() * 0.1),
    w: spin * (2 + (Math.random() - 0.5) * 1.2) * Math.PI / 180,
    size: 0.9 + Math.random() * 1.1
  };
  if (initial) p.born = Math.max(p.born, p.rad + 1);
  return p;
}

// A tap in the field: a new point where it landed, a little brighter, that gathers speed over TAP_EASE s
// into a quicker infall (TAP_FALL px/s on top of the pull), so it crosses in a few seconds; its
// brightness settles over TAP_GLOW s.
const TAP_FALL = 80, TAP_EASE = 1.2, TAP_GLOW = 1.5, TAP_SIZE = 2.2;
function addTap(x, y, voice) {
  const dx = x - cx, dy = y - cy, rad = Math.hypot(dx, dy);
  if (reduced || rad <= r + 12) return null;
  const p = { a: Math.atan2(dy, dx), rad, born: rad + 1, w: spin * 2 * Math.PI / 180, size: TAP_SIZE,
              tap: { glow: 1, age: 0, voice, d0: Math.max(1, rad - r - 6) } };
  points.push(p);
  return p;
}
function step(dt) {
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const d = p.rad - r;
    // Gravity: a slow drift far out, then the pull runs away — speed grows exponentially
    // over the last ~100 px (≈7 px/s far, ≈50 at 60 px, ≈170 at the edge), and the swirl
    // tightens with it, so each point spirals and is swallowed.
    const pull = Math.exp(-d / 38);
    p.rad -= (p.tap ? (TAP_FALL + 175 * pull) * Math.min(1, (p.tap.age += dt) / TAP_EASE) : 7 + 175 * pull) * dt;
    p.a += (p.w * 120 / Math.max(p.rad, 1)) * (1 + 3 * pull) * dt;
    if (p.tap) {   // a tapped point: its tone sinks as it falls, and goes as it crosses
      p.tap.glow = Math.max(0, p.tap.glow - dt / TAP_GLOW);
      if (p.tap.voice) sound.tapRedshift(p.tap.voice, 1 - Math.max(0, d - 6) / p.tap.d0);
      if (p.rad <= r + 6) { if (p.tap.voice) sound.tapRelease(p.tap.voice, sound.TAP_CROSS); points.splice(i--, 1); }
      continue;
    }
    if (p.rad <= r + 6) points[i] = spawn(false);   // nothing enters the ring
  }
}

// Doppler beaming: a real photon ring is brighter on the side moving toward us.
// The bright side travels the ring once a minute, so it has weight and motion
// without getting louder. Drawn as short arcs so brightness can vary by angle.
const STOPS = 96, BEAM_PERIOD = 60000;
// Base tint by angle (fraction of a turn from 3 o'clock, clockwise): teal near 5, magenta near 11.
const near = (f, c, w) => { const d = Math.min(Math.abs(f - c), 1 - Math.abs(f - c)); return Math.exp(-(d * d) / (2 * w * w)); };
const tintAt = f => mix(rgba0(mix(RING, TEAL, 0.5 * near(f, 0.1667, 0.035))), MAGENTA, 0.5 * near(f, 0.6667, 0.035));
// Accretion light is clumpy: brightness churns along the ring (three drifting waves at
// incommensurate speeds) and hot spots flare, orbit and fade. Beaming still favours one side.
const spots = [];
const vis = { phi: 0, hot: 0, lift: 0, flare: 0 };   // ring state shared with the sound, written once per frame in drawRing; lift: the door's hover
function newSpot(t) {
  return { th: Math.random() * TAU, w: spin * (0.12 + Math.random() * 0.25), born: t,
           life: 4 + Math.random() * 7, sig: 0.09 + Math.random() * 0.1, peak: 0.35 + Math.random() * 0.35 };
}
function brightness(th, t, phi) {
  const beam = Math.pow((1 + Math.cos(th - phi)) / 2, 1.6);
  const turb = 0.5 + 0.5 * (0.5 * Math.sin(3 * th + 0.21 * t * spin) + 0.3 * Math.sin(7 * th - 0.37 * t + 1.3) + 0.2 * Math.sin(13 * th + 0.53 * t * spin + 2.1));
  let hot = 0;
  for (const sp of spots) {
    const age = t - sp.born, env = Math.sin(Math.PI * Math.min(1, Math.max(0, age / sp.life)));
    let d = Math.abs(((th - (sp.th + sp.w * age)) % TAU + TAU) % TAU); d = Math.min(d, TAU - d);
    hot += sp.peak * env * Math.exp(-(d * d) / (2 * sp.sig * sp.sig));
  }
  return Math.min(1, 0.12 + 0.88 * beam * (0.35 + 0.65 * turb) + hot * (0.4 + 0.6 * beam));
}
function ringGradient(bs, scale) {
  if (!ctx.createConicGradient) return rgba(mix(RING, RING, 0), 0.6 * scale);
  const g = ctx.createConicGradient(0, cx, cy);
  for (let i = 0; i <= STOPS; i++) g.addColorStop(i / STOPS, rgba(tintAt(i / STOPS), Math.min(1, bs[i % STOPS] * scale)));
  return g;
}
function drawRing(alpha, now) {
  const t = (now || 0) / 1000;
  if (!reduced) {
    while (spots.length < 3) spots.push(newSpot(t));
    for (let i = 0; i < spots.length; i++) if (t - spots[i].born > spots[i].life) spots[i] = newSpot(t);
  }
  const phi = ((now || 0) / BEAM_PERIOD) * TAU * spin;
  // What the sound is allowed to know: where the bright side is, how hot the spots are.
  vis.phi = phi; vis.hot = 0;
  for (const sp of spots) vis.hot += sp.peak * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - sp.born) / sp.life)));
  const bs = [];
  for (let i = 0; i < STOPS; i++) bs.push(brightness((i / STOPS) * TAU, t, phi));
  const pz = vis.pulse ? vis.pulse() : 0;   // the hum's slow pulse, 0–1; 0 when silent
  const lift = (1 + LIFT * vis.lift) * (1 + FLARE * vis.flare);   // the door, hovered or focused, or clicked (the flare): the whole ring brighter
  const k = (1 + 0.7 * pz) * lift;
  ctx.save();
  ctx.globalAlpha = alpha;
  const g0 = glow.s * r / r0;   // the glow was drawn for r0; follow the breathing edge
  ctx.drawImage(glow.c, cx - g0 / 2, cy - g0 / 2, g0, g0);
  if (vis.lift > 0.001) { ctx.globalAlpha = alpha * LIFT * vis.lift; ctx.drawImage(glow.c, cx - g0 / 2, cy - g0 / 2, g0, g0); ctx.globalAlpha = alpha; }
  if (vis.flare > 0.001) { ctx.globalAlpha = Math.min(1, alpha * FLARE * vis.flare); ctx.drawImage(glow.c, cx - g0 / 2, cy - g0 / 2, g0, g0); ctx.globalAlpha = alpha; }
  if (pz > 0.01) {
    // Brighter on the swell, never bigger: the glow's inner edge must stay on the horizon.
    ctx.globalAlpha = alpha * 0.6 * pz; ctx.drawImage(glow.c, cx - g0 / 2, cy - g0 / 2, g0, g0); ctx.globalAlpha = alpha;
  }
  // Outer profile: one soft band fading ~14px outward, fuller where the ring is bright.
  if ('filter' in ctx) {
    // Three passes, widest and faintest first: a long haze, a wash, then the body.
    ctx.filter = 'blur(18px)';
    ctx.strokeStyle = ringGradient(bs, 0.09 * k); ctx.lineWidth = 44 + 12 * pz;
    ctx.beginPath(); ctx.arc(cx, cy, r + 20, 0, TAU); ctx.stroke();
    ctx.filter = 'blur(19px)';
    ctx.strokeStyle = ringGradient(bs, 0.1 * k); ctx.lineWidth = 30;
    ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, TAU); ctx.stroke();
    ctx.filter = 'blur(7px)';
    ctx.strokeStyle = ringGradient(bs, 0.2 * (1 + 0.35 * pz) * lift); ctx.lineWidth = 14;
    ctx.beginPath(); ctx.arc(cx, cy, r + 7, 0, TAU); ctx.stroke();
    ctx.filter = 'none';
  } else {
    for (let k = 32; k >= 1; k--) {   // tight overlap so no grooves resolve; long, soft tail
      ctx.strokeStyle = ringGradient(bs, 0.22 * Math.pow(1 - k / 33, 2.8) * lift); ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(cx, cy, r + 0.5 + k * 1.1, 0, TAU); ctx.stroke();
    }
  }
  // The horizon itself: razor sharp on the inside, where light stops.
  ctx.strokeStyle = ringGradient(bs.map(b => 0.3 + 0.7 * b), lift); ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.restore();
}

// A dent in the field: the visitor's hand as a small mass. Particles near it are drawn where a lens would
// show them, nudged outward around it (nothing moves, nothing glows; the ring and sound don't know).
// It forms over DENT_RISE s wherever the hand is, trails it by DENT_FOLLOW s as it moves, and flattens
// over DENT_LEAVE s when the hand leaves. Touch: a finger on the screen. Off under reduced motion.
const DENT_STRENGTH = 28, DENT_RADIUS = 150, DENT_RISE = 0.6, DENT_FOLLOW = 0.15, DENT_LEAVE = 1.2;
const dent = { x: 0, y: 0, tx: 0, ty: 0, m: 0, on: false };
if (!reduced) {
  const at = (e) => {
    if (!dent.on) { dent.x = e.clientX; dent.y = e.clientY; }   // arrive where the hand is, don't sweep in from the last spot
    dent.tx = e.clientX; dent.ty = e.clientY; dent.on = true;
  };
  addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch' || e.buttons) at(e); }, { passive: true });
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') at(e); }, { passive: true });
  addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') dent.on = false; }, { passive: true });
  addEventListener('pointercancel', () => { dent.on = false; }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { dent.on = false; }, { passive: true });
  addEventListener('blur', () => { dent.on = false; });
}
function settleDent(dt) {
  const f = 1 - Math.exp(-dt / DENT_FOLLOW);   // the dent trails the hand a little, like a mass
  dent.x += (dent.tx - dent.x) * f; dent.y += (dent.ty - dent.y) * f;
  const tau = dent.on ? DENT_RISE / 3 : DENT_LEAVE / 3;
  dent.m += ((dent.on ? 1 : 0) - dent.m) * (1 - Math.exp(-dt / tau));
  if (dent.m < 0.001) dent.m = 0;
}
// The apparent shift (px) of a point at (x, y): outward from the dent, largest a little inside DENT_RADIUS.
function lens(x, y) {
  const dx = x - dent.x, dy = y - dent.y, d = Math.hypot(dx, dy) || 1, q = d / DENT_RADIUS;
  const k = (DENT_STRENGTH * dent.m * q * Math.exp(-q * q)) / d;
  return [dx * k, dy * k];
}
function drawPoints() {
  for (const p of points) {
    let x = cx + Math.cos(p.a) * p.rad, y = cy + Math.sin(p.a) * p.rad;
    if (dent.m && Math.abs(x - dent.x) < 3 * DENT_RADIUS && Math.abs(y - dent.y) < 3 * DENT_RADIUS) { const [lx, ly] = lens(x, y); x += lx; y += ly; }
    let t = Math.min(1, Math.max(0, 1 - (p.rad - r) / (p.born - r)));
    t = t * t;              // most of the warming happens near the ring
    const edge = Math.min(1, Math.max(0, (p.rad - r - 6) / 10));   // the last few px: gone into the glow
    const lit = p.tap ? p.tap.glow : 0;   // a tapped point starts brighter and settles to the field's own
    const alpha = Math.min(1, (0.2 + 0.55 * t) * edge + 0.6 * lit), size = p.size * (0.6 + 0.4 * edge) * (1 + 0.6 * lit);
    ctx.fillStyle = rgba(mix(rgba0(FAR), rgba0(NEAR), t), alpha);
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
}
const rgba0 = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');

let last = 0, t0 = performance.now(), raf = 0;
// The entrance's own clock (ms). It runs with the frames, so it stops while the page is hidden or frozen
// and goes on from there when it's back; one frame never moves it more than CLOCK_STEP, so nothing that
// fell due while the page was away arrives at once. The swings, the verse's drift and its cues read it.
const CLOCK_STEP = 250;
let clock = 1, cues = [];
const cue = (fn, ms) => cues.push({ fn, at: clock + ms });
function runCues() {   // due ones, earliest first; a cue may add cues or clear them all
  for (;;) {
    let k = -1;
    cues.forEach((c, i) => { if (c.at <= clock && (k < 0 || c.at < cues[k].at)) k = i; });
    if (k < 0) return;
    cues.splice(k, 1)[0].fn();
  }
}
const verseEl = document.querySelector('.verse');
let flow = null, flowY = 0;   // the verse's vertical offset while the entrance runs (see the entrance); null: in place
function frame(now) {
  const ms = now - last, dt = Math.max(0, Math.min(0.05, ms / 1000)); last = now;
  clock += Math.max(0, Math.min(CLOCK_STEP, ms));
  runCues();
  ctx.clearRect(0, 0, W, H);
  // The void breathes with the hum: up to 4.5% wider on each swell, back on the ebb.
  // Opening, growing with the verse, or closing: along the current swing's curve.
  if (apAt && clock >= apAt) {
    const p = Math.min(1, (clock - apAt) / apMs);
    aperture = apFrom + (apTo - apFrom) * apEase(p);
    if (p === 1) { apAt = 0; lastScale = -1; }   // land exactly
  }
  const sc = 1 + 0.045 * (vis.pulse ? vis.pulse() : 0), s = aperture * sc;
  r = r0 * s;
  if (Math.abs(s - lastScale) > 0.0002) { voidEl.style.transform = `translate(-50%, -50%) scale(${s.toFixed(4)})`; lastScale = s; }
  // The door's lift eases toward its target: up over ~0.5 s, down over ~0.8 s (fast once the entrance starts).
  const lt = liftOn && html.classList.contains('entering') ? 1 : 0;
  const tau = lt > vis.lift ? 0.17 : html.classList.contains('entering') ? 0.27 : 0.08;
  vis.lift += (lt - vis.lift) * (1 - Math.exp(-dt / tau)); if (vis.lift < 0.001) vis.lift = 0;
  if (flareAt) {   // the flare: up over FLARE_RISE ms, then away over FLARE_DECAY ms
    const ft = now - flareAt;
    vis.flare = ft < FLARE_RISE ? ft / FLARE_RISE : Math.exp(-(ft - FLARE_RISE) / FLARE_DECAY);
    if (vis.flare < 0.001) { vis.flare = 0; flareAt = 0; }
  }
  if (flow) { flowY = flow.at(clock, dt); verseEl.style.transform = `translateY(${flowY.toFixed(2)}px)`; }
  step(dt);
  settleDent(dt);
  drawPoints();
  drawRing(1, now - t0);
  sound.humTick(now);
  raf = requestAnimationFrame(frame);
}
function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
function stop() { cancelAnimationFrame(raf); raf = 0; }

function drawStatic() { ctx.clearRect(0, 0, W, H); drawRing(0.9, BEAM_PERIOD * 0.15); }
// The door, hovered, focused from the keyboard, or pressed: the ring lifts a little (LIFT, ~20%).
// Reduced motion: at once, no ease. Only at the door; the entrance lets it go.
const LIFT = 0.2, html = document.documentElement;
// A door clicked: the ring flares, stronger and quicker than the lift (FLARE extra brightness, rising over
// FLARE_RISE ms and falling away over FLARE_DECAY ms into the dive). Not under reduced motion.
const FLARE = 0.9, FLARE_RISE = 80, FLARE_DECAY = 500;
let flareAt = 0;
function flare() { if (!reduced) flareAt = performance.now(); }
let liftOn = false;
function lifted(on) {
  liftOn = on && html.classList.contains('entering');
  if (reduced) { vis.lift = liftOn ? 1 : 0; drawStatic(); }
}
{
  const doorIn = document.querySelector('.door-in');
  doorIn.addEventListener('pointerenter', () => lifted(true));
  doorIn.addEventListener('pointerleave', () => lifted(false));
  doorIn.addEventListener('focus', () => lifted(doorIn.matches(':focus-visible')));
  doorIn.addEventListener('blur', () => lifted(false));
  doorIn.addEventListener('click', () => lifted(false));
}

if (aperture < 1) { voidEl.style.transform = `translate(-50%, -50%) scale(${SHUT.toFixed(4)})`; lastScale = SHUT; }
layout();
if (reduced) {
  drawStatic();
  addEventListener('resize', () => { layout(); drawStatic(); });
} else {
  addEventListener('resize', layout);
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  start();
}

// The sound, as the field needs it: the hum's per-frame tick and a tap tone's redshift and release.
// Set by main.js (the field doesn't import the hum, so it can load first).
export const sound = { humTick() {}, tapRedshift() {}, tapRelease() {}, TAP_CROSS: 0 };
// For the entrance, which can't assign another module's bindings: clear the cues, set the verse's flow.
export function clearCues() { cues = []; }
export { flare };
export function setFlow(f, y) { flow = f; if (y !== undefined) flowY = y; }
const snapTo = (a) => { aperture = a; voidEl.style.transform = a < 1 ? `translate(-50%, -50%) scale(${a.toFixed(4)})` : ''; layout(); drawStatic(); };

export {
  reduced, TAU, voidEl, verseEl, W, H, cx, cy, r, maxR, points, SHUT, SWING_MS, bezier, swing, aperture,
  CLOSE_MS, DRAWIN_LEAD, expoInOut, layout, addTap, vis, dent, DENT_STRENGTH, DENT_RADIUS, DENT_RISE,
  DENT_FOLLOW, DENT_LEAVE, lens, clock, cue, flowY, drawStatic, snapTo,
};
