# CRT / phosphor treatment: how is it actually rendered?

Research for ticket `.scratch/retro-desktop-portfolio/issues/02-crt-phosphor-treatment.md`.
Date: 2026-09-25.

There was no existing convention for research notes in this repo (only
`.scratch/retro-desktop-portfolio/` with `map.md` and `issues/`), so notes go in
`.scratch/retro-desktop-portfolio/research/`, one file per research ticket, named to
match the ticket.

Every claim below is tagged **[measured]**, **[sourced]**, **[derived]** (arithmetic from a
cited spec) or **[inferred]**. Measurement conditions are in the appendix; read them before
quoting a number.

---

## 1. Recommendation

**Ship a CSS-only DOM overlay, keep bloom as `text-shadow` on the phosphor text only, and
do not use a blend mode.** Give the WebGL canvas its own shader pass inside the canvas
(the hybrid), because a shader physically cannot reach DOM text and a DOM filter cannot
reach canvas pixels convincingly. Skip barrel distortion entirely.

Concretely:

- **Scanlines**: one `position: fixed; inset: 0; pointer-events: none` element with a
  `repeating-linear-gradient`. No `mix-blend-mode`.
- **Bloom**: `text-shadow` on phosphor-coloured text. Not a filter on a wrapper.
- **Vignette / curvature look**: a second fixed `radial-gradient` layer, plus rounded corners
  and an inset shadow on the *chassis* frame, not a geometric distortion of content.
- **Canvas**: a `postprocessing`-style pass on the R3F scene only.
- **Off switch**: a `data-crt` attribute on `html`, defaulted off under
  `prefers-contrast: more`, `forced-colors: active` and `prefers-reduced-transparency: reduce`,
  with a persisted user toggle in the taskbar.

The three things that decided it:

1. A full-viewport `mix-blend-mode` overlay multiplied display-compositor work by **~6x**
   during scroll and, with a black scanline gradient, produced output **identical to within
   1/255 per channel** versus the same gradient with no blend mode. You pay six times the
   per-frame cost for nothing. [measured, appendix A and D]
2. A wrapper `filter` becomes a **containing block for fixed and absolutely positioned
   descendants**. A window manager whose windows and taskbar are absolutely or fixed
   positioned will have its coordinate system silently redefined by a CRT filter on an
   ancestor. [sourced]
3. Under a 35%-black scanline the phosphor-on-black contrast falls from **14.99:1 to 6.40:1**
   — still comfortably AA, but only because the base ratio is enormous. At 50% it drops to
   **4.06:1** and fails. The treatment is safe *only* at low scanline alpha with a bright
   phosphor. [derived from the WCAG formula]

---

## 2. The four options, and what each can physically touch

| | reaches DOM text | reaches canvas pixels | geometric distortion | selection / hit test |
| --- | --- | --- | --- | --- |
| CSS overlay (gradients + `text-shadow`) | yes | yes, it paints over the canvas | no | intact |
| SVG / CSS filter chain on a wrapper | yes | yes, if the canvas is inside the wrapper | yes, `feDisplacementMap` | intact, but visually desynced |
| WebGL post-process pass | **no** | yes | yes | n/a |
| Hybrid: shader on canvas + CSS on DOM | yes | yes | canvas only | intact |

The WebGL row is the hard constraint the ticket suspected, and a shipped project confirms it:
`hyper-postprocessing` attaches fragment shaders to the Hyper terminal, and it works
specifically because Hyper v2 moved xterm.js to a **canvas-based** renderer. The shader
operates on a canvas texture, never on text nodes.
See https://github.com/slammayjammay/hyper-postprocessing [sourced]

