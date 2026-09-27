# Typeface selection

Type: grilling
Status: resolved
Blocked by: —

## Question

The visual system is locked and it is mono everywhere — chrome, terminal, and long-form
body copy alike, at 15px / 1.75 / 58ch for the body. The mock ran on `ui-monospace`, so
the actual face is still open.

Decide: which mono, and how it ships.

- **The face.** It has to do two jobs that usually pull apart: a convincing terminal at
  11-13px with a strong `0`/`O` and `1`/`l`/`I` distinction and tabular numerals, and
  readable paragraphs at 15px over hundreds of words. Most "terminal" faces fail the
  second job and most readable monos fail the first. Candidates worth weighing include
  Berkeley Mono (paid), JetBrains Mono, IBM Plex Mono, Departure Mono and other pixel
  faces (which may only work for chrome), and the possibility of **two** monos — one for
  chrome, one for body — which the token set already allows via `--font-chrome` and
  `--font-body` but which the visual system deliberately collapsed into one.
- **Licensing**, and whether it survives the repo going public — the same inversion
  already noted for 3D assets, where a paid licence can forbid committing the file.
- **Delivery**: self-hosted subset woff2 versus a CDN; `font-display`; and what the
  fallback stack is, given that a metric mismatch shifts a 58ch measure visibly.
- **FOUT under the CRT treatment.** Bloom is a `text-shadow` on the text itself, so a
  font swap repaints the glow too. Whether that flash is acceptable or wants
  `size-adjust` metric overrides on the fallback.

Graduated from the visual system, which locked everything about type except the face.

## Constraint from ticket 12

The spec block on every content page sets **amber small-caps keys over tabular green
values**. The face needs real small caps (`font-variant-caps: all-small-caps`) or the
design needs a decided fallback (uppercase at reduced size with letter-spacing), and it
must carry tabular figures.

## Answer

The captain took every recommendation in both rounds. Evidence: [research note](../research/13-typeface.md).

### The face

**IBM Plex Mono**, one face for everything: chrome, terminal and body. `--font-chrome` and
`--font-body` stay collapsed into one, as the visual system set them. Plex has a true
italic, which prose emphasis needs on every page. It reads well over long paragraphs, has a
slightly typewriter feel that suits the Fallout voice, and has complete box-drawing and block
coverage for terminal art. It is also the lightest file set of the faces that have a real italic.

Rejected alternatives:
- **Berkeley Mono** and **Input**: their licences forbid public redistribution.
- **Noto Sans Mono**: it has the only real small caps among the viable faces, but no italic,
  so emphasis would be a faux oblique on every page. Small caps appear only in the
  spec-block keys.
- **JetBrains Mono**: about twice the bytes, and it reads as a coding font.
- **Departure Mono**: pixel-exact only at multiples of 11px, with no bold or italic. The
  two-face split was not reopened.

### Licence

OFL 1.1, with no cost. "Plex" is a Reserved Font Name, and a subset is a Modified Version,
so each subset file's internal family name is changed (one step in the subsetting script).
`OFL.txt` is committed next to the woff2. The files are safe in a public repo, so this
decision does not force repo visibility early.

### Styles and files

Regular 400, Bold 700 and Italic 400. There is no bold italic; the browser synthesizes it
for the rare `**_x_**`. Files are **hinted** woff2, pre-subset with pyftsubset, about
50 KB for all three. The subset covers U+0020-007E, U+00A0-00FF, U+2010-2027,
U+2030-203A, U+20AC, U+2122, U+2500-257F and U+2580-259F. It is run with
`--layout-features+=smcp,c2sc,zero,case,tnum`, because the defaults strip `zero`. Hinting
is kept because the terminal lives at 11-13px, which is the untested range on Windows.

### Delivery

Self-hosted, with no CDN. Fontsource and Google files are ruled out because they strip
box drawing and `zero`. Files are committed under `src/assets/fonts` and wired through
Astro's `fontProviders.local()`. **Only Regular is preloaded.** `font-display: swap`.

### Fallback stack

Astro's `optimizedFallbacks` is **off**. Its automatic fallback only knows Courier New,
and it is placed ahead of the rest. Hand-written size-adjusted `local()` faces follow in
this order, then `monospace`:

| fallback | size-adjust | ascent | descent | line-gap |
|---|---|---|---|---|
| Menlo | 99.66% | 102.85% | 27.59% | 0% |
| Consolas | 109.13% | 93.92% | 25.20% | 0% |
| DejaVu Sans Mono | 99.66% | 102.85% | 27.59% | 0% |

Consolas is the one that matters: unadjusted, it makes the 58ch column about 44 px narrower.
With these faces, a swap changes glyph shapes and the bloom repaints once, but the layout
does not move. On `/`, the boot screen covers the swap anyway.

### Zero

The **slashed zero** (`font-feature-settings: "zero"`) is applied to chrome and the terminal
only. Body copy keeps Plex's calmer dotted default. Either way, `0` and `O` are distinct.

### Small caps

Plex has no `smcp`. The spec-block keys use the **explicit fallback**: `text-transform:
uppercase`, about 0.8em, and +0.06em tracking, set directly. `font-variant-caps` is never
used, so the browser never synthesizes small caps. The keys sit in a key/value list, not on
the mono grid, so the narrower advance is harmless.

### Numerals

Tabular figures come from the monospaced design itself, so no `tnum` feature is needed.
