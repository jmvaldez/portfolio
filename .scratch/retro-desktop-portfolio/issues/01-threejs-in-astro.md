# Three.js / R3F inside Astro

Type: research
Status: open
Blocked by: —

## Question

How should `@react-three/fiber` live inside an Astro 5 island, for a site whose
content pages must stay near-zero JS?

Establish: which Astro client directive is correct for a canvas that is
below-the-fold-ish but interactive (`client:visible` vs `client:idle` vs
`client:only`); whether R3F can be server-rendered at all or must be `client:only`;
how to code-split three.js so content pages never pay for it; realistic gzipped
bundle cost of three + R3F + drei for the features this map needs (an orbitable
low-poly model, a grid shader); the canonical way to honour `prefers-reduced-motion`
and to tear the context down when the window is closed; and known Astro + R3F
integration pitfalls (hydration, HMR, Tailwind 4 interop).

Primary sources only: Astro docs, R3F/drei docs, three.js docs and release notes.
