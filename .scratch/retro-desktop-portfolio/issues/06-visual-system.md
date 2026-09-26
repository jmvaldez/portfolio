# Visual system

Type: prototype
Status: open
Blocked by: —

## Question

Produce one static, high-fidelity mock of the desktop and use it to lock the visual
system.

Decide: the exact palette (phosphor green ramp, Commodore blue for the grid, HUD accent,
and the neutrals that make long-form text readable); the typefaces — a mono for the
terminal and chrome, and whether long-form content stays mono or switches to something
readable; the window chrome (title bar, controls, borders, active vs inactive state);
the taskbar; how the FPS-HUD layer manifests concretely (crosshairs, numerals, toasts)
without becoming noise; and the CRT treatment's intensity as settled by the research in
`02`.

Resolve with the mock linked as an asset and the tokens written down in a form the build
can consume.

## Hard constraints from ticket 02

The CRT research is resolved and it constrains the palette before you pick it. These are
derived from the WCAG contrast formula, not opinions:

- **Scanline alpha ceiling is 0.35.** `#33ff66` on `#050805` is 14.99:1 unattenuated; the
  darkened rows fall to 6.40:1 at 35% black and to 4.06:1 at 50%, which fails AA.
- **The phosphor green must reach ~10.2:1 or better unattenuated** so it still passes AA
  under the overlay. A dim "authentic" green like `#1f9e3d` fails AA at even a 15%
  scanline — authenticity and legibility genuinely conflict here, and legibility wins.
- **No scanlines over long-form body copy.** Shell chrome only. This also makes the
  scanline layer per-surface rather than per-viewport, which cuts its cost.
- **Bloom is `text-shadow`, not a filter or a blend mode.** `text-shadow` costs raster,
  paid once per tile and amortised; blending costs compositing, every frame, forever.
- **Keep the treatment static.** If it animates, WCAG 2.2.2 makes a pause/stop/hide
  control a conformance requirement.
- **One off-switch, not per-effect sliders**, plus automatic gating on
  `prefers-contrast: more` and `forced-colors: active`.

Known and accepted: at DPR 1.25 and 1.5 — the two most common Windows scaling values —
Chrome snaps the gradient to whole device pixels with no antialiasing, so the scanline
bands beat between 1 and 2 device pixels and produce visible moiré. Driving the period
from a `(resolution: Ndppx)` query fixes it; ticket 02 leans toward accepting it for v1
and retrofitting, but this ticket owns the call.

## Prototype

Branch `prototype/visual-system`, at
`.scratch/retro-desktop-portfolio/prototypes/06-visual-system/index.html`.
Single self-contained HTML file; `python3 -m http.server 8732` from that directory.

Three visual systems over one settled layout, switchable via `?variant=` and a floating
bar. A static mock — nothing drags.

- **A, Phosphor purist.** One hue, mono everywhere including body copy, hairline chrome,
  dense. The HUD is a crosshair and nothing else.
- **B, HUD.** Phosphor chrome with sans-serif body copy at a comfortable measure; amber
  marks live state; corner brackets on the focused window and kill-feed toasts.
- **C, Instrument panel.** Dual phosphor — green is data, amber is chrome and numerals.
  Heavy bevelled frames, gauges in the taskbar, the strongest CRT.

The token panel computes WCAG contrast **live from the rendered colours**, including each
surface under its own scanline overlay, and checks both hard numbers from ticket 02 (the
0.35 alpha ceiling and the ~10.2:1 phosphor floor). `C` toggles the CRT off — the single
off-switch ticket 02 requires. "copy tokens" exports the variant as CSS custom properties.

Type is system mono and system sans; picking the webfont is downstream. What this locks
is whether long-form copy stays mono at all.

Still to decide when the variant is picked: the DPR 1.25/1.5 moiré call inherited from
ticket 02, and the `(resolution: Ndppx)` query if the answer is to fix it rather than
accept it.

