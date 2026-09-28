// The one OG card template (ticket 18 § OG images, research 17 § Can Satori render the
// chrome): built as plain `{ type, props }` object literals, not JSX — Satori's own
// runtime takes a React-element-shaped tree without needing the JSX transform, and this
// file carries no `astro:content`/`astro:config` import (same discipline as `fs/tree.ts`
// and `lib/meta.ts`), so it stays directly unit-testable and Task 7.2's endpoint owns all
// the server-only lookups.
//
// Map Hazards / research 17 hazards this file is built around:
//   - No z-index, `calc`, 3D transforms, or `inset`/`outset` borders — paint order is
//     document order, so the scanline overlay is the tree's last child (hazard 11).
//   - No style value may be `undefined` (hazard 10) — optional pieces are omitted by
//     building the `children` array conditionally, never by spreading `undefined` keys.
//   - Whitespace collapses like CSS `white-space: normal` (hazard 11): none of this
//     card's text depends on run-length whitespace, so nothing sets `whiteSpace: 'pre'`.

/** A node in the plain object tree Satori's core API accepts (its own type is `ReactNode`
 * from `react`; this is the shape actually needed here, without pulling the JSX runtime
 * into a file that never uses JSX syntax). */
export interface SatoriElement {
  type: string;
  props: Record<string, unknown>;
}

export interface CardSpecField {
  key: string;
  value: string;
}

export interface CardData {
  /** Tilde-prefixed, slash-separated node path for the title bar, e.g.
   * `~/projects/orbital-mesh` (ticket 18 § OG images). */
  path: string;
  title: string;
  /** Up to three amber-key/green-value fields (project/drone). Mutually exclusive with
   * `summary` — a card shows one or the other, never both (ticket 18 § OG images). */
  fields?: CardSpecField[] | undefined;
  /** Shown instead of `fields` for pages, notes, and folders without spec fields. */
  summary?: string | undefined;
  /** Only the site default card (`/`) carries the drone wireframe (ticket 18: "no other
   * card includes this drone image"), as a `data:image/svg+xml;base64,...` URI. */
  droneSvgDataUri?: string | undefined;
}

/** The palette and treatment numbers the card paints with, parsed once from
 * `tokens.css` by the caller (`src/og/render.ts`) rather than re-typed here. */
export interface CardTokens {
  chrome: string;
  chromeHi: string;
  ink: string;
  bodyInk: string;
  accent: string;
  edge: string;
  bgSunk: string;
  /** Half the shell's `--scan-alpha` (ticket 18 § OG images: "at half the shell's
   * scanline strength"). */
  scanAlpha: number;
}

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function el(type: string, props: Record<string, unknown> = {}): SatoriElement {
  return { type, props };
}

/** The scanline overlay (research 17 § Can Satori render the chrome, measured): an
 * absolute layer with the shell's own `repeating-linear-gradient` formula
 * (`src/styles/crt.css`'s `.scan::after`), at half `--scan-alpha`, painted last so it
 * sits on top of everything else (hazard 11: paint order is document order). */
function scanlineOverlay(scanAlpha: number): SatoriElement {
  const halfAlpha = scanAlpha / 2;
  return el('div', {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: `repeating-linear-gradient(to bottom, transparent 0, rgba(0, 0, 0, ${halfAlpha}) 1px, transparent 2px, transparent 3px)`,
    },
  });
}

/** The amber title bar: the node's tilde path, slashed-zero numerals (ticket 13's rule,
 * matched here via `fontFeatureSettings` the way `chrome.css`'s `.titlebar` does it). */
function titleBar(path: string, tokens: CardTokens): SatoriElement {
  return el('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      height: 64,
      padding: '0 40px',
      background: tokens.chrome,
      borderBottom: `3px solid ${tokens.edge}`,
      color: tokens.accent,
      fontSize: 28,
      fontFeatureSettings: "'zero'",
    },
    children: path,
  });
}

