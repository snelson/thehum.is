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

Listening is thehum.ing's: the mark is the way there, and leaving through it
dives into the void as the doors do. The page itself makes no sound.

The drone (`public/js/hum.js`) stays in the repo but is not loaded: nothing
on the page reaches it. It was a generative drone on the year tone, Earth's
orbit raised 32 octaves (136.10 Hz; root an octave down at 68.05 Hz, C♯),
in just ratios, whose chord walked slowly between neighbours on the same
root, breathed with the void and followed the ring. To bring it back, import
it in `public/js/main.js` and give it a switch (id `hum`) and a hint (id
`hum-hint`).

When thehum.studio is live, add a quiet link beside thehum.works in the footer.
