# Research: a mono webfont for chrome, terminal and body

Informs ticket `.scratch/retro-desktop-portfolio/issues/13-typeface.md`.
Date: 2026-09-27.

Font files came from upstream GitHub releases, npm `@ibm/plex-mono@2.5.0`, and
google/fonts `ofl/notosansmono` and `ofl/fragmentmono`. They were inspected with
fontTools 4.65 (GSUB feature lists, `smcp` coverage of a–z, hmtx/hhea/OS2) and subset
with pyftsubset. Astro facts were read from the `astro@7.3.5` tarball and withastro/docs
`main`. Berkeley Mono facts come from its EULA PDFs and datasheet only; the file itself
was not inspected.

## Answer

Of the four named candidates, only Departure Mono has real small caps, and it is
pixel-gridded to multiples of 11px with one weight and no italic, so it cannot carry 15px
body copy. JetBrains Mono, IBM Plex Mono and (per its datasheet) Berkeley Mono have no
`smcp`/`c2sc`. Berkeley Mono also fails the public-repo test on licence alone.

Of 25+ further monos, only **Noto Sans Mono** and **Fragment Mono** are OFL with real
small caps. Noto Sans Mono is the only face that meets every hard constraint by itself,
but it has no italic. Fragment Mono has no bold and no box-drawing glyphs.

Astro 7's Fonts API is stable, self-hosts and can preload, but it does **not** subset
local files, and its automatic metric-matched fallback only knows Courier New for
`monospace`.

## Comparison

Subset = pyftsubset → woff2 for U+0020-007E, U+00A0-00FF, U+2010-2027, U+2030-203A,
U+20AC, U+2122, U+2500-257F, U+2580-259F, with default features plus
`smcp,c2sc,zero,case,tnum`. Shown as hinted / unhinted, R+B+I total, KB.

| Face (version) | Public repo OK? | `smcp`+`c2sc` | Zero: default → alternates | Weights · italic · VF | Box / block glyphs | Subset R+B+I (KB) | adv/em · 58ch @15px | Fontsource | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Berkeley Mono (TX-02 v2.004) | **No** (EULA §5) | none listed (file not inspected) | marked; ss01 dotted, ss02 slashed, ss03 split, ss04 plain | 12 weights · **oblique only** · VF is a $75 add-on | yes (datasheet) | not measurable (subsetting is a Derivative Work, §1.12) | unknown | no | **Drop** |
| JetBrains Mono 2.304 | Yes, OFL, no RFN | **no** | dotted → `zero` slashed | 100–800 · true italic · VF wght | complete | 95.4 / 62.2 | 0.600 · 522.0 px | yes | body OK, no small caps |
| IBM Plex Mono 2.5.0 | Yes, OFL, **RFN "Plex"** | **no** | dotted → `zero`/ss03 slashed, ss04 plain | 100–700 + Text · true italic · no VF | complete | 50.4 / 31.6 | 0.600 · 522.0 px | yes | body OK, no small caps |
| Departure Mono 1.500 | Yes, OFL, no RFN | **yes** (26/26, advance kept at 350) | pixel slashed only | 1 weight · none · none | complete | 6.6 (R only) | 0.636 · 553.6 px | **no** | chrome/terminal only |
| Noto Sans Mono 2.014 | Yes, OFL, no RFN | **yes** (26/26) | slashed; `zero` → slashed variant | VF wght 100–900, wdth 62.5–100 · **no italic** | complete | 26.8 R+B (unhinted) | 0.600 · 522.0 px | yes, but its files drop `smcp` | only single face passing all hard constraints |
| Fragment Mono 1.011 | Yes, OFL, no RFN | **yes** | slashed; `zero` → plain | Regular + italic · **no bold** | **missing all** | 52.1 / 30.9 (R+I) | 0.618 · 537.7 px | yes | weak |
| Commit Mono 1.143 | Yes, OFL | no | slashed; cv07 dotted | 400/700 · near-oblique italic | 1 box glyph missing | 50.1 / 50.1 (CFF) | 0.600 · 522.0 px | yes (v1.132) | no small caps |
| Iosevka Fixed 34.9.0 | Yes, OFL | no | slashed; `zero` + cv10 | 9 weights · true italic · no VF | complete | 60.2 / 37.5 | **0.500 · 435.0 px** | yes (v22, stale) | narrow; no small caps |
| Monaspace Neon 1.400 | Yes, OFL, **RFN "Monaspace"** | no | dotted; cv01 variants | VF wght 200–800, wdth, slnt · oblique-style italic | complete | 83.8 / 55.4 | 0.620 · 539.4 px | yes (v1.101) | no small caps |
| Geist Mono 1.7.2 | Yes, OFL | no | slashed; ss09 plain | 100–900 · true italic · VF | 1 Latin-1 glyph missing | 53.7 / 30.8 | 0.600 · 522.0 px | yes | no small caps |
| Intel One Mono 1.4.0 | Yes, OFL, **RFN "Intel"** | no | slashed only | 300–700 · true italic | 4 Latin-1 missing | 49.5 / 32.2 | 0.614 · 534.2 px | yes | no small caps |
| Source Code Pro 2.042 | Yes, OFL, **RFN "Source"** | no | dotted → `zero`/cv12 slashed | 200–900 · true italic · VF | complete | 57.6 / 35.2 | 0.600 · 522.0 px | yes | no small caps |
| Fira Code 6.2 | Yes, OFL | no | slashed; `zero` dotted | 300–700 VF · **no italic** | complete | 66.0 / 43.5 (R+B) | 0.615 · 535.4 px | yes | drop |
| Martian Mono 1.1.0 | Yes, OFL | no | slashed only | 100–800 VF · **no italic** | **113 box + 32 block missing** | 44.7 / 26.7 (R+B) | **0.700 · 609.0 px** | yes | drop |
| Recursive Mono Linear 1.085 | Yes, OFL | no | slashed | VF 300–1000 · oblique italic | **all missing** | 122.3 / 75.9 | 0.600 · 522.0 px | yes | drop |
| Input | **No**: web use needs a paid licence; "NO REDISTRIBUTION" | — | — | — | — | — | — | no | **Drop** |