`cool-retro-term`, the reference implementation of this whole look, is a Qt/QML app whose
effect stack lives in `ShaderTerminal.qml` and `BurnInEffect.qml` and exposes exactly these
sliders: **Bloom, BurnIn, Static Noise, Jitter, Glow Line, Screen Curvature, Ambient Light,
Flickering, Horizontal Sync, RGB Shift, Frame Shininess** (read from
https://raw.githubusercontent.com/Swordfish90/cool-retro-term/master/app/qml/SettingsEffectsTab.qml). That is the full
vocabulary, and note that every item is an independent *intensity* control, not a global
on/off. [sourced]

Worth citing as the counter-example: **98.css**, the most widely used "faithful recreation of
an old UI" CSS library, ships Windows 98 chrome, states accessibility is a primary goal, and
contains no CRT, scanline or phosphor treatment at all (https://jdan.github.io/98.css/). The credible
retro-desktop libraries do the *chrome* and leave the *tube* alone. [sourced]

---

## 3. Paint cost of a full-viewport overlay on a scrolling page [measured]

I benchmarked a 12,000px-tall scrolling page of mono green-on-black text in 40 window-like
boxes, scrolled 10px per animation frame for 4 seconds (240 frames) at 1280x900, with Chrome
151 driven over CDP and the timeline traced. Two independent runs; figures are run 1 / run 2.
Full conditions and caveats in Appendix A.

| variant | total `RunTask` ms over 4s | `RasterTask` ms | frames over 20ms |
| --- | --- | --- | --- |
| baseline, no treatment | 546 / 575 | 5.5 / 5.4 | 0 / 240 |
| scanline gradient overlay, no blend | 834 / 773 | 5.7 / 5.7 | 0 / 240 |
| same overlay + `mix-blend-mode: multiply` | **3539 / 3297** | 5.7 / 5.5 | 0 / 240 |
| `text-shadow` bloom on all body text | 579 / 584 | 9.6 / **9.7** | 0 / 240 |
| SVG filter chain on the content wrapper | 615 / 569 | 28.8 / **31.3** | 0 / 240 |
| blend overlay + bloom | 3466 / 3293 | 10.9 / 11.7 | 0 / 240 |
| all three | 3597 / 3502 | 44.2 / **49.5** | 0 / 240 |

Thread attribution, from a separate run tracing `RunTask` per thread:

| thread | scanlines, no blend | scanlines + blend |
| --- | --- | --- |
| `VizCompositorThread` (display compositor) | 554 ms | **3316 ms** |
| renderer `Compositor` | 126 ms | 140 ms |
| `CrRendererMain` | 111 ms | 116 ms |

Per frame that is 2.3ms versus 13.8ms of display-compositor work. The blend cost is entirely
in the display compositor, not in layout, paint or raster — which is exactly what the
compositing model predicts: a blended element must be drawn into its own render pass and then
combined with a readback of its backdrop, every frame, over the whole viewport.

### The two costs are structurally different, and that is the real finding

- `text-shadow` and SVG filters cost **raster**: 5.4ms to 9.7ms and 31.3ms respectively.
  Raster happens once per tile as tiles are produced, so this cost is paid when new content
  scrolls in and is amortised. It is a memory-and-latency cost, not a per-frame one.
- `mix-blend-mode` costs **compositing**: it recurs on every single frame, for the whole
  viewport, forever, whether or not anything changed.

On a scrolling page, per-frame compositor work is the one you cannot amortise. That is the
argument against the blend overlay, independent of the absolute numbers.

### And the blend bought nothing

`mix-blend-mode: multiply` with a pure-black gradient is arithmetically a no-op. Per the
compositing spec, the blend step is `Cs' = (1 - ab) x Cs + ab x B(Cb, Cs)` and multiply is
`B(Cb, Cs) = Cb x Cs`; with `Cs = 0` the composite reduces to `Co = (1 - as) x Cb`, which is
plain source-over alpha. https://www.w3.org/TR/compositing-1/ [derived]

Confirmed empirically: screenshots of the blended and unblended overlays at device pixel
ratios 1, 1.25, 1.5 and 2 differ by at most **1/255 per channel** (rounding). [measured]

If you want a blend mode that actually changes pixels you need `screen`, `overlay`,
`color-dodge` or similar — and then you are knowingly buying the 6x. My view: a bloom that
`screen`s over the page is not worth 11.5ms per frame of compositor time. Use `text-shadow`.

---

## 4. Legibility and WCAG contrast

### 4.1 The arithmetic

WCAG 2.2 SC 1.4.3 requires 4.5:1 for normal text and 3:1 for large text; SC 1.4.6 (AAA) wants
7:1. Contrast ratio is `(L1 + 0.05) / (L2 + 0.05)` on relative luminance, and "computed values
are not rounded" — 4.499:1 fails.
https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html [sourced]

A black scanline at alpha `a` darkens **both** the glyph and its background. Because of the
`+ 0.05` flare term in the formula, uniform darkening still loses contrast. Computed ratios
against a `#050805` background, for the darkened rows:

| phosphor | no overlay | a=0.15 | a=0.25 | a=0.35 | a=0.50 | a=0.65 |
| --- | --- | --- | --- | --- | --- | --- |
| `#33ff66` | 14.99 | 10.74 | 8.39 | **6.40** | 4.06 | 2.45 |
| `#00ff41` | 14.74 | 10.57 | 8.25 | 6.29 | 4.00 | 2.41 |
| `#4af626` | 13.90 | 9.99 | 7.83 | 5.99 | 3.84 | 2.35 |
| `#2bd44a` | 10.18 | 7.42 | 5.89 | 4.59 | 3.06 | 1.99 |
| `#1f9e3d` | 5.77 | **4.36** | 3.57 | 2.91 | 2.11 | 1.55 |
| `#9bffb8` | 16.67 | 11.92 | 9.29 | 7.06 | 4.44 | 2.63 |

[derived, computed from the WCAG sRGB relative-luminance definition]

Rules that fall out of this, and that `06-visual-system` should treat as hard constraints:

- **Scanline alpha must stay at or below 0.35.** At 0.50 even the brightest phosphor fails AA.
- **The unattenuated ratio must be at least ~10.2:1** for the darkened rows to hold 4.5:1 at
  alpha 0.35. A dim, "authentic" phosphor like `#1f9e3d` fails AA at a 15% scanline.
- **AAA under a scanline is effectively out.** Holding 7:1 at alpha 0.35 needs an
  unattenuated ratio around 16.6:1, i.e. a near-white green.
- Measure the **darkened rows**, not the average. A 1px-on / 2px-off scanline over a 1px glyph
  stroke means some glyph rows land entirely inside the dark band. WCAG gives no procedure for
  patterned backgrounds, so the worst-case pixel is the only defensible reading. [inferred]

### 4.2 What the numbers do not capture

WCAG 2.x models contrast as a ratio of two flat colours. It has nothing to say about blur.
Bloom does not lower the *ratio* much — `text-shadow` on my test page raised mean luminance
of the text region 24.6% while lowering mean horizontal luminance gradient only 3.1%
(12.992 to 12.584), whereas the scanline overlay lowered it 11.5% (to 11.498). [measured,
crude proxy — see Appendix C]

But glyph recognition depends on high-spatial-frequency edge detail, and that is precisely
what a blur removes. So: a bloom that passes 1.4.3 comfortably can still be measurably harder
to read, and no automated contrast checker will flag it. Treat bloom as a *subjective*
legibility decision to be settled in the `06-visual-system` mock at 100% zoom on a real
display, not as something a linter can sign off. [inferred]

One concrete mitigation, which is also what real phosphor did: put the glow **outside** the
stroke, never inside. `text-shadow: 0 0 6px rgba(...)` with no offset and no inner blur keeps
the core glyph pixels at full colour and only lifts the halo. Keep the halo alpha under about
0.45 or the inter-letter gaps start to fill in. [inferred]

### 4.3 Subpixel antialiasing

Chrome renders text on composited non-root layers with **grayscale** rather than subpixel
(LCD) antialiasing unless the layer has a fully opaque background, an identity or
integer-translation transform, and full opacity; "any change in opacity will change the
antialiasing from subpixel to grayscale", and `border-radius` or a non-default
`background-clip` makes the layer count as non-opaque.
https://web.dev/articles/antialiasing-101 [sourced]

Anything that promotes the text into its own layer — a wrapper `filter`, an `opacity` under 1,
a `mix-blend-mode` ancestor — therefore costs you subpixel antialiasing on the text itself.
On a low-DPI display that is a visible softening of every glyph in the interface, on top of
whatever the CRT effect is doing. A *sibling* overlay that paints over the text does not have
this problem, because the text layer itself is untouched. This is another reason to prefer
the overlay over the wrapper-filter approach. [inferred from the sourced rule]

---

## 5. Low-DPI versus retina [measured]

I rendered the scanline overlay (1px dark at 35% black, 3px period) at four device pixel
ratios and read the per-device-row green value of a text-free strip. Background is 8, a
darkened row is 5:

| DPR | device-row profile (24 rows) |
| --- | --- |
| 1.0 | `5 8 8` repeating exactly |
| 1.25 | `5 8 8 8 / 5 8 8 / 5 5 8 8 / 5 8 8 8 / 5 8 8 8 / 5 8 8 5 5` |
| 1.5 | `5 8 8 8 / 5 5 8 8 8 / 5 8 8 8 / 5 5 8 8 8 / 5 8 8 8 / 5 5` |
| 2.0 | `5 5 8 8 8 8` repeating exactly |

Two things matter here.

**No intermediate values appear at any DPR.** Chrome snapped the gradient stops to whole
device pixels rather than antialiasing the edges. So at fractional DPR you do not get a soft,
slightly-blurred scanline; you get **irregular line weight** — dark bands that are sometimes
1 and sometimes 2 device pixels, with gaps of 2 or 3. That is textbook moire, and 1.25 and 1.5
are the two most common Windows display-scaling values. The average duty cycle is preserved
(so mean luminance and therefore the contrast arithmetic above still hold), but the pattern
visibly beats. [measured]

**At integer DPR the pattern is exact**, and at DPR 2 the scanline is 2 device pixels thick —
the same physical thickness as at DPR 1, against glyph strokes that are also 2 device pixels.
So the *relationship* between scanline and stroke is stable across 1x and 2x, which is the
right property to have. [measured]

Mitigations, in order of preference:

1. Define the scanline period in device pixels rather than CSS pixels:
   `@media (resolution: 1dppx) { --scanline-period: 3px }` and so on, or drive it from a
   `matchMedia('(resolution: 1dppx)')` listener. This keeps it integral at 1x and 2x and lets
   you choose a period that lands on integers at 1.5x (i.e. a 2px CSS period = 3 device px).
2. Accept the beat at fractional DPR. It is a CRT effect; a little irregularity is arguably
   on-brand. This is defensible and costs nothing.
3. Do **not** try to fix it with a blur or a semi-transparent second layer — that reintroduces
   the layer-promotion and antialiasing costs in 4.3.

A related point for the phone layout the map already commits to: at DPR 3 a 1px CSS scanline
is 3 device pixels, so the scanline becomes proportionally *coarser* relative to text that is
also 3x. The mobile linear layout should either scale the period with `dppx` or, simpler, drop
scanlines entirely and keep only the palette and chrome — which is roughly what the map
already says about dropping the metaphor. [inferred]

---

## 6. The off switch

### 6.1 `prefers-reduced-motion` is the wrong lever, and is not enough

Static scanlines do not move, so `prefers-reduced-motion: reduce` has no bearing on them.
It is the correct gate for *animated* CRT effects — a rolling glow line, flicker, a sweeping
refresh beam — and nothing else.
https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion [sourced]

The features that actually apply to a static phosphor overlay:

| media feature | status | what it should do here |
| --- | --- | --- |
| `prefers-contrast: more` | widely available since May 2022 | disable scanlines and bloom |
| `forced-colors: active` | shipped | see 6.2 — mostly automatic |
| `prefers-reduced-transparency: reduce` | **limited availability, not Baseline** | disable overlay; treat as a bonus |
| `prefers-reduced-motion: reduce` | Baseline | disable flicker, glow line, canvas shader animation |

`prefers-contrast` values are `no-preference | more | less | custom`, where `custom` aligns
with `forced-colors: active`.
https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast [sourced]

`prefers-reduced-transparency` is explicitly marked experimental and not Baseline, so it can
be an enhancement but must not be the only path.
https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-transparency [sourced]

### 6.2 Forced-colors mode turns the effect off for free

In forced colors mode the UA computes `box-shadow` and `text-shadow` to `none`, and
`background-image` to `none` "unless the original value contains a `url()` function"; it also
force-adjusts colors and may paint a text backplate.
https://www.w3.org/TR/css-color-adjust-1/ and
https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors [sourced]

A `repeating-linear-gradient` is a `background-image` without `url()`, and the bloom is a
`text-shadow`. So **the CSS-overlay approach disables itself correctly in Windows High
Contrast with no work on my part** — a genuine and underrated advantage over the other three
options. An SVG `filter: url(#crt)` is not on that list and will keep applying; a WebGL canvas
is not affected by forced colors at all. [derived from the sourced rules]

### 6.3 A flickering or scrolling treatment triggers a normative requirement

WCAG SC 2.2.2: "For any moving, blinking or scrolling information that (1) starts
automatically, (2) lasts more than five seconds, and (3) is presented in parallel with other
content, there is a mechanism for the user to pause, stop, or hide it unless [it] is
essential."
https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html [sourced]

A decorative CRT flicker or a looping glow line is by definition not essential, starts
automatically, lasts indefinitely, and runs in parallel with content. **If the treatment
animates, an off switch is not a nicety, it is a conformance requirement.** A static scanline
overlay does not trigger 2.2.2 — which is a further argument for keeping the treatment static.

### 6.4 Shape of the control

- Single source of truth: `data-crt="on|off"` on `<html>`.
- Set by a tiny **inline, render-blocking** script in the Astro layout head, before first
  paint, reading `localStorage` and falling back to the media queries above. This avoids a
  flash of the full effect for a user who has turned it off. Astro content pages stay
  near-zero JS; this is a handful of bytes inlined, not an island.
- Expose it in the taskbar as a real control, in-world ("DISPLAY: CRT / FLAT"), not buried.
  `cool-retro-term` ships per-effect intensity sliders rather than one switch; for a portfolio
  a single toggle plus the automatic gates is the right amount of control. [inferred]
- The toggle must be reachable without ever having seen the effect degrade legibility — so
  put it in the DOM order early and make it keyboard-focusable.

---

## 7. Text selection and `::selection`

### 7.1 Nothing breaks selection [measured]

I probed `document.elementFromPoint` and `document.caretRangeFromPoint` at a coordinate
inside a paragraph, under five configurations: baseline, scanline overlay, blended scanline
overlay, SVG filter on the content wrapper, and all three together. In every case
`elementFromPoint` returned the `P` element and `caretRangeFromPoint` returned a text node.
A programmatic `Range` over the paragraph returned the full 453 characters in every case.

The two mechanisms:

- The overlay carries `pointer-events: none`, so it is not hit-tested.
- Filters do not affect hit testing at all: "As per SVG, the application of filter has no
  effect on hit-testing." https://www.w3.org/TR/filter-effects-1/ [sourced]

### 7.2 But a distorting filter desyncs selection from what you see

That same spec sentence is a trap for barrel distortion. If you warp the content with
`feDisplacementMap`, the pixels move but the hit-test geometry does not. The caret lands where
the *undistorted* glyph is, which at the edges of a curved screen can be several pixels from
where the user sees it, and a drag-selection will visibly select the wrong span. This is
unfixable in CSS — it is the reason no shipped web CRT effect does real barrel distortion
over live text. **Do not ship geometric distortion over DOM text.** [derived from the sourced
rule]

### 7.3 `::selection` gets tinted and you cannot opt out

Only `color`, `background-color`, `text-decoration` and friends, `text-shadow`,
`-webkit-text-stroke-color`, `-webkit-text-fill-color` and `-webkit-text-stroke-width` apply
to `::selection`; "in particular, `background-image` is ignored."
https://developer.mozilla.org/en-US/docs/Web/CSS/::selection [sourced]

Consequences:

- The selection highlight is painted as part of the element's content, so a full-viewport
  overlay paints over it too. Selected text will carry the same scanlines as everything else.
  Cosmetic, not broken, and arguably correct. [inferred]
- You cannot give `::selection` its own gradient or exempt it from the overlay, because
  `background-image` does not apply there.
- You **can** and should override `text-shadow` inside `::selection` to `none`. That kills the
  bloom on selected text, which is the one place where the halo genuinely hurts — an inverted
  block-selection with a glow around every glyph is mush. This is a one-line win.
- Under forced colors, `::selection` is where the UA's text backplate concept comes from
  (css-color-adjust-1 describes the backplate as "similar to the way backgrounds are painted
  on the `::selection` pseudo-element"), so the selection story is already handled there.
  [sourced]

---

## 8. The filter trap that matters most for a window manager

> "A value other than none for the filter property results in the creation of a containing
> block for absolute and fixed positioned descendants unless the element it applies to is a
> document root element in the current browsing context."
> https://www.w3.org/TR/filter-effects-1/ [sourced]

The same section also says a non-`none` filter "results in the creation of a stacking context
the same way that CSS opacity does".

This is the single strongest argument against the wrapper-filter approach for *this* project,
which is planning a window manager. Windows, the taskbar and any modals will be absolutely or
fixed positioned. Put `filter: url(#crt)` on a desktop wrapper and:

- `position: fixed` taskbar starts scrolling with the wrapper;
- every `position: absolute` window is now positioned against the wrapper, not the viewport;
- z-index interactions with the rest of the page change, because a new stacking context
  appears;
- and per 4.3, all text inside loses subpixel antialiasing.

Applying the filter to the root `<html>` element is the documented exception and avoids the
containing-block change, but not the stacking-context or antialiasing consequences, and
filtering the entire document is the most expensive possible scope. [inferred]

The overlay approach has none of these problems, because the overlay is a *sibling* that
paints on top; the content tree keeps its ordinary containing blocks and layer properties.

Related: `backdrop-filter` is not an escape hatch. Elements with `filter`, `opacity < 1`,
`mask`, `clip-path`, `backdrop-filter`, `mix-blend-mode` other than `none`, or `will-change`
naming any of those, become **backdrop roots**, and a `backdrop-filter` only reaches pixels
between the element and its nearest backdrop-root ancestor.
https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter [sourced]

In a window manager where windows have shadows, rounded corners and possibly translucency,
you will trip over backdrop roots constantly. A `backdrop-filter`-based CRT overlay would
behave differently depending on which windows happen to be open. Avoid.

---

## 9. What to hand to `06-visual-system`

Hard constraints, derived above:

1. Scanline alpha ceiling **0.35**; target 0.15 to 0.25.
2. Phosphor colour must reach at least **10.2:1** against the terminal background
   *before* the overlay. `#33ff66` at 14.99:1 has plenty of room; anything dimmer than
   roughly `#2bd44a` does not.
3. Long-form content pages get **no scanlines over body copy** regardless — the map already
   says legibility never loses to the toy, and section 4.2 says no checker will catch a
   legibility regression caused by blur. Scanlines belong on the *shell*: desktop background,
   window chrome, terminal, HUD. This also makes the scanline layer per-surface rather than
   per-viewport, which further cuts its cost.
4. No `mix-blend-mode`. No wrapper `filter`. No `backdrop-filter`. No barrel distortion.
5. Bloom is `text-shadow`, halo alpha under ~0.45, zero offset, and `text-shadow: none`
   inside `::selection`.
6. Any animated element of the treatment (flicker, glow line, refresh beam) is gated on
   `prefers-reduced-motion` **and** covered by the user toggle, per SC 2.2.2.
7. The canvas keeps its own shader pass; the DOM overlay must not try to fake what the shader
   already does to the canvas, or the two will disagree at the canvas edge.

Open design question for the mock: whether the scanline should sit above or below the window
chrome. Above reads as "the whole thing is on one tube", which is more coherent; below makes
active windows pop. Cannot be decided without pixels.

---

## 10. Open questions

- **Real-GPU numbers.** All timings were taken with `gpu_compositing: disabled_software`
  (SwiftShader). The 6x blend multiplier is structural and will persist, but the absolute
  milliseconds will be much smaller on a GPU-composited desktop and larger on a low-end
  phone. Resolving this needs one trace on real hardware; the harness in Appendix B does it
  in about two minutes.
- **Whether the blend multiplier scales with viewport area or with layer count.** I tested one
  viewport size. If it scales with area, a 4K display is roughly 6x the pixels of my test and
  the conclusion hardens considerably. One more run at 3840x2160 would settle it.
- **An unexplained rendering result.** An SVG filter chain of
  `feGaussianBlur -> feComponentTransfer -> feMerge(blurred, SourceGraphic)` rendered
  **pixel-identical** to no filter, while still costing 5.8x the raster time. Swapping
  `feMerge` for `feBlend mode="screen"` made it render. CSS `blur(2px)` and a bare SVG
  `feGaussianBlur` both rendered correctly in the same environment, so it is not a general
  SVG-filter failure. I could not determine the cause and it does not affect any
  recommendation, but anyone who does end up using an SVG chain should verify it actually
  changes pixels before trusting a profile of it.
- **Whether `text-shadow` bloom measurably slows first paint on content pages.** My raster
  numbers are for a scrolling shell. A content page's cost profile is different and the map
  has an open performance-budget ticket that should absorb this.
- **Firefox and Safari.** Everything measured here is Chrome 151. The specs cited are
  cross-browser normative, but the antialiasing behaviour in 4.3 is a Chrome implementation
  detail and the device-pixel snapping in section 5 may differ.

---

## Appendix A. Measurement conditions

- Google Chrome 151.0.7922.71, `--headless=new`, driven over the Chrome DevTools Protocol
  from Node 24 using the built-in `WebSocket` global. No dependencies installed.
- **GPU compositing was unavailable.** `SystemInfo.getInfo` reported
  `gpu_compositing: disabled_software`, `rasterization: disabled_software`, and the device as
  `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver-5.0.0)`.
  Treat the absolute milliseconds as a no-GPU / low-end-device proxy, and the ratios between
  variants as the transferable result.
- Viewport 1280x900 at DPR 1 for the timing runs; 600x400 at DPR 1, 1.25, 1.5 and 2 for the
  screenshot runs.
- Test page: 40 bordered "window" boxes, each a title bar plus a heading and two paragraphs
  of mono lorem, `#33ff66` on `#050805`, total height roughly 12,000px.
- Scroll: `window.scrollBy(0, 10)` inside a `requestAnimationFrame` loop for 4000ms,
  240 frames. Frame intervals recorded in-page.
- Tracing categories: `disabled-by-default-devtools.timeline`, `devtools.timeline`,
  `disabled-by-default-devtools.timeline.frame`, `blink`, `cc`, `gpu`. Durations are the sum
  of complete (`ph: "X"`) events by name over the whole trace, across all threads unless a
  per-thread breakdown is given.
- All seven variants held 60fps: mean frame interval 16.666ms, p95 16.7 to 16.8ms, and
  **0 of 240 frames over 20ms** in every case. The blend overlay consumed most of the
  compositor's headroom (13.8ms of a 16.7ms budget) without actually dropping a frame on this
  machine. That is the honest framing: not a regression you would see as jank here, but no
  margin left for anything else.

## Appendix B. Harness

Scripts live in the session scratchpad, not in the repo (throwaway):
`page.html` (test page), `drive.js` (trace and aggregate), `thread.js` (per-thread `RunTask`),
`shot.js` (multi-DPR screenshots), `hit2.js` (hit-test and selection probe),
`contrast.js` (WCAG ratio table), `prof.py` / `sharp.py` / `diff*.py` (pixel analysis, PIL).
Reproducing means: launch Chrome with `--remote-debugging-port`, then `node drive.js`.

## Appendix C. The sharpness proxy in 4.2

Mean absolute horizontal luminance gradient over a 500x300px crop of the text region, DPR 1,
grayscale. Higher is sharper. Baseline 12.992, `text-shadow` bloom 12.584, scanline overlay
11.498. Mean luminance of the same crop: 28.85, 35.94, 25.49.

This is a crude proxy, not a perceptual metric: it conflates "blurrier glyphs" with "less
contrast against background", and the crop includes non-text pixels. It supports the
directional claim (bloom softens edges slightly while raising overall brightness; scanlines
soften more while darkening) and nothing stronger. The SVG-filter figure from this run is
excluded because that chain turned out to be a no-op (section 10).

## Appendix D. Blend no-op verification

Screenshots of `repeating-linear-gradient` scanlines with and without
`mix-blend-mode: multiply`, at DPR 1, 1.25, 1.5 and 2. Per-channel difference extrema were
`(0,1)` for R, G and B at every DPR, i.e. rounding only.

## Sources

Primary specs and reference docs, all read directly:

- WCAG 2.2, Understanding SC 1.4.3 Contrast (Minimum) —
  https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- WCAG 2.2, Understanding SC 2.2.2 Pause, Stop, Hide —
  https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
- Filter Effects Module Level 1 — https://www.w3.org/TR/filter-effects-1/
- Compositing and Blending Level 1 — https://www.w3.org/TR/compositing-1/
- CSS Color Adjustment Module Level 1 — https://www.w3.org/TR/css-color-adjust-1/
- MDN, `mix-blend-mode` — https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode
- MDN, `::selection` — https://developer.mozilla.org/en-US/docs/Web/CSS/::selection
- MDN, `backdrop-filter` — https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter
- MDN, `filter` — https://developer.mozilla.org/en-US/docs/Web/CSS/filter
- MDN, `prefers-reduced-motion` —
  https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- MDN, `prefers-contrast` —
  https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast
- MDN, `prefers-reduced-transparency` —
  https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-transparency
- MDN, `forced-colors` —
  https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors
- web.dev, "Antialiasing 101" (Chrome DevRel) — https://web.dev/articles/antialiasing-101

Shipped examples:



- `cool-retro-term` effect list, read from

  https://raw.githubusercontent.com/Swordfish90/cool-retro-term/master/app/qml/SettingsEffectsTab.qml

- `hyper-postprocessing` — https://github.com/slammayjammay/hyper-postprocessing

- 98.css — https://jdan.github.io/98.css/