/** The title, large in phosphor green, with a two-layer bloom faked as two stacked
 * `textShadow` values at different blur radii and opacities (research 17, measured:
 * `textShadow` works in Satori 0.33; ticket "Bloom" glossary: "drawn as a text-shadow"). */
function titleBlock(title: string, tokens: CardTokens): SatoriElement {
  return el('div', {
    style: {
      display: 'flex',
      color: tokens.ink,
      fontSize: 64,
      fontWeight: 700,
      lineHeight: 1.15,
      textShadow: `0 0 6px ${rgba(tokens.ink, 0.75)}, 0 0 20px ${rgba(tokens.ink, 0.4)}`,
    },
    children: title,
  });
}

/** Up to three amber-key/green-value spec fields (project: role/tech/period; drone:
 * class/frame/prop size — ticket 18 § OG images). */
function specFields(fields: CardSpecField[], tokens: CardTokens): SatoriElement {
  return el('div', {
    style: { display: 'flex', flexDirection: 'column', gap: 14 },
    children: fields.map((field) =>
      el('div', {
        style: { display: 'flex', gap: 16, fontSize: 26 },
        children: [
          el('span', {
            style: {
              display: 'flex',
              color: tokens.accent,
              textTransform: 'uppercase',
              letterSpacing: 2,
              minWidth: 160,
            },
            children: field.key,
          }),
          el('span', { style: { display: 'flex', color: tokens.ink }, children: field.value }),
        ],
      }),
    ),
  });
}

/** Pages, notes, and folders with no spec fields show the summary instead
 * (ticket 18 § OG images). */
function summaryBlock(summary: string, tokens: CardTokens): SatoriElement {
  return el('div', {
    style: {
      display: 'flex',
      color: tokens.bodyInk,
      fontSize: 28,
      lineHeight: 1.5,
      maxWidth: 720,
    },
    children: summary,
  });
}

/** Site default only (ticket 18: "no other card includes this drone image"). */
function droneImage(dataUri: string): SatoriElement {
  return el('img', {
    src: dataUri,
    width: 420,
    height: 315,
    style: { display: 'flex' },
  });
}

/** Builds the full 1200×630 Satori tree for one card (ticket 18 § OG images, research 17
 * § Can Satori render the chrome). One template for every URL: a bevelled frame (per-side
 * border colours fake the bevel — hazard 11: no `inset`/`outset` border styles), the
 * title bar, the title with its bloom, spec fields or a summary, the drone SVG on the
 * site default only, and the scanline overlay painted last. */
export function buildCard(data: CardData, tokens: CardTokens): SatoriElement {
  const bodyChildren: SatoriElement[] = [titleBlock(data.title, tokens)];
  if (data.fields && data.fields.length > 0) {
    bodyChildren.push(specFields(data.fields, tokens));
  } else if (data.summary) {
    bodyChildren.push(summaryBlock(data.summary, tokens));
  }

  const contentChildren: SatoriElement[] = [
    el('div', {
      style: { display: 'flex', flexDirection: 'column', flex: 1, gap: 28 },
      children: bodyChildren,
    }),
  ];
  if (data.droneSvgDataUri) contentChildren.push(droneImage(data.droneSvgDataUri));

  return el('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      position: 'relative',
      background: tokens.chrome,
      color: tokens.ink,
      fontFamily: 'Valdez Mono',
      // Per-side border colours fake the bevel `chrome.css`'s `.frame` draws with
      // `box-shadow: var(--bevel)` — Satori has no inset box-shadow (hazard 11), so the
      // light/dark split moves to the border itself: lit top-left, sunk bottom-right.
      borderTop: `6px solid ${tokens.chromeHi}`,
      borderLeft: `6px solid ${tokens.chromeHi}`,
      borderBottom: `6px solid ${tokens.bgSunk}`,
      borderRight: `6px solid ${tokens.bgSunk}`,
    },
    children: [
      titleBar(data.path, tokens),
      el('div', {
        style: { display: 'flex', flex: 1, padding: '36px 40px', gap: 40 },
        children: contentChildren,
      }),
      scanlineOverlay(tokens.scanAlpha),
    ],
  });
}
