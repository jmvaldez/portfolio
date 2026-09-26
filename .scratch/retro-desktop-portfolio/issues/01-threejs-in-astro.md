# Three.js / R3F inside Astro

Type: research
Status: resolved
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

## Answer

**Directive: `client:only="react"` on the desktop shell, with the three.js scene
behind a `React.lazy()` boundary inside it.** R3F *can* be server-rendered — verified,
`<Canvas>` renders to `div > div > canvas` and nothing else, because the renderer is
built in a layout effect — but that SSR payload is an empty box and it costs you
something real: Astro externalises `@react-three/fiber` for SSR, which `require()`s
three's CJS entry, which now emits `THREE_CJS_DEPRECATED` and is slated for removal.
`client:only` keeps three out of Node entirely and unlocks `slot="fallback"` for an
in-world "INITIALIZING VIDEO SUBSYSTEM…" boot line. Do not reach for
`vite.ssr.noExternal` to paper over it — that combination breaks `astro dev` outright
(`detect-gpu` named-export failure via drei).

`client:media` is the one serious alternative and is still worth knowing: the directive
hands its value straight to `matchMedia` and only then dynamic-imports the island, so
`client:media="(min-width: 1024px) and (prefers-reduced-motion: no-preference)"`
implements both of the map's 3D constraints at the network layer. The recommended
synthesis keeps both ideas: `client:only` for the shell, a runtime `matchMedia` gate on
the lazy 3D import.

**Content pages stay free automatically.** A page with no island built to 106 bytes of
HTML and zero script tags. The only real discipline is keeping three out of the shell's
static import graph — with `React.lazy`, `index.html` carries no modulepreload for the
scene chunk and it is fetched only when `viewer.exe` opens.

**Measured cost** (real `astro build`, Astro 7.3.5 / three r186 / fiber 9.8.1 / drei
10.7.9): the 3D chunk — three + R3F + drei `OrbitControls` + `Grid` — is **237 KB gzip
/ 196 KB brotli** (904 KB raw). Shell without 3D is ~69 KB gzip (mostly react-dom).
drei is *not* the weight: OrbitControls is ~5 KB, the whole drei set ~28 KB, and
dropping drei for `three/examples/jsm` saves only ~8 KB. three is ~85% of it, and
`<Canvas>` calls `extend(THREE)` on the whole namespace, so it cannot be tree-shaken;
the `createRoot` escape hatch would save ~57 KB but costs a hand-maintained element
catalogue and is not worth it here.

**Reduced motion** has no first-party helper in R3F or drei — it is `matchMedia` at
three layers: gate the import (layer 1), flip `frameloop` to `demand`/`never` if
already mounted (layer 2, and the prop *is* live-reapplied), Tailwind 4's built-in
`motion-safe:`/`motion-reduce:` variants for the CRT chrome (layer 3).

**Teardown is already handled.** In fiber 9.8.1, unmounting `<Canvas>` disconnects
events, disposes the scene, disposes the renderer and calls `forceContextLoss()` —
R3F's source says so explicitly, "browsers cap live WebGL contexts, so the context is
lost after it". But R3F's own pitfalls doc argues against remounting: minimise a window
by keeping it mounted at `frameloop="never"`, and only unmount on an explicit close.

Two things for the captain, neither of which I acted on. **The map's "Astro 5" is
stale** — Astro 6 shipped 2026-03-10, Astro 7 on 2026-06-22, 7.3.5 yesterday; nothing
in this answer changes between 5 and 7, but a repo started today should start on 7.
And **drei's `useGLTF` defaults its DRACO decoder to a gstatic.com CDN** — self-host it
before the drone lands.

Full research, with every measurement, source citation and the nine remaining
integration pitfalls:
`.scratch/retro-desktop-portfolio/research/01-threejs-in-astro.md`
