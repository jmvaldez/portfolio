# Visual system

Type: prototype
Status: resolved
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


## Answer

**Variant C, Instrument panel, CRT on.** Dual phosphor: green is data, amber is chrome
and numerals. Heavy bevelled frames, gauges in the taskbar, the strongest CRT in the set.

Long-form body copy **stays mono** — that was the axis with the longest tail, since it
governs every content page. C runs it at 15px / 1.75 / 58ch, which is loose and short
enough to read at length without leaving the typeface behind. No sans-serif anywhere.

### Tokens

```css
:root {
  --bg:           #0a0d09;
  --bg-sunk:      #050703;
  --chrome:       #17200f;
  --chrome-hi:    #26331a;
  --ink:          #7dff8f;   /* 15.42:1 on --bg */
  --ink-dim:      #47a352;   /*  6.17:1 on --bg,  5.30:1 on --chrome */
  --ink-faint:    #3c9047;   /*  4.91:1 on --bg,  4.62:1 on scan-darkened chrome */
  --accent:       #ffc24d;   /* 10.46:1 on --chrome, 11.46:1 under its scanline */
  --hud:          #ffc24d;   /* the FPS layer and the accent are the same amber */
  --edge:         #3f5a2c;
  --edge-hot:     #ffc24d;   /* focused window border */
  --body-bg:      #0a0d09;
  --body-ink:     #d6ffdb;   /* 17.86:1 on --body-bg */
  --grid:         #4a4ae0;   /* Commodore blue, 3D backdrop only */

  --font-chrome:  <mono webfont, see ticket 13>;
  --font-body:    <the same mono>;
  --body-size:    15px;
  --body-leading: 1.75;
  --body-measure: 58ch;

  --border-w:     3px;
  --title-h:      30px;
  --radius:       0px;
  --pad:          14px;
  --bevel:        inset 2px 2px 0 rgba(255,255,255,.08),
                  inset -2px -2px 0 rgba(0,0,0,.6);
  --scan-alpha:   0.32;
  --scan-period:  3px;
  --bloom:        0 0 9px rgba(125,255,143,.34);
}
```

Everything downstream reads tokens; nothing hard-codes a colour. That rule held across all
three prototype variants and is what made switching between them a one-attribute change.

### Two corrections made while locking it

**`--ink-faint` failed AA.** As drawn, C used `#2d6b35` — **3.04:1** on `--bg`. It is not
decorative: it carries the `.prose` byline, the folder-listing column headers, and the
taskbar gauge labels, all at 10-11px. Lifted to `#3c9047` (4.91:1), which still reads as
clearly subordinate to `--ink-dim`. Every check in the live panel now passes for C.

**The DPR moiré call: fix it, do not accept it.** Ticket 02 leaned toward accepting for
v1, but it leaned that way before the strongest CRT in the set won — C's 0.32 alpha on a
3px period is precisely the worst case. The fix is **soft-edged bands**, not a
`(resolution: Ndppx)` matrix:

```css
.scan::after {
  background: repeating-linear-gradient(
    to bottom,
    transparent 0,
    rgba(0,0,0,var(--scan-alpha)) calc(var(--scan-period) * 0.34),
    transparent calc(var(--scan-period) * 0.68),
    transparent var(--scan-period));
}
```

Hard colour stops snap to whole device pixels at DPR 1.25 and 1.5 and beat between 1 and 2
of them. A ramp has no edge to snap, so the artefact cannot form at any DPR, and the
period is never enumerated per bucket. The triangle's area over one period matches the old
1px band, so perceived darkness is unchanged. This removes the class of bug rather than
its instances, and it deletes the `(resolution: Ndppx)` query from the design entirely.

Verified at DPR 1: all contrast checks pass and the band still reads. **Not yet verified on
a real 1.25x or 1.5x display** — that check is outstanding and is recorded as a hazard.

### What this locks, and what it does not

Locked: palette, the mono-everywhere decision, chrome geometry (3px borders, 30px title
bars, square corners, bevel), focus signalling (amber border plus lit title bar, not corner
brackets — those were B's), the FPS layer's concrete form (crosshair and readout inside
`viewer.exe`, kill-feed toasts top-right, gauges in the taskbar), and CRT intensity with
its single off-switch.

Not locked: the actual webfont. The mock runs on system mono. Ticket 13 owns that pick.
