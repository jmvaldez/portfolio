# WebGL scene composition

Type: prototype
Status: resolved
Blocked by: —

## Question

The design calls for two 3D things at once: an ambient vector grid behind the whole
desktop, and an orbitable drone inside a draggable `viewer.exe` window. Prototype it and
decide how they compose.

Resolve: one WebGL context with two viewports, or two separate contexts, or a single
full-viewport canvas that the window "cuts a hole" into; what happens to the drone canvas
while its window is being dragged and resized (re-render every frame, or freeze to a
bitmap); the frame budget and what it costs on integrated graphics; how the contexts are
created and destroyed as windows open and close; and the fallback path on mobile and under
`prefers-reduced-motion`.

Resolve with the prototype linked as an asset and measured frame timings, not estimates.

## Inputs from resolved research

Carried here by tickets `01` and `03`, which each deferred their last open question to
this prototype:

- **Evaluate drei's `<View>` first.** It is the standing answer to "one canvas or two",
  and the 237 KB three chunk is shared either way, so the decision is about the browser's
  live-context cap and about resize behaviour, not about bytes.
- **Does a ~388-triangle procedural quad actually read as an FPV drone at `viewer.exe`
  scale?** This is the only genuine unknown left in the drone recommendation. If it
  doesn't read, the fallback is a $5.99 Sketchfab Standard model or a CC BY 3.0
  poly.pizza quad — see ticket `03`.
- **Use drei's `<Edges>` for the wireframe, not `LineBasicMaterial`.** `linewidth` is
  ignored by WebGL and WebGPU; a 1 px hairline will not survive the scanline overlay.
- **Frame cost on integrated graphics is unmeasured.** Bytes are known, milliseconds are
  not. Measure, don't estimate.
- **Confirm Fast Refresh behaviour with a module-scope `ShaderMaterial`** under
  `astro dev`. Ticket `01` reasoned about this hazard but did not reproduce it; ten
  minutes here settles it.
- **The canvas shader pass is the only place a post-process can live.** A WebGL pass
  cannot touch DOM text; the shell's CRT treatment is CSS (ticket `02`). This prototype
  owns making the two layers agree so the canvas doesn't read as a different material
  from the chrome around it.

## Resolution

**Variant B — one canvas, drei `<View>`.** One WebGL context for the whole shell; the
ambient grid is a `<View track={#desktop}>`, each `viewer.exe` a `<View>` tracking its
own window body. Opening windows adds views, never contexts. Chosen by Joe on the
prototype, with the measurements below agreeing.

### Measured — the numbers, not estimates

`M` benchmark, headless Chrome 151 on the real GPU (ANGLE / NVIDIA RTX 3060 Laptop,
OpenGL 4.5), driven over CDP. Four scripted 2.5s phases.

**Light case** — DPR 1, low grid density, one `viewer.exe`, CRT pass on:

| variant | idle | dragging | resizing | orbiting | contexts |
|---------|------|----------|----------|----------|----------|
| A | 60 fps / 16.7ms | 60 / 16.7 | 60 / 16.7 | 60 / 16.7 | 2 |
| B | 60 fps / 16.7ms | 60 / 16.7 | 60 / 16.7 | 60 / 16.7 | 1 |
| C | 60 fps / 16.7ms | 60 / 16.7 | 60 / 16.7 | 60 / 16.7 | 1 |

Vsync-capped in every phase: **the light case discriminates nothing.** The comparison
only becomes real under stress.

**Stress** — DPR 2, high grid density (120x120), five `viewer.exe` windows, CRT on.
p50 / p95 / max in ms:

| variant | idle | dragging | resizing | orbiting | contexts |
|---------|------|----------|----------|----------|----------|
| A | 60 fps, 16.7 / 19.2 / 23.6 | 47 fps, 20.9 / 30.3 / 64.2 | 46 fps, 20.5 / 28.3 / **109.3** | 58 fps | 6 |
| B | 60 fps, 16.7 / 18.3 / 21.0 | 39 fps, 19.9 / 43.4 / 57.6 | 34 fps, 26.0 / 45.0 / 66.6 | 60 fps | 1 |
| C | **16 fps**, 89.5 / 123.5 / 327.5 | 12 fps | 10 fps | 9 fps | 1 |

- **C collapses** — unusable before any window is touched. Cause undiagnosed; it may be
  a prototype inefficiency (per-frame unprojection plus `getBoundingClientRect` on every
  hole, five of them) rather than something inherent to hole-cutting. Not worth chasing:
  B is at least as good on every other axis.
- **B beats A on the worst frame** (66.6ms vs 109.3ms) and on idle, and holds 60 while
  orbiting. A wins the p50 during drag/resize (20.9 vs 26.0) because each of its contexts
  is independently small.
