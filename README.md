# thehum.is

The philosophical root of The Hum. One page (`public/happening.html`, served at thehum.is/happening; `/` redirects there), served by
a Cloudflare Worker with static assets (`wrangler.jsonc`) at thehum.is and
www. Workers Builds deploys `main`, so a push to `main` publishes; other
branches get preview URLs.

Thesis: alignment is not sameness. It's the tension of differences, held,
on the edge between sameness and noise. Development notes live in Brain
(`Ideas/thehum-is.md`), not here; this repo is public.

The page: a still void exactly centered, its photon ring (sharp inner edge,
soft beamed haze, slow turbulence and hot spots) drawn live in a canvas, faint
points falling inward around it. A hand near the horizon bends the field
around it. The inward counterpart to scotty.is/alive.

The entrance: on a first visit the void starts closed, a third of its size,
with THE HUM in it; tapping it is the way in. The void opens slowly while the
verse plays at its centre one line at a time, only one line on screen at
once: each comes in, holds at reading pace and goes before the next (about
30 s in all). Then the Hum's mark (the favicon's ring) comes in at the
centre and stays: it is the page's name. studio and works sit on the horizon
as doors, and the end mark at the foot, a small turning arrow, plays the
entrance again from the door. A tap, a key or a wheel skips to the mark. A
return visit opens on the mark. The verse stays in the page for screen
readers, hidden to the eye only; without JavaScript it shows as a still
block. Reduced motion: no sequence; the verse comes in whole and still, then
crossfades to the mark after its reading time, or on a tap or a key.

The mark is also the switch for the sound: tap it to toggle (off by default;
"tap to hear" under it while it's off), and the door's tap enters with it on
("or silently", off). On, the mark hums: brighter, its glow swelling every
2 s. The sound (`public/js/hum.js`) is a generative drone on the year tone,
Earth's orbit raised 32 octaves (136.10 Hz; root an octave down at 68.05 Hz,
C♯), in just ratios: a synth floor, upper harmony and a humming choir. The
chord walks slowly between neighbours on the same root on uneven timing, now
and then one tone blooms into vibrato, and a string section swells in every
minute or two. It follows the ring: it leans toward the bright side and
swells with hot spots, and while it plays the void, ring and sound breathe
together on the year tone slowed 10 more octaves (one swell every ~7.5 s). A
tap in the field adds a point and, with the hum on, a tone that falls in
with it. Leaving through a door, the hum falls away with the dive. Debug hook
only with #humdebug.

thehum.ing, the hum playing on its own, is a third door, quieter, at the
bottom of the rim.
