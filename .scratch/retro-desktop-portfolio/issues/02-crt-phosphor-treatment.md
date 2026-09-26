# CRT / phosphor treatment: how is it actually rendered?

Type: research
Status: resolved
Blocked by: —

## Question

The phosphor spine implies scanlines, bloom, and possibly barrel distortion. What are
the real options for applying that over an interface made mostly of DOM text, and what
does each cost?

Compare: a CSS-only overlay (repeating-linear-gradient scanlines, text-shadow glow,
blend modes) applied to the whole page; an SVG/CSS filter chain; a WebGL post-process
pass, which only works over things drawn into the canvas and therefore cannot touch
DOM text; and the hybrid where the canvas gets a shader pass and the DOM gets a CSS
overlay.

Report on: legibility and WCAG contrast under each treatment; paint cost of a
full-viewport blend-mode overlay on a scrolling page; behaviour on low-DPI vs retina;
how to expose an off switch; and whether any approach breaks text selection or
`::selection`.

Primary sources: MDN, WCAG, plus shipped examples worth citing.

## Answer

**CSS-only DOM overlay for the shell, a shader pass inside the canvas, and nothing in
between.** The hybrid is the only option that reaches both surfaces; the wrapper-filter
option is actively dangerous for a window manager, and a blend mode is the one thing to
refuse outright.

**Refuse `mix-blend-mode`.** Measured over a 4s scroll (240 frames, 1280x900, Chrome 151):
a full-viewport scanline overlay with `mix-blend-mode: multiply` raised display-compositor
work from 554ms to 3316ms — 2.3ms to 13.8ms per frame, ~6x — and produced output identical
to the unblended gradient to within 1/255 per channel. Multiply against pure black is
arithmetically a no-op per the compositing spec. Six times the per-frame cost for zero
pixels. The costs are also structurally different: `text-shadow` and SVG filters cost raster
(5.4 to 9.7 and 31.3ms, amortised per tile), while blending costs compositing (every frame,
whole viewport, forever). Caveat: GPU compositing was unavailable on the test machine
(SwiftShader), so absolute ms are a low-end proxy; the ratio is structural.

**Refuse a wrapper `filter`.** Per Filter Effects L1, a non-`none` filter "results in the
creation of a containing block for absolute and fixed positioned descendants". Put a CRT
filter on the desktop wrapper and every absolutely positioned window and the fixed taskbar
silently change coordinate system. It also creates a stacking context and costs subpixel
antialiasing on all text inside. `backdrop-filter` is no better — filters, opacity, masks,
clip-path and blend modes all create backdrop roots, so its behaviour would change depending
on which windows are open.

**Contrast holds, but only just, and only for a bright phosphor.** `#33ff66` on `#050805` is
14.99:1; under a 35%-black scanline the darkened rows drop to 6.40:1 (AA pass, AAA fail), and
at 50% to 4.06:1 (AA fail). A dim "authentic" green like `#1f9e3d` fails AA at even a 15%
scanline. Hard constraints for `06-visual-system`: scanline alpha ceiling 0.35, phosphor must
reach at least ~10.2:1 unattenuated, and no scanlines over long-form body copy.

**DPI.** Chrome snaps the gradient to whole device pixels — no antialiasing. At DPR 1 and 2
the pattern is exact; at 1.25 and 1.5 (the common Windows scaling values) dark bands alternate
between 1 and 2 device pixels, i.e. visible moire. Average duty cycle is preserved, so the
contrast arithmetic still holds. Either drive the period from `(resolution: Ndppx)` or accept
the beat as on-brand.

**Nothing breaks text selection.** Measured: `elementFromPoint` and `caretRangeFromPoint`
returned the paragraph and a text node under every treatment, because the overlay carries
`pointer-events: none` and filters do not affect hit testing. That last fact is also why
barrel distortion is out: `feDisplacementMap` moves pixels but not hit geometry, so the caret
lands where the undistorted glyph was. `::selection` gets tinted by the overlay and cannot opt
out (`background-image` is ignored there), but it should set `text-shadow: none`.

**Off switch.** `prefers-reduced-motion` is the wrong lever for a *static* overlay; the right
gates are `prefers-contrast: more`, `forced-colors: active` and (as a bonus, not Baseline)
`prefers-reduced-transparency`. Forced-colors mode disables the CSS approach for free, since
it computes `text-shadow` to `none` and non-`url()` `background-image` to `none` — an
advantage no other option has. And if any part of the treatment animates, WCAG SC 2.2.2 makes
a pause/stop/hide mechanism a conformance requirement, not a nicety. Implementation:
`data-crt` on `<html>`, set by an inline pre-paint script, plus a taskbar toggle.

Full research, with the measurement harness, per-variant tables, the contrast matrix, source
quotations and open questions:
`.scratch/retro-desktop-portfolio/research/02-crt-phosphor-treatment.md`
