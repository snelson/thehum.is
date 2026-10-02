// The way in: the door, the paced verse (its clock, streaming, drift), the name and the end mark, the
// skip and its guards (#10), the field taps' input, and the reset.
import {
  reduced, voidEl, verseEl, cx, cy, r, maxR, SHUT, bezier, swing, aperture, CLOSE_MS, DRAWIN_LEAD, expoInOut,
  addTap, clock, cue, flowY, snapTo, clearCues, setFlow,
} from './field.js';
import { btn, on, graph, tearDown, destroy, tapTone, setAimTuneIn } from './hum.js';

// ---- The way in ------------------------------------------------------------
// The circle enters with the hum on, through the header's own switch; "silently" enters with
// it off. Either way the entrance is remembered. The reset under the links runs it backwards.
const root = document.documentElement, door = document.querySelector('.door'), reset = document.querySelector('.verse-reset');
const lines = document.querySelectorAll('.verse p > span');
// The verse at reading pace, on the entrance only. Each number is the pause, in seconds, before
// its line starts to fade in; the first counts from the tap. Tune by ear.
const PACE = [
  2.4,   // Nothing.                          as the void settles
  1.5,   // Something.
  1.7,   // No thing, some thing.             a little room
  2.2,   // The original beat.                its own breath (room after the long comma above)
  2.1,   // Became sound.                     a held beat after the origin, then the change
  1.8,   // Light.                            held
  1.9,   // Form.                             held
  2.6,   // Everything is this.               held after "Form.", a breath at the stanza break
  1.8,   // Still enough to hear              its own breath
  1.4,   // that it becomes                   close behind: one sentence across the lines
  2.6,   // through us.                       held: the arrival (~23 s)
];
// A comma's beat inside a line, where it differs from COMMA_MS (ms, by line index). Tune by ear.
const COMMA_BEAT = {
  2: 600,   // No thing, | some thing.
};
const landing = () => PACE.reduce((a, p) => a + p, 0) + FADE;   // the void full, the verse landed: s after the tap
const FADE = 1.2;   // a line's arrival: its row opens (0.9 s) and its letters stream and fade in
// Within a line: a beat per letter (spaces too), a longer one after a comma or a full stop.
const LETTER_MS = 50, COMMA_MS = 150, STOP_MS = 250;
const beat = (c, n) => LETTER_MS + (c === ',' ? (COMMA_BEAT[n] ?? COMMA_MS) : c === '.' ? STOP_MS : 0);
// The void grows with the verse: from the tap, one slow curve from the door's third to full, landing
// as the last line finishes its fade (so retuning PACE moves it too). Quick enough at first to hold
// "Nothing." with room, steady through the middle, a soft settle; it stays ahead of the opening rows.
const GROW_EASE = bezier(0.2, 0.25, 0.6, 1);
const SKIP_MS = 800, SKIP_EASE = bezier(0.42, 0, 0.58, 1);   // a skip: the rows' ease-in-out
let armed = false, swallow = false, swallowTimer = 0, refocus = false;
// While pacing, each line is letters for the eye (aria-hidden) and its whole text for the ear.
// Measured once, at the start: the line's width and how far each letter reaches, so the
// letters can sit where they end up and slide by half of what's still to come.
const texts = [...lines].map((l) => l.firstElementChild.textContent);
let streams = [];
function split() {
  streams = [...lines].map((l, n) => {
    const box = l.firstElementChild, text = texts[n];
    const sr = document.createElement('span'), ink = document.createElement('span');
    sr.className = 'sr'; sr.textContent = text;
    ink.className = 'ink'; ink.setAttribute('aria-hidden', 'true');
    const chs = [...text].map((c) => { const ch = document.createElement('span'); ch.className = 'ch'; ch.textContent = c; return ch; });
    ink.append(...chs); box.replaceChildren(sr, ink);
    const r = ink.getBoundingClientRect();
    let reach = 0;   // a space reaches no further than the letter before it
    const ends = chs.map((ch, i) => (text[i] === ' ' ? reach : (reach = ch.getBoundingClientRect().right - r.left)));
    ink.style.transform = `translateX(${r.width / 2}px)`;
    return { ink, chs, ends, w: r.width, text };
  });
}
function unsplit() { lines.forEach((l, n) => { l.firstElementChild.textContent = texts[n]; }); streams = []; }
function stream(n) {
  const { ink, chs, ends, w, text } = streams[n];
  let t = 0;
  chs.forEach((ch, i) => {
    cue(() => { ch.classList.add('on'); ink.style.transform = `translateX(${(w - ends[i]) / 2}px)`; }, t);
    t += beat(text[i], n);
  });
}
// The drift: the verse keeps what's visible close to the centre. "Nothing." arrives at the centre and
// holds. Each later line's place is made ahead of it: from LEAD s before it starts (never before the
// line above has begun its last letter) the verse glides to centre the lines with it, pre-shifting at
// most half a line, so what's visible stays within half a line of the centre and a line usually streams
// into place without moving. A bigger step (the stanza gap) finishes over POST s as its line streams.
// A light critically damped follow (SMOOTH s) rounds the joins; no overshoot. Whatever's left after the
// last line starts eases out, so the verse lands in place as the void reaches full.
const LEAD = 0.9, POST = 0.6, SMOOTH = 0.12;
const lastLetter = (n) => [...texts[n]].slice(0, -1).reduce((a, c) => a + beat(c, n), 0) / 1000;
const rowsNow = () => [...lines].map((l) => { const r = l.getBoundingClientRect(); return [r.top - flowY, r.bottom - flowY]; });
const centring = (rows, k) => innerHeight / 2 - (rows[0][0] + rows[k][1]) / 2;
const smooth = (p) => { p = Math.min(1, Math.max(0, p)); return p * p * (3 - 2 * p); };
function follow(t0, end) {
  const rows = rowsNow(), half = (rows[0][1] - rows[0][0]) / 2;
  const starts = PACE.map((p, i) => PACE.slice(0, i + 1).reduce((a, b) => a + b, 0));
  const leads = starts.map((s0, i) => (i ? s0 - Math.min(LEAD, s0 - starts[i - 1] - lastLetter(i - 1)) : s0));
  const c = starts.map((s0, k) => centring(rows, k));
  const pre = c.map((ck, k) => (k ? Math.max(-half, Math.min(half, ck - c[k - 1])) : 0));   // the part made ahead
  const lastAt = starts[starts.length - 1], w = 1 / SMOOTH;
  const target = (t) => {
    let k = 0; while (k + 1 < starts.length && t >= starts[k + 1]) k++;
    const n = k + 1;
    if (n < starts.length && t >= leads[n]) return c[k] + pre[n] * smooth((t - leads[n]) / (starts[n] - 0.15 - leads[n]));   // made just before it starts
    if (k && t < starts[k] + POST) return c[k - 1] + pre[k] + (c[k] - c[k - 1] - pre[k]) * smooth((t - starts[k]) / POST);
    return c[k];
  };
  let x = c[0], v = 0;
  return { at(now, dt) {
    const t = (now - t0) / 1000;
    if (t < leads[1]) return x;
    v += (w * w * (target(t) - x) - 2 * w * v) * dt; x += v * dt;
    const e = t <= lastAt ? 0 : Math.min(1, (t - lastAt) / (end - lastAt));
    return x * (1 - e * e * (3 - 2 * e));
  } };
}
// A skip: from wherever the verse is to `to`, on the void's own way from here to `apTo`.
function tie(to, apTo) {
  const from = flowY, ap0 = aperture;
  return { at() { const f = apTo === ap0 ? 1 : Math.min(1, Math.max(0, (aperture - ap0) / (apTo - ap0))); return from + (to - from) * f; } };
}
function halt() { clearCues(); armed = false; }
function unpace() {
  halt();
  root.classList.remove('pacing', 'skipped', 'landed');
  setFlow(null, 0); verseEl.style.transform = '';
  unsplit();
}
// The close: once the last line has landed and the void is full, a pause (HEAD_PAUSE s), then the name
// rises in at the top (HEAD_RISE s, as .landed in the CSS), then the end mark (the reset) fades in
// MARK_AFTER s after the name has landed. A skip runs it without the pause.
const HEAD_PAUSE = 1.2, HEAD_RISE = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--head-rise-time')) || 1.8, MARK_AFTER = 1.0;
let markTimer = 0;
function markLater(secs) {
  clearTimeout(markTimer);
  markTimer = setTimeout(() => {
    root.classList.add('mark-in'); root.classList.remove('quiet-mark');
    markTimer = setTimeout(() => root.classList.remove('mark-in'), 1600);
  }, secs * 1000);
}
function land() {   // the name comes back at the top
  root.classList.add('landed');
  if (refocus) { refocus = false; btn.focus({ preventScroll: true }); }
}
function pace() {
  const end = landing();
  root.classList.add('pacing');
  split();   // after .pacing, so the letters are born hidden (no fade-out from a first, plain style)
  setFlow(follow(clock, end));
  swing(1, clock, end * 1000, GROW_EASE);
  let at = 0;
  lines.forEach((l, i) => {
    at += PACE[i] || 0;
    cue(() => { armed = true; stream(i); }, at * 1000);
  });
  const landed = Math.max(end, at + lastLetter(lines.length - 1) + 0.4), named = landed + HEAD_PAUSE;
  cue(land, named * 1000);
  root.classList.add('quiet-mark');
  cue(() => { unpace(); markLater(MARK_AFTER - 0.2); }, (named + HEAD_RISE + 0.2) * 1000);
}
// Never trap a reader: once the first line is up, a tap, a wheel or a key shows the rest. Only what the
// visitor does counts: not a modifier on its own or a shortcut (Cmd-Tab away), not a trackpad's momentum
// from a flick made before the first line, not a scroll (a touch that scrolls starts with a tap; the
// page also scrolls when a phone turns or its toolbar folds).
function skip() {
  if (!armed) return false;
  armed = false;
  halt();
  root.classList.add('skipped');
  for (const { ink, chs } of streams) {   // the streaming line glides to rest; lines yet to come just appear there
    if (!chs[0].classList.contains('on')) ink.style.transition = 'none';
    chs.forEach((ch) => ch.classList.add('on')); ink.style.transform = '';
  }
  setFlow(tie(0, 1));
  markLater(SKIP_MS / 1000 + MARK_AFTER);   // the name rises over the skip's 0.8 s (CSS), then the mark
  land(); swing(1, clock, SKIP_MS, SKIP_EASE);   // with the void to full and the name back
  cue(unpace, FADE * 1000);   // lets any line mid-fade finish its own
  return true;
}
// The tap that skips is spent on it: it doesn't also flip the hum or follow a link. Same for
// Enter or Space on a focused control. The reset is left alone; it takes the verse down itself.
addEventListener('pointerdown', (e) => {
  if (reset.contains(e.target) || !skip()) return;
  swallow = true; clearTimeout(swallowTimer); swallowTimer = setTimeout(() => { swallow = false; }, 1000);
}, true);
addEventListener('pointercancel', () => { swallow = false; }, true);
addEventListener('click', (e) => { if (swallow && e.isTrusted) { swallow = false; e.preventDefault(); e.stopPropagation(); } }, true);
const SHORTCUT = /^(Shift|Control|Alt|AltGraph|Meta|OS|Super|Hyper|CapsLock|Fn|FnLock|NumLock|ScrollLock|Symbol|SymbolLock)$/;
addEventListener('keydown', (e) => {
  if (SHORTCUT.test(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.activeElement === reset || !skip()) return;
  if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
}, true);
// A wheel gesture is a run of events less than WHEEL_GAP ms apart; one begun before the first line is
// up never skips, however long its momentum lasts. Events with no travel don't count.
const WHEEL_GAP = 300;
let wheelAt = -Infinity, wheelEarly = false;
addEventListener('wheel', (e) => {
  if (e.timeStamp - wheelAt > WHEEL_GAP) wheelEarly = !armed;
  wheelAt = e.timeStamp;
  if (!wheelEarly && (e.deltaX || e.deltaY)) skip();
}, { passive: true });
// A tap in the field, once entered (during the entrance a tap skips; at the door nothing new): a point
// where it landed, and, with the hum on, its tone. Taps on the name, links, the end mark or any button
// behave as before. Outside the ring only.
addEventListener('pointerdown', (e) => {
  if (root.matches('.entering, .opening, .pacing, .leaving')) return;
  if (e.target.closest && e.target.closest('button, a, .head, .door, .foot')) return;
  const d = Math.hypot(e.clientX - cx, e.clientY - cy) - r;
  if (d <= 12) return;
  const u = d / Math.max(1, maxR - r);
  addTap(e.clientX, e.clientY, tapTone(e.clientX, u));
}, { passive: true });
// The pointer goes quiet after the tap that enters (not on touch: there's nothing to hide), and comes
// back on its first real move, or if the page loses focus or is hidden. Only listened for while hidden.
let tapType = '', tapAt = { x: 0, y: 0 };
door.addEventListener('pointerdown', (e) => { tapType = e.pointerType; tapAt = { x: e.clientX, y: e.clientY }; });
const showCursor = () => {
  root.classList.remove('cursor-hidden');
  removeEventListener('pointermove', moved); removeEventListener('blur', showCursor);
  document.removeEventListener('visibilitychange', showCursor);
};
const moved = (e) => { if (e.clientX !== tapAt.x || e.clientY !== tapAt.y) showCursor(); };
function hideCursor() {
  if (tapType === 'touch') return;
  root.classList.add('cursor-hidden');
  addEventListener('pointermove', moved, { passive: true }); addEventListener('blur', showCursor);
  document.addEventListener('visibilitychange', showCursor);
}
function enter(listen) {
  if (!root.classList.contains('entering')) return;
  hideCursor();
  try { localStorage.setItem('hum.entered', '1'); } catch (e) {}
  const focused = door.contains(document.activeElement);
  if (graph && !on) { clearTimeout(tearDown); destroy(); }   // a reset's fade still running: listen builds fresh and tunes in
  if (listen) { setAimTuneIn(true); btn.click(); }
  if (!reduced) pace();
  root.classList.add('opening'); root.classList.remove('entering', 'arriving');
  if (reduced) {
    root.classList.add('dark');
    setTimeout(() => { snapTo(1); root.classList.remove('dark'); }, 600);
  }
  setTimeout(() => {
    root.classList.remove('opening');
    if (focused && root.matches('.pacing:not(.landed)')) refocus = true;   // the name isn't back yet: focus it when it is
    else if (focused) btn.focus({ preventScroll: true });
  }, reduced ? 1500 : 4000);
}
function leave() {
  if (root.matches('.entering, .opening, .leaving')) return;
  try { localStorage.removeItem('hum.entered'); localStorage.removeItem('hum.heard'); } catch (e) {}
  const focused = document.activeElement === reset;
  if (on) btn.click();   // the header's own switch: the hum fades over 2 s
  clearTimeout(markTimer); root.classList.remove('mark-in');   // the end mark goes first (CSS: .leaving)
  halt(); refocus = false;
  setFlow(null);   // the verse holds where it is and is drawn in from there
  root.classList.add('leaving');
  if (reduced) root.classList.add('dark');
  // The verse starts falling in; DRAWIN_LEAD later the void closes after it, and the door comes back as it lands.
  let back = false;
  const door_ = () => { if (back) return; back = true;
    if (reduced) { snapTo(SHUT); root.classList.remove('dark'); }   // the hum's 2 s fade may outlast this; enter() clears it
    unpace(); root.classList.remove('quiet-mark');   // the door: the verse back in place, unseen, for the next entrance
    root.classList.add('entering', 'arriving'); root.classList.remove('leaving');
    if (focused) door.querySelector('.door-in').focus({ preventScroll: true });
    setTimeout(() => root.classList.remove('arriving'), 1200);
  };
  if (reduced) setTimeout(door_, 600);
  else {
    swing(SHUT, clock + DRAWIN_LEAD * 1000, CLOSE_MS, expoInOut);
    cue(door_, DRAWIN_LEAD * 1000 + CLOSE_MS);   // as the void lands
  }
}
door.querySelector('.door-in').addEventListener('click', () => enter(true));
door.querySelector('.door-quiet').addEventListener('click', () => enter(false));
reset.addEventListener('click', leave);

export { landing };
