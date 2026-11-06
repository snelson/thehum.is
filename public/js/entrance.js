// The way in: the door, the verse a line at a time (its clock and cues), the name it settles on, the skip
// and its guards (#10), the field taps' input, and the reset. And the way out: the dive.
import {
  reduced, cx, cy, r, maxR, SHUT, bezier, swing, aperture, CLOSE_MS, DRAWIN_LEAD, expoInOut,
  addTap, clock, cue, snapTo, clearCues, flare, lift,
} from './field.js';
import { btn, on, graph, tearDown, destroy, tapTone, setAimTuneIn, diveFade, diveFall } from './hum.js';

// ---- The way in ------------------------------------------------------------
// The door enters with the hum on, through the name's own switch; "silently" enters with it off. Either
// way the entrance is remembered. The end mark at the foot runs it backwards, to the door.
const root = document.documentElement, door = document.querySelector('.door'), reset = document.querySelector('.verse-reset');
const mark = btn;   // the name at the centre is the hum's switch
const lines = [...document.querySelectorAll('.verse p > span')];
const breaks = new Set([...document.querySelectorAll('.verse p + p > span:first-child')].map((l) => lines.indexOf(l)));
// The verse at reading pace, one line on screen at once, at the void's centre. A line comes in (IN s, the
// CSS's --line-in), holds (its HOLD, s), goes (OUT s, --line-out), and GAP s later the next comes in; the
// stanza break is a longer breath (BREAK s more). The first line comes in FIRST s after the tap. Tune by ear.
const css = (k, d) => parseFloat(getComputedStyle(root).getPropertyValue(k)) || d;
const IN = css('--line-in', 0.9), OUT = css('--line-out', 0.7), MARK_IN = css('--mark-in', 1.8);
const FIRST = 2.0, GAP = 0.15, BREAK = 0.8;
const HOLD = [
  1.1,   // Nothing.                          as the void opens
  1.0,   // Something.
  1.6,   // No thing, some thing.
  1.4,   // The original beat.
  1.2,   // Became sound.
  0.9,   // Light.
  1.0,   // Form.
  1.4,   // Everything is this.               after the stanza's breath
  1.3,   // Still enough to hear
  1.0,   // that it becomes                   close behind: one sentence across the lines
  1.9,   // through us.                       held: the arrival
];
// When each line comes in and starts to go (s after the tap), and when the name comes in: MARK_PAUSE s
// after the last line has gone. landing(): the name in and the void full; the hum's opening glide aims at it.
const MARK_PAUSE = 0.6;
const plan = (() => {
  let t = FIRST;
  return lines.map((_, i) => {
    if (breaks.has(i)) t += BREAK;
    const on = t, off = t + IN + (HOLD[i] ?? 1.4);
    t = off + OUT + GAP;
    return { on, off };
  });
})();
const markAt = plan[plan.length - 1].off + OUT + MARK_PAUSE;
const landing = () => markAt + MARK_IN * 0.6;
// The void grows with the verse: from the tap, one slow curve from the door's third to full, landing as
// the name comes in (so retuning HOLD moves it too). Quick at first, so each line has room inside it.
const GROW_EASE = bezier(0.15, 0.45, 0.5, 1);
const SKIP_MS = 800, SKIP_EASE = bezier(0.42, 0, 0.58, 1);   // a skip: the void to full on an ease-in-out
// Then the end mark and the doors come in, MARK_AFTER s after the name.
const MARK_AFTER = 1.2;
let armed = false, swallow = false, swallowTimer = 0, refocus = false, readTimer = 0;
const show = (i) => lines.forEach((l, n) => l.classList.toggle('on', n === i));
function halt() { clearCues(); clearTimeout(readTimer); armed = false; }
function unpace() {
  halt();
  root.classList.remove('pacing', 'skipped', 'marked', 'reading', 'read-out');
  show(-1);
}
let markTimer = 0;
function markLater(secs) {
  clearTimeout(markTimer);
  markTimer = setTimeout(() => {
    root.classList.add('mark-in'); root.classList.remove('quiet-mark');
    markTimer = setTimeout(() => root.classList.remove('mark-in'), 1600);
  }, secs * 1000);
}
function settle() {   // the name comes in and stays
  root.classList.add('marked');
  if (refocus) { refocus = false; mark.focus({ preventScroll: true }); }
}
function pace() {
  root.classList.add('pacing', 'quiet-mark');
  swing(1, clock, landing() * 1000, GROW_EASE);
  plan.forEach(({ on, off }, i) => {
    cue(() => { armed = true; show(i); }, on * 1000);
    cue(() => show(-1), off * 1000);
  });
  cue(settle, markAt * 1000);
  cue(() => { armed = false; markLater(MARK_AFTER); }, markAt * 1000 + 1);
  cue(() => root.classList.remove('pacing'), (markAt + MARK_IN + 0.2) * 1000);
}
// Reduced motion: the verse whole and still (.reading) for READ_HOLD s or until a tap or a key, then one
// crossfade (.read-out, 0.8 s) to the name. Timers, not cues: no frames run.
const READ_HOLD = 12;
function read() {
  root.classList.add('reading', 'quiet-mark');
  armed = true;
  readTimer = setTimeout(skip, READ_HOLD * 1000);
}
// Never trap a reader: once the first line is up, a tap, a wheel or a key shows the rest. Only what the
// visitor does counts: not a modifier on its own or a shortcut (Cmd-Tab away), not a trackpad's momentum
// from a flick made before the first line, not a scroll (a touch that scrolls starts with a tap; the
// page also scrolls when a phone turns or its toolbar folds).
function skip() {
  if (!armed) return false;
  halt();
  if (root.classList.contains('reading')) {
    root.classList.add('read-out');
    readTimer = setTimeout(() => { root.classList.remove('reading', 'read-out'); markLater(0.6); }, 800);
    return true;
  }
  root.classList.add('skipped');
  show(-1);
  swing(1, clock, SKIP_MS, SKIP_EASE);   // the void to full; the line goes (0.4 s), then the name
  cue(settle, 400);
  cue(() => { markLater(MARK_AFTER); root.classList.remove('pacing', 'skipped'); }, 400 + MARK_IN * 1000);
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
  if (root.matches('.entering, .opening, .pacing, .leaving, .diving')) return;
  if (e.target.closest && e.target.closest('button, a, .door, .ways')) return;
  const d = Math.hypot(e.clientX - cx, e.clientY - cy) - r;
  if (d <= 12) return;
  addTap(e.clientX, e.clientY, tapTone(e.clientX, d / Math.max(1, maxR - r)));
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
  if (reduced) read(); else pace();
  root.classList.add('opening'); root.classList.remove('entering', 'arriving');
  if (reduced) {
    root.classList.add('dark');
    setTimeout(() => { snapTo(1); root.classList.remove('dark'); }, 600);
  }
  setTimeout(() => {
    root.classList.remove('opening');
    if (focused && root.matches('.pacing:not(.marked), .reading')) refocus = true;   // the name isn't in yet: focus it when it is
    else if (focused) mark.focus({ preventScroll: true });
  }, reduced ? 1500 : 4000);
}
function leave() {
  if (root.matches('.entering, .opening, .leaving')) return;
  try { localStorage.removeItem('hum.entered'); localStorage.removeItem('hum.heard'); } catch (e) {}
  const focused = document.activeElement === reset;
  if (on) btn.click();   // the name's own switch: the hum fades over 2 s
  clearTimeout(markTimer); root.classList.remove('mark-in');   // the end mark goes first (CSS: .leaving)
  halt(); refocus = false;
  show(-1);   // a line still up goes with the name
  root.classList.add('leaving');
  if (reduced) root.classList.add('dark');
  // The name starts falling in; DRAWIN_LEAD later the void closes after it, and the door comes back as it lands.
  let back = false;
  const door_ = () => { if (back) return; back = true;
    if (reduced) { snapTo(SHUT); root.classList.remove('dark'); }   // the hum's 2 s fade may outlast this; enter() clears it
    unpace(); root.classList.remove('quiet-mark');   // the door, for the next entrance
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

// ---- The way out ----------------------------------------------------------
// Leaving through a door implodes into the void: together, over DIVE_MS and gathering speed, the void
// closes to a point at the centre (the ring, glow and infall follow it in), the verse, the name and the
// doors are drawn in after it, the chosen door last, the end mark fades, and the hum falls away. Then
// the next page, once. A new-tab click goes straight through.
// Reduced motion: a quick fade to dark (DIVE_DARK ms), then the next page. Back (from the cache): as before.
const DIVE_MS = 1100, DIVE_DARK = 350, DIVE_EASE = bezier(0.7, 0, 0.84, 0);   // easeInExpo: a slow lean, then the fall
// Then a hang in the void before the next page (DIVE_HANG ms; DIVE_HANG_REDUCED under reduced motion), while
// the hum's fall reaches its depths and fades. As the hang begins the stage goes out (.dark, over the CSS's
// --dive-out), so the hang ends on a dark beat and a light page next doesn't flash.
const DIVE_HANG = 1100, DIVE_HANG_REDUCED = 250;
let diving = false, darkTimer = 0;
function go(href) {
  if (location.hash === '#humdebug' && window.__holdNav) { window.__navs = (window.__navs || 0) + 1; window.__navTo = href; window.__navAt = performance.now(); return; }
  location.href = href;
}
document.querySelectorAll('.ways a').forEach((a) => a.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  if (diving) return;
  diving = true;
  const secs = reduced ? DIVE_DARK : DIVE_MS, hang = reduced ? DIVE_HANG_REDUCED : DIVE_HANG;
  a.classList.add('chosen');   // at once: the door brightens, its caret jumps out, the other door goes (CSS)
  flare(); lift(null); diveFall(secs / 1000, hang / 1000);
  diveFade(secs / 1000, hang / 1000);
  root.classList.add('diving');
  if (reduced) root.classList.add('dark');
  else {
    swing(0, clock, DIVE_MS, DIVE_EASE);   // the void to a point
    darkTimer = setTimeout(() => root.classList.add('dark'), DIVE_MS);   // as it lands: the stage goes out
  }
  setTimeout(() => go(a.href), secs + hang + 30);
}));
addEventListener('pageshow', (e) => {   // back from the next page: as it was before the dive
  if (!e.persisted || !diving) return;
  diving = false;
  clearTimeout(darkTimer);
  root.classList.remove('diving', 'dark');
  document.querySelectorAll('.ways a.chosen').forEach((x) => x.classList.remove('chosen'));
  snapTo(1);
});

export { landing };
