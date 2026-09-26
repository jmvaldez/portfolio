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
