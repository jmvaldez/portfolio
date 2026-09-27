# Typeface selection

Type: grilling
Status: claimed
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