Fallbacks: Menlo and DejaVu Sans Mono are 1233/2048 = 0.602 → 523.8 px; Consolas is
1126/2048 = 0.550 → **478.3 px**; Courier New is 1229/2048 = 0.600 → 522.1 px. The Menlo
and Consolas advances come from secondary sources and are unverified on real machines.

## Fallback overrides

Computed from `hhea`, matching Astro's method: `size-adjust` = primary advance ratio ÷
fallback advance ratio; each vertical override = primary metric ÷ upm ÷ size-adjust. Only
the fallback's advance enters the maths. Values: size-adjust / ascent / descent /
line-gap, in %.

| Primary | vs Menlo | vs Consolas | vs DejaVu Sans Mono | vs Courier New |
|---|---|---|---|---|
| IBM Plex Mono | 99.66 / 102.85 / 27.59 / 0 | 109.13 / 93.92 / 25.20 / 0 | 99.66 / 102.85 / 27.59 / 0 | 99.98 / 102.52 / 27.50 / 0 |
| JetBrains Mono | 99.66 / 102.35 / 30.10 / 0 | 109.13 / 93.47 / 27.49 / 0 | same as Menlo | 99.98 / 102.02 / 30.00 / 0 |
| Noto Sans Mono | 99.66 / 107.27 / 29.40 / 0 | 109.13 / 97.96 / 26.85 / 0 | same as Menlo | 99.98 / 106.92 / 29.30 / 0 |
| Departure Mono | 105.70 / 94.61 / 25.80 / 0 | 115.74 / 86.40 / 23.56 / 0 | same as Menlo | 106.04 / 94.30 / 25.72 / 0 |
| Fragment Mono | 102.65 / 92.55 / 24.35 / 0 | 112.40 / 84.52 / 22.24 / 0 | same as Menlo | 102.98 / 92.25 / 24.28 / 0 |
| Geist Mono | 99.66 / 100.84 / 29.60 / 0 | 109.13 / 92.09 / 27.03 / 0 | same as Menlo | 99.98 / 100.52 / 29.50 / 0 |
| Source Code Pro | 99.66 / 98.74 / 27.39 / 0 | 109.13 / 90.17 / 25.02 / 0 | same as Menlo | 99.98 / 98.42 / 27.30 / 0 |
| Iosevka Fixed | 83.05 / 116.20 / 25.89 / 8.43 | 90.94 / 106.11 / 23.64 / 7.70 | same as Menlo | 83.32 / 115.82 / 25.80 / 8.40 |
| Monaspace Neon | 102.98 / 91.76 / 19.42 / 9.71 | 112.77 / 83.80 / 17.74 / 8.87 | same as Menlo | 103.32 / 91.47 / 19.36 / 9.68 |

Raw metrics (upm; advance; x-height; cap height; hhea asc / desc / gap):

