# Research: Three.js / R3F inside Astro

Resolves ticket `.scratch/retro-desktop-portfolio/issues/01-threejs-in-astro.md`.
Date: 2026-09-25.

All numbers below were measured locally against a throwaway Astro build (see
[Measurement method](#measurement-method)), not estimated. All behavioural claims
cite either official docs or the shipped source of the package in question.

## Versions this was measured against

| package | version | notes |
| --- | --- | --- |
| `astro` | **7.3.5** (2026-09-24) | latest stable |
| `@astrojs/react` | 7.0.0 | Oxc JSX transform, Fast Refresh |
| `vite` | 8.3.1 | via Astro 7 |
| `react` / `react-dom` | 19.3.0 | |
| `three` | 0.186.1 (r186, 2026-09-24) | |
| `@react-three/fiber` | 9.8.1 | v9 pairs with React 19 |
| `@react-three/drei` | 10.7.9 | |

> **The map's "Astro 5" constraint is stale.** npm registry timestamps: Astro 5.0.0
> shipped 2024-12-03, the last 5.x (5.18.2) 2026-05-26, Astro 6.0.0 2026-03-10,
> Astro 7.0.0 2026-06-22, 7.3.5 2026-09-24. A greenfield repo started today should
> start on Astro 7. Nothing in this ticket's answer depends on 5 vs 7 -- the island
> model and every `client:*` directive are unchanged -- but Astro 7 swaps in the Rust
> compiler (stricter about unclosed/invalid HTML) and Vite 8.
> Source: <https://docs.astro.build/en/guides/upgrade-to/v7/> ("Rust compiler",
> "Vite 8"); `npm view astro time`.

---

## 1. Which client directive

**Recommendation: `client:only="react"` on the desktop-shell island, and put the
three.js scene behind a `React.lazy()` boundary inside it.**

Reasoning, in order of how much it matters.

### R3F *can* be server-rendered, but SSR buys you literally nothing

I ran `renderToString(<Canvas><OrbitControls/><mesh/></Canvas>)` in Node and built the
same component through Astro with `client:visible`. Both succeed. The entire
server-rendered output is:

```html
<div style="position:relative;width:100%;height:100%;overflow:hidden;pointer-events:auto">
  <div style="width:100%;height:100%">
    <canvas style="display:block"></canvas>
  </div>
</div>
```

That is the whole SSR payload: an empty box. It matches the source -- `Canvas.tsx`
renders that div/div/canvas tree eagerly, but creates the renderer and renders the
three.js children inside `useIsomorphicLayoutEffect`, which is a no-op on the server.
Source: `packages/fiber/src/web/Canvas.tsx` (the `useIsomorphicLayoutEffect` block that
calls `createRoot` / `root.configure` / `root.render`).

So SSR of the canvas is safe (no crash, no hydration mismatch) but produces zero
useful HTML.

### SSR has a real cost: it drags three into the Node build, via a deprecated entry

Astro externalises `@react-three/fiber` for SSR, which resolves to fiber's CJS build,
which does `require('three')`. three's CJS entry now self-deprecates:

```
/**
 * The CommonJS build of three is deprecated. three is ESM-only going forward;
 * this entry now re-exports the ES module via require(esm) and will be removed
 * in a future release.
 */
process.emitWarning('`require("three")` is deprecated and will be removed.' ...,
  { type: 'DeprecationWarning', code: 'THREE_CJS_DEPRECATED' })
```

Source: `three@0.186.1/build/three.cjs` lines 1-17 (shipped in the package).

Reproduced: every static route that server-renders the Canvas emits
`THREE_CJS_DEPRECATED` at build time. Today it is only a warning; when three removes
the CJS entry, SSR of R3F breaks until fiber ships an ESM-only server build.
`client:only` never loads three in Node at all -- verified, the warning disappears for
the `client:only` route and fires only for the `client:visible` route in the same build.

**Do not try to fix this with `vite.ssr.noExternal`.** I tried
`ssr: { noExternal: ['three', '@react-three/fiber', '@react-three/drei'] }`: it does
*not* suppress the warning, and it **breaks `astro dev` outright** with
`SyntaxError: Named export 'getGPUTier' not found. The requested module 'detect-gpu'
is a CommonJS module`. Removing the option returns dev to HTTP 200. Leave Astro's SSR
externalisation at its default.

### client:only gives you a first-class in-world loading state

`slot="fallback"` is supported on `client:only` and is exactly the hook the Fallout /
POST voice wants:

```astro
<DesktopShell client:only="react">
  <div slot="fallback" class="hud-crosshair">INITIALIZING VIDEO SUBSYSTEM...</div>
</DesktopShell>
```

Source: <https://docs.astro.build/en/reference/directives-reference/#client-only>
("Display loading content"). Verified in the built HTML: Astro emits the fallback as a
real child of `<astro-island>` plus a `<template data-astro-template="fallback">`, and
the React root replaces it on mount.

### Why not the other three

- **`client:visible`** -- wrong tool here. The desktop shell *is* the landing
  experience; it is above the fold. Note also that the implementation observes
  `el.children`, not the island itself, "because `astro-island` is set to
  `display: contents`" (`packages/astro/src/runtime/client/visible.ts`). With
  `client:only` there are no SSR children to observe, so the two do not combine.
  `client:visible` is right for a *secondary* canvas further down a page, if one ever
  appears.
- **`client:idle`** -- `requestIdleCallback` on a landing page whose entire point is
  the canvas means the hero arrives late and jankily. Good fit for the taskbar clock,
  not for the scene.
- **`client:media`** -- see below; genuinely attractive, and the one real alternative
  to `client:only`. It loses only because of the CJS/SSR issue and the fallback slot.

### The client:media alternative (and why it is still worth knowing)

`client:media` never calls the loader until the query matches:

```ts
const mediaDirective = (load, options) => {
  const cb = async () => { const hydrate = await load(); await hydrate() }
  if (options.value) {
    const mql = matchMedia(options.value)
    if (mql.matches) cb()
    else mql.addEventListener('change', cb, { once: true })
  }
}
```

Source: `packages/astro/src/runtime/client/media.ts`.

Because the value is an arbitrary CSS media query string handed straight to
`matchMedia`, this works and is verified in the built HTML:

```astro
<DesktopShell client:media="(min-width: 1024px) and (prefers-reduced-motion: no-preference)" />
```

That single attribute implements *both* of the map's 3D constraints -- desktop-only,
and off under `prefers-reduced-motion` -- at the network layer: no bytes at all are
fetched for the island on a phone or for a reduced-motion user. It also upgrades live
if the user widens the window (the `change` listener). The trade-off is that it
*requires* SSR (so you eat the three-in-Node problem) and has no fallback slot.

**Recommended synthesis -- keep both.** Put the *shell* (window manager, taskbar,
terminal -- no three.js) on `client:only="react"` so it always works, and gate the *3D*
inside React on `matchMedia` at runtime (section 4). You get `client:only`'s fallback
slot and no-SSR safety, and still ship zero three.js bytes to phones and
reduced-motion users because the lazy chunk is never imported.

---

## 2. Keeping three.js off the content pages

This is not something you have to engineer -- it falls out of Astro's defaults, and I
verified it end to end.

> "By default, Astro will automatically render every UI component to just HTML & CSS,
> **stripping out all client-side JavaScript automatically.**"
> -- <https://docs.astro.build/en/concepts/islands/>

A content page with no island built to **106 bytes** of HTML and **zero** `<script>`
tags, zero JS assets referenced. Islands are per-page and per-component: the built
`_astro/` directory contained separate hashed chunks for `client` (react-dom),
`react`, `scheduler`, `jsx-runtime`, the shell, and the scene.

**The one thing you do have to do** is keep the three.js import out of the shell's own
module graph, or opening the desktop downloads three whether or not `viewer.exe` is
ever opened. `React.lazy` is sufficient:

```jsx
const Scene = lazy(() => import('./Scene.jsx'))
// ...
{open && <Suspense fallback={<Booting />}><Scene /></Suspense>}
```

Verified in the build output: `index.html` contains **no** `modulepreload` for the
scene chunk; the shell chunk (1.1 KB gzip) holds a Vite dynamic-import helper that
injects `<link rel="modulepreload">` for `Scene` + `OrbitControls` only when the lazy
component is first rendered. Rollup also dedupes the scene chunk across pages that both
reference it (same content hash).

Note the same applies to the ambient grid. If the grid lives in the shell's static
import graph it is not lazy. If the map's "ambient grid behind the whole desktop"
should appear immediately, that is a deliberate ~237 KB gzip on the landing route --
see the budget below and ticket 07.

---

## 3. Real bundle cost

Measured from an actual `astro build` (Rollup/Rolldown via Vite 8, esbuild minify,
`NODE_ENV=production`), gzip -9 and brotli -q 11 computed on the emitted files.

### The realistic scene for this map

`<Canvas frameloop="demand" dpr={[1,2]}>` + drei `<OrbitControls>` + drei
`<Grid infiniteGrid>` + a mesh:

| chunk | raw | **gzip** | brotli |
| --- | --- | --- | --- |
| scene chunk (three + fiber + drei) | 904.3 KB | **237.1 KB** | 195.7 KB |
| `react-dom/client` | 204.5 KB | 63.0 KB | 54.4 KB |
| `react` | 8.3 KB | 3.2 KB | 2.9 KB |
| `scheduler` | 3.5 KB | 1.5 KB | 1.4 KB |
| `jsx-runtime` | 0.4 KB | 0.3 KB | 0.2 KB |
| shell island | 2.0 KB | 1.1 KB | 0.9 KB |
| **shell alone (no 3D)** | | **~69 KB** | **~60 KB** |
| **shell + 3D** | | **~306 KB** | **~256 KB** |

Astro also inlines its `<astro-island>` custom element plus the directive shim into
each page that hosts an island: ~5.1 KB uncompressed HTML (about 2 KB on the wire).

### Where the weight actually is (esbuild isolation tests, gzip)

| entry | gzip | what it tells you |
| --- | --- | --- |
| `react-dom/client` only | 67.5 KB | baseline |
| `import * as THREE` (whole namespace retained) | 187.8 KB | -- |
| `import * as THREE`, only `Scene` + `WebGLRenderer` reachable | 131.2 KB | tree-shaking saves ~57 KB |
| `<Canvas>` + a cube | 312.1 KB | so R3F itself is about **57 KB** |
| `<Canvas>` + drei `OrbitControls` | 317.0 KB | OrbitControls about **5 KB** |
| `<Canvas>` + drei `OrbitControls` + `useGLTF` | 337.7 KB | GLTFLoader path about **21 KB** |
| same, with `three/examples/jsm` instead of drei | 329.5 KB | drei costs about **8 KB** over hand-rolling |
| `<Canvas>` + `OrbitControls` + `Grid` + `Bounds` + `useGLTF` | 340.5 KB | full feature set |

**Conclusions:**

1. **drei is not the problem.** Every drei component this map needs costs 5-28 KB gzip
   combined; dropping drei for `three/examples/jsm` saves about 8 KB and costs you
   `<Grid>`, `<Bounds>`, invalidate-on-change wiring, and `<Html>`. Use drei.
2. **three is about 85% of the payload, and `<Canvas>` forbids tree-shaking it.**
   `Canvas.tsx` does `React.useMemo(() => extend(THREE as any), [])` -- the whole
   namespace, unconditionally. That is why `<Canvas>` + a cube costs 187.8 KB of three
   rather than the 131.2 KB a reachability-limited import would. The escape hatch is
   documented under "Tree-shaking" / "CreateRoot" in <https://r3f.docs.pmnd.rs/api/canvas>
   ("the underlying reconciler no longer pulls in the THREE namespace automatically...
   enables tree-shaking via the `extend` API").
3. **The `createRoot` escape hatch saves about 57 KB (three) + about 40 KB (react-dom),
   but is not worth it here.** The docs pitch it as shaving "react-dom (~40kb),
   react-use-measure (~3kb) and... pointer-events (~7kb)" -- but the window manager is
   React and Astro's React island hydrator loads `react-dom/client` regardless, so the
   40 KB is already spent. That leaves about 57 KB of three for a hand-maintained
   `extend({...})` catalogue that breaks at runtime the first time someone adds a
   `<lineDashedMaterial>`. **Recommendation: use `<Canvas>`, accept the 237 KB, and
   spend the effort on the lazy boundary instead.** Revisit only if a measured budget
   forces it.

### Suggested budget for the map

- Content pages: **0 KB JS** (already true by construction).
- Desktop shell landing, before any 3D: **<= 80 KB gzip**.
- 3D chunk, lazy: **<= 260 KB gzip** (measured 237 KB, leaves room for the grid shader).
- Mobile / reduced-motion: **0 KB** of the 3D chunk.

---

## 4. prefers-reduced-motion

There is **no first-party helper**. drei 10.7.9 exports 220 names; none match
`/reduced|prefers/` (`useMotion` is `MotionPathControls`, unrelated). R3F has nothing
either. So the canonical answer is plain `matchMedia`, applied at three layers.

**Layer 1 -- never download it (strongest).** Either
`client:media="(min-width: 1024px) and (prefers-reduced-motion: no-preference)"`
(verified: the compound query is passed through to `matchMedia` intact), or, with
`client:only`, gate the `lazy()` import:

```jsx
const allow3D = window.matchMedia(
  '(min-width: 1024px) and (prefers-reduced-motion: no-preference)'
).matches
```

Both give literally zero three.js bytes on the wire.

**Layer 2 -- if it is already mounted, stop the loop.** `frameloop` accepts
`always | demand | never` and *is* re-applied on prop change: "Subsequent changes to
`dpr`, `frameloop`, `performance`, and `shadows` apply the new prop value."
(<https://r3f.docs.pmnd.rs/api/canvas>, "Updating configuration"). Subscribe to the
media query and flip `frameloop` to `"never"`, or to `"demand"` so it still repaints on
user-driven orbit but never animates on its own. Prefer `"demand"` plus explicit
`invalidate()`: on-demand rendering "will only render when necessary... All you need to
do is set the canvas `frameloop` prop to `demand`", and "Drei's controls do this
automatically for you" (drei's `OrbitControls` calls `invalidate` on change).
Source: <https://r3f.docs.pmnd.rs/advanced/scaling-performance> ("On-demand rendering").

**Layer 3 -- CSS for the chrome.** Tailwind 4 ships `motion-safe:` and `motion-reduce:`
out of the box:

```ts
staticVariant('motion-safe',   ['@media (prefers-reduced-motion: no-preference)'])
staticVariant('motion-reduce', ['@media (prefers-reduced-motion: reduce)'])
```

Source: `packages/tailwindcss/src/variants.ts`.

Use layer 3 for scanlines / CRT flicker / boot sequence; layer 1 for the canvas.

---

## 5. Tearing down the WebGL context

**Unmounting the `<Canvas>` is sufficient in R3F 9.8.1. Do not write manual teardown.**

`unmountComponentAtNode` (which `Canvas`'s `useInsertionEffect` cleanup calls) does, in
order: `state.internal.active = false`, `state.events.disconnect()`,
`state.xr.disconnect()`, `dispose(state.scene)`, `disposeRenderer(gl)`. And
`disposeRenderer` is explicit about the context:

```
/**
 * Frees a renderer R3F built. WebGLRenderer.dispose() releases programs and caches but keeps its
 * context until garbage collection, and browsers cap live WebGL contexts, so the context is lost
 * after it.
 */
... attempt(() => gl.dispose()) ... attempt(() => gl.forceContextLoss?.())
```

Source: `packages/fiber/src/core/root.tsx` (verified present in the installed 9.8.1
dist bundle).

Ownership matters if you ever pass your own renderer: "Omitted or a props object / A
sync or async factory -> R3F owns the renderer it creates and disposes it on unmount.
A renderer instance -> You own the renderer and are responsible for calling
`dispose()`." (<https://r3f.docs.pmnd.rs/api/canvas>, "Ownership"). Do not pass an
instance.

Astro's React client also unmounts cleanly on view-transition navigation -- it
registers `element.addEventListener("astro:unmount", () => r.unmount(), { once: true })`
(`@astrojs/react/dist/client.js`), and the `<astro-island>` `disconnectedCallback`
dispatches `astro:unmount` on `astro:after-swap`. So if the site ever adopts
`<ClientRouter />`, navigating away from the desktop disposes the context for free.

### But: prefer *not* unmounting when viewer.exe closes

R3F's own guidance is the opposite of "tear it down":

> "In threejs it is very common to not re-mount at all... because buffers and materials
> get re-initialized/compiled, which can be expensive." -- "Avoid mounting runtime",
> "Consider using visibility instead"
> <https://r3f.docs.pmnd.rs/advanced/pitfalls>

Recommended lifecycle for a window manager:

- **Window minimised / hidden** -> keep mounted, set `frameloop="never"`. Costs one
  live context, costs zero CPU/GPU.
- **Window closed by the user** -> unmount the `<Canvas>`. The teardown above runs and
  the context is released. Re-opening pays shader recompilation, which is the correct
  price for an explicit close.
- **Never** keep more than a couple of live contexts. Browsers cap them (R3F's own
  comment, cited above). If the design ends up with the grid *and* the drone as two
  canvases, read drei's `<View>` -- it renders multiple viewports out of one context
  and is the thing ticket 07 should evaluate first.

---

## 6. Astro + R3F integration pitfalls

**Confirmed by reproduction:**

1. **`ssr.noExternal` for drei breaks `astro dev`.** `SyntaxError: Named export
   'getGPUTier' not found. The requested module 'detect-gpu' is a CommonJS module.`
   HTTP 500 on any page importing the component. Removing the option gives 200.
2. **`THREE_CJS_DEPRECATED` on every SSR'd R3F route.** Harmless today, build-time
   only, static output unaffected. Avoided entirely by `client:only`. See section 1.
3. **Dev is much heavier than prod.** Vite prebundles `@react-three/drei` to a 3.0 MB
   file and the fiber/three chunk to 2.3 MB (`node_modules/.vite/deps`, unminified) --
   about 5.3 MB over localhost on first dev load of the scene, against 904 KB raw /
   237 KB gzip in the production build. Do not judge the budget from the dev tab.
4. **CSS imported by a `client:only` component is not dropped** in Astro 7 -- it is
   inlined into the page head. (A long-standing Astro complaint; verified fixed here.)
   Safe to co-locate a `scene.css` with the island.
5. **Astro does not wrap islands in `StrictMode`.** `@astrojs/react/dist/client.js`
   calls `hydrateRoot` / `createRoot` inside `startTransition` with no StrictMode
   wrapper, so you will not get double context creation in dev. Relevant because R3F v9
   changed this: "StrictMode is now correctly inherited from a parent renderer like
   react-dom" and "This release contains breaking changes when using Strict Mode"
   (<https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide>). If you add `<StrictMode>`
   yourself, expect double-mount effects inside the canvas.
6. **HMR is Fast Refresh via Oxc.** "By default, `@astrojs/react` uses Oxc to compile
   your JSX and enable Fast Refresh."
   (<https://docs.astro.build/en/guides/integrations-guide/react/>). The R3F-side
   hazard is module-scope three.js objects (shared geometries/materials created outside
   the component, per "Re-using geometries and materials" in
   <https://r3f.docs.pmnd.rs/advanced/scaling-performance>) -- Fast Refresh does not
   re-run module scope, so an edited shader or material can appear not to update. Hard
   reload when a shader edit looks ignored. *(Not reproduced here -- see Open
   questions.)*
7. **Functions cannot be passed as props into an island.** "functions... can only be
   used during the component's server rendering" and are not serialisable across the
   island boundary (<https://docs.astro.build/en/guides/framework-components/>). All
   shell config must be JSON-serialisable; callbacks live inside the island.
8. **Children into a React island are parsed as plain strings, not React nodes**
   (<https://docs.astro.build/en/guides/integrations-guide/react/>, "Children
   parsing"). Compose the desktop inside React, not by slotting `.astro` into it.
9. **drei's `useGLTF` hits a third-party CDN by default.**
   `let decoderPath = 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/'`
   (`@react-three/drei/core/Gltf.js:8`). If the drone is draco-compressed, self-host
   and call `useGLTF.setDecoderPath('/draco/')`, or ship the model uncompressed. Note
   also that drei loads GLTFLoader from `three-stdlib`, not `three/examples/jsm` -- a
   separate transitive dependency.
10. **`eventSource` + `pointerEvents`.** For a full-viewport ambient canvas sitting
    *behind* DOM windows, pass `eventSource` (an ancestor element or ref).
    `Canvas.tsx` then sets the wrapper to `pointer-events: none` -- "When the event
    source is not this div, we need to set pointer-events to none / Or else the canvas
    will block events from reaching the event source". Without it the canvas eats every
    click meant for the window manager.

**Tailwind 4 interop -- no conflict, one gotcha.**

- Astro >= 5.2 installs Tailwind 4 as a Vite plugin: `npx astro add tailwind` gives
  `@tailwindcss/vite` plus `@import "tailwindcss"`. The `@astrojs/tailwind`
  integration is Tailwind-3 legacy only.
  <https://docs.astro.build/en/guides/styling/#tailwind>
- Preflight sets `canvas { display: block; vertical-align: middle }`
  (`packages/tailwindcss/preflight.css`), which agrees with R3F's own inline
  `style="display:block"` on the canvas. No fight.
- **Gotcha:** R3F's wrapper is `width:100%; height:100%`, and Tailwind 4's preflight
  does *not* set `html, body { height: 100% }`. Give the canvas an ancestor with a real
  height (`h-dvh` on the shell root, or an explicit height on the window body) or the
  canvas collapses to zero -- and because `client:visible` observes children,
  IntersectionObserver behaviour on a zero-height box becomes another thing to debug.

---

## Measurement method

Two throwaway sandboxes under the session scratchpad. Nothing was installed into this
repo.

1. **`astrotest/`** -- a real Astro 7.3.5 project with `@astrojs/react` and four
   routes: a plain content page, a shell island using `client:media` + `React.lazy`, a
   `client:visible` page that server-renders the Canvas, and a `client:only="react"`
   page with a `slot="fallback"`. `astro build`, then gzip/brotli every emitted `.js`.
   Also `astro dev` against each route, to catch dev-only failures.
2. **`bundletest/`** -- nine esbuild entries (`--bundle --minify --format=esm
   --define:process.env.NODE_ENV="production"`) isolating react-dom, the three
   namespace, tree-shaken three, `<Canvas>`, drei components, and the `createRoot`
   path, to attribute the weight. Plus a `react-dom/server` `renderToString` of
   `<Canvas>` to settle the SSR question directly.

Astro numbers are authoritative for budgeting (real Rollup/Rolldown output); esbuild
numbers are for *attribution* between packages and run about 2-3% heavier.

## Sources

- Astro client directives: <https://docs.astro.build/en/reference/directives-reference/#client-directives>
- Astro islands / zero-JS default: <https://docs.astro.build/en/concepts/islands/>
- Astro framework components: <https://docs.astro.build/en/guides/framework-components/>
- Astro React integration: <https://docs.astro.build/en/guides/integrations-guide/react/>
- Astro Tailwind 4: <https://docs.astro.build/en/guides/styling/#tailwind>
- Astro view transitions: <https://docs.astro.build/en/guides/view-transitions/>
- Astro v7 upgrade guide: <https://docs.astro.build/en/guides/upgrade-to/v7/>
- Astro directive implementations (`media.ts`, `visible.ts`, `idle.ts`): <https://github.com/withastro/astro/tree/main/packages/astro/src/runtime/client>
- R3F Canvas API: <https://r3f.docs.pmnd.rs/api/canvas>
- R3F scaling performance: <https://r3f.docs.pmnd.rs/advanced/scaling-performance>
- R3F performance pitfalls: <https://r3f.docs.pmnd.rs/advanced/pitfalls>
- R3F v9 migration guide: <https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide>
- R3F installation / version pairing: <https://r3f.docs.pmnd.rs/getting-started/installation>
- R3F `Canvas.tsx`: <https://github.com/pmndrs/react-three-fiber/blob/master/packages/fiber/src/web/Canvas.tsx>
- R3F `root.tsx`: <https://github.com/pmndrs/react-three-fiber/blob/master/packages/fiber/src/core/root.tsx>
- drei `useGLTF` draco path: `@react-three/drei@10.7.9/core/Gltf.js`
- three.js r186 release: <https://github.com/mrdoob/three.js/releases/tag/r186>
- three.js CJS deprecation: `three@0.186.1/build/three.cjs` (shipped file header)
- Tailwind 4 preflight: <https://github.com/tailwindlabs/tailwindcss/blob/main/packages/tailwindcss/preflight.css>
- Tailwind 4 variants: <https://github.com/tailwindlabs/tailwindcss/blob/main/packages/tailwindcss/src/variants.ts>

## Open questions

- **Astro 5 vs 7 for this repo.** Not mine to decide; flagged for the map. If 5 is kept
  deliberately, re-run the bundle measurement -- Astro 5 uses Vite 6 and chunking may
  differ.
- **Fast Refresh + R3F specifically.** Pitfall 6 is reasoned from the R3F docs plus how
  Fast Refresh works; it was not reproduced. Resolvable in ten minutes during the
  ticket-07 prototype: edit a module-scope `ShaderMaterial` with `astro dev` running
  and see whether the change lands.
- **Two canvases vs one.** Whether the grid and the drone share a context (drei
  `<View>`) is ticket 07's call; the browser context cap and the ~237 KB shared chunk
  are the inputs it needs from here.
- **Real frame cost on integrated graphics.** Bytes are measured; milliseconds are not.
  Ticket 07 owns that.
