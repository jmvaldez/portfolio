// The single OG card template, built as plain `{ type, props }` objects rather than JSX
// (Satori accepts a React-element-shaped tree without the JSX transform). Imports nothing
// from `astro:content` or `astro:config`, so it can be unit-tested; the endpoint does the
// server-only lookups.
//
// Satori constraints this file works around:
//   - No z-index, `calc`, 3D transforms, or `inset`/`outset` borders. Paint order is
//     document order, so the scanline overlay is the tree's last child.
//   - No style value may be `undefined`, so optional pieces are omitted by building the
//     `children` array conditionally.
//   - Whitespace collapses like CSS `white-space: normal`, so no text relies on it.

/** A node in the plain object tree Satori accepts (a `ReactNode` in its own types). */
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
   * `~/projects/orbital-mesh`. */
  path: string;
  title: string;
  /** Up to three amber-key/green-value fields (project/drone). A card shows these or
   * `summary`, never both. */
  fields?: CardSpecField[] | undefined;
  /** Shown instead of `fields` for pages, notes, and folders without spec fields. */
  summary?: string | undefined;
  /** Site default card (`/`) only: the drone wireframe as a `data:image/svg+xml;base64,...`
   * URI. */
  droneSvgDataUri?: string | undefined;
}

/** The palette and treatment numbers the card paints with, parsed from `tokens.css` by
 * `src/og/render.ts`. */
export interface CardTokens {
  chrome: string;
  chromeHi: string;
  ink: string;
  bodyInk: string;
  accent: string;
  edge: string;
  bgSunk: string;
  /** Half the shell's `--scan-alpha`. */
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

/** The scanline overlay: an absolute layer using the shell's `.scan::after` gradient at
 * half `--scan-alpha`, painted last so it sits on top. */
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

/** The amber title bar showing the node's tilde path, with slashed-zero numerals. */
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

/** The large green title with a two-layer bloom faked as stacked `textShadow` values. */
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

/** Up to three amber-key/green-value spec fields. */
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

/** The summary shown for pages, notes, and folders with no spec fields. */
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

/** The drone wireframe image, on the site default card only. */
function droneImage(dataUri: string): SatoriElement {
  return el('img', {
    src: dataUri,
    width: 420,
    height: 315,
    style: { display: 'flex' },
  });
}

/** Builds the full 1200×630 Satori tree for one card: a bevelled frame, the title bar,
 * the title, spec fields or a summary, the drone SVG on the site default only, and the
 * scanline overlay painted last. */
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
      // Per-side border colours fake the frame's bevel, since Satori has no inset
      // box-shadow: lit top-left, sunk bottom-right.
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