| Face | upm | advance | x-height | cap height | hhea |
|---|---|---|---|---|---|
| IBM Plex Mono | 1000 | 600 | 516 | 698 | 1025 / -275 / 0 (typo 780/-220/300, USE_TYPO off) |
| JetBrains Mono | 1000 | 600 | 550 | 730 | 1020 / -300 / 0 |
| Noto Sans Mono | 1000 | 600 | 536 | 714 | 1069 / -293 / 0 |
| Departure Mono | 550 | 350 | 300 | 400 | 550 / -150 / 0 |
| Fragment Mono | 1000 | 618 | 524 | 699 | 950 / -250 / 0 |
| Iosevka Fixed | 1000 | 500 | 520 | 735 | 965 / -215 / 70 (typo 965/-285/0, USE_TYPO on) |
| DejaVu Sans Mono | 2048 | 1233 | — | — | 1901 / -483 / 0 |

## Astro 7 Fonts API

- **Stable** since 6.0: top-level `fonts: FontFamily[]` (`dist/core/config/schemas/base.js:272`;
  docs `configuration-reference.mdx:2782-2790`, `upgrade-to/v6.mdx:1163-1166`).
- **Providers**: adobe, bunny, fontshare, fontsource, google, googleicons, npm, local.
- **Self-hosts** to `_astro/fonts` with hashed names. **Preload** is opt-in via
  `<Font cssVariable preload />`, filterable by weight, style or subset.
  `font-display` defaults to `swap` (`utils.js:5`). Output is an inline `<style>` plus
  optional `<link rel=preload>` (`components/Font.astro:25-29`), which matters if a CSP
  is ever adopted.
- **Local files are copied byte for byte** (`vite-plugin-fonts.js:315-326`); `weights`,
  `subsets` and `styles` are ignored by the local provider (`providers/local.js:35-37`).
  Pre-subset and commit the result.
- **Metric fallbacks know only Courier New for `monospace`**
  (`infra/system-fallbacks-provider.js:32-38`), and the generated face is *prepended*
  ahead of any listed fallbacks (`core/optimize-fallbacks.js:27,52`). The escape hatch is
  `optimizedFallbacks: false` plus hand-written `@font-face` fallbacks.
- Font files must exist on disk at build time; don't put them in `public/`.

## Hazards

1. **No real small caps in JetBrains, Plex or Berkeley.** CSS Fonts 4 says the browser
   should simulate them by scaling uppercase glyphs. Inferred, not browser-tested: scaled
   caps scale the advance too and break the mono column. Real `.sc` glyphs keep the full
   advance (Departure's are all 350).
2. **pyftsubset strips small caps and `zero` by default.** Pass
   `--layout-features+=smcp,c2sc,zero,case,tnum` (or `*`).
3. **Fontsource and Google-served files strip them too.** Their latin woff2 for Noto Sans
   Mono, Fragment Mono and JetBrains Mono has no `smcp`, `c2sc`, `zero`, or box drawing.
4. **Astro's automatic fallback is Courier New only and jumps the queue**, so Menlo and
   Consolas are never reached; on Linux the `local()` lookup likely misses entirely.
5. **Astro does not subset local files.**
6. **Berkeley Mono licence traps**: §5 forbids public sharing except as a served
   webfont; §1.12 makes re-encoding a Derivative Work, contradicting the datasheet's
   "Subsetting: Allowed"; commercial §1.08 prohibits web apps that let users write text
   in terminals. Its italic is an oblique.
7. **OFL Reserved Font Names** (Plex, Intel, Monaspace, Source). A subset is a Modified
   Version (OFL FAQ 2.6), so the name inside the file must change. With any OFL face,
   commit `OFL.txt` beside the woff2 (condition 2).
8. **Departure Mono is pixel-exact only at multiples of 11px.**
9. **`ch` follows whichever font is rendering.** During the swap, 58ch is sized from the
   fallback's `0`; Consolas makes the column ~44 px narrower unless `size-adjust` is set.
   With `line-height: 1.75` fixed, the line box doesn't change on swap.
10. **Box-drawing gaps** in Martian, Recursive, Fragment (and one glyph in Commit) push
    terminal art onto system glyphs with different advances.
11. **Noto Sans Mono has no italic**; emphasis would be faux-oblique.
12. **Unhinted subsets save 35–40%**, but rendering at 11–13px on Windows is untested.

## Open questions

- Berkeley Mono's file-level facts (advance, `smcp`) need an account and a trial download.
- Verify the Menlo and Consolas advances with fontTools on a Mac and a Windows machine.
- In Chrome, Safari and Firefox: the advance of synthesized small caps in a mono; `ch`
  during the swap period; whether Chrome on Linux resolves `local("Courier New")` to
  Liberation Mono.
- Hinted vs unhinted rendering at 11–13px on Windows at DPR 1, 1.25, 1.5.