- **A's draw-call and triangle figures are not trustworthy** — the HUD samples a single
  renderer, and A has one per window, so it reported 2 calls / 2 triangles against B and
  C's 212 / 13002. Frame timings for A are sound; its geometry counters are not.

### `drag mode: freeze` does not work for a shared canvas

Measured, and it inverts the expectation. B with `freeze` under the same stress:
**35 fps dragging / 29 resizing, max 122ms** — worse than B live (39 / 34, max 66.6).

The reason is structural, not a tuning problem. Freeze-to-bitmap pays off only if
freezing lets something stop rendering. In A it does: a per-window canvas drops to
`frameloop="never"`. In B and C the single canvas must keep running for the ambient
grid, so a frozen window pays the full render cost *plus* a `toDataURL` of the whole
2880x1800 canvas at every gesture start. **Freeze is A-only.**

B's equivalent lever is `<View frames={0}>` or `visible={false}` on the dragged
window's view — stop that view, keep the grid. Not implemented in the prototype and
not measured. This is an implementation detail for the build, not an open decision.

### The "post-process cannot compose with `<View.Port>`" finding was wrong

The first pass reported this as a genuine cost of B and left the CRT toggle inert.
It is a property of that `CRTPass`, which assumes it owns the only render — not of
drei's `<View>`. drei's `Container` sets viewport and scissor and calls `gl.render()`;
it **never calls `setRenderTarget`**. So the pass brackets `View.Port` rather than
replacing it (`shared/CRTViewPass.jsx`):

```
priority 0.5   bind the offscreen target, clear it
priority 1     the <View>s scissor-render into it, untouched
priority 10    unbind, reset the viewport, draw the CRT quad
```

~50 lines, no reimplementation of View.Port's compositing, verified rendering grid,
drone and scanlines across the full viewport. **Ticket 02's hybrid treatment survives
intact under B.**

### Answers to the ticket's other questions

- **One context or two** — one. B holds at `contextCount: 1` with five viewers open;
  A reached 6. The browser context cap never has to be reasoned about at all, which
  removes the whole `webglcontextlost` failure mode rather than instrumenting it.
- **What happens during drag/resize** — re-render live. drei reads the tracked
  element's `getBoundingClientRect()` every frame through `View.Port`'s own loop, so
  resize tracking needs no wiring and stays glued during the gesture. Freeze is not
  available (above).
- **Context lifecycle as windows open and close** — a non-question under B. Windows add
  and remove `<View>`s against one context that lives as long as the shell. Ticket 01's
  minimise-keeps-mounted / close-unmounts distinction still holds for the canvas itself.
- **The drone reads.** ~388 triangles with drei `<Edges>` is legible as an FPV quad at
  seed size; it degrades below roughly 120px on a side, props first. Procedural stands;
  ticket 03 needs no revisiting.
- **Views do not clear their rect.** drei sets `autoClear = false`, so in B the drone
  composites over whatever the grid drew there — `viewer.exe` looks onto the *same*
  world as the desktop floor, not into its own void. A can only do the opposite. This
  was invisible until the layering bug was fixed, and it is a look worth keeping.

### Left unmeasured, deliberately

- **Integrated graphics.** Every number above is the discrete RTX 3060. Two attempts to
  force headless Chrome onto this machine's AMD Cezanne iGPU produced a page that loaded
  but never rendered, and the attempt was abandoned rather than faked. The DPR-2 /
  high-density stress column is the stand-in: it is the load at which this GPU starts
  missing frames, not proof of what an iGPU does. **Check the real thing before the
  frame budget is treated as settled.**
- **Fractional DPR.** Measured at DPR 1 and an emulated DPR 2 only. Ticket 06's
  soft-edged scanline fix remains unverified on 1.25x / 1.5x hardware.
- **Mobile fallback and `prefers-reduced-motion`** are implemented as toggles
  (`shared/poster.js` renders a static poster through a throwaway offscreen renderer)
  but were not judged by eye. The map already constrains both; nothing here contradicts
  it.

## Prototype

Branch `prototype/07-webgl-scene`, at
`.scratch/retro-desktop-portfolio/prototypes/07-webgl-scene/`. Vite + React 19 +
`three@0.186.1` / `@react-three/fiber@9.8.1` / `@react-three/drei@10.7.9`.
`pnpm install && pnpm dev`. Three variants on `?variant=A|B|C`; `S` state panel,
`V` viewport rig, `M` benchmark, toggle bar top-left.

Three commits: the build, the layering fix, the CRT-pass bracket. The benchmark was
driven over CDP with `bench.mjs` (throwaway, in the session scratchpad — `M` by hand
does the same thing).
