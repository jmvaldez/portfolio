# WebGL scene composition

Type: prototype
Status: open
Blocked by: 01, 04

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
