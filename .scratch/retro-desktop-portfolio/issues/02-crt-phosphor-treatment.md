# CRT / phosphor treatment: how is it actually rendered?

Type: research
Status: open
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
