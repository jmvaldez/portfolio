// One OG image per URL-bearing node, plus the site default at `/og/index.png`
// (Task 7.2; ticket 18 § OG images; D22: OG paths follow the node's *URL*, not its path
// in the fake filesystem). Mirrors `src/pages/[...path].astro`'s directory/readme
// collision rule and `src/pages/fs/body/[...path].html.ts`'s style (relative imports,
// D8's `process.cwd()` read).

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { APIRoute, GetStaticPaths, InferGetStaticPropsType } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { getEntryForNode, getTree } from '../../fs/load';
import { renderDroneSvg } from '../../drone/svg';
import { descriptionFor } from '../../lib/meta';
import { SITE_DESCRIPTION, SITE_NAME } from '../../lib/site';
import { parseHexTokens } from '../../lib/tokens';
import type { FsNode, FsTree } from '../../fs/types';
import type { CardData, CardSpecField } from '../../og/card';
import { renderOgImage, REGULAR_TTF_PATH } from '../../og/render';

const DRONE_WIDTH = 420;
const DRONE_HEIGHT = 315;
const TOKENS_CSS_PATH = join(process.cwd(), 'src/styles/tokens.css');

type EntryData =
  | CollectionEntry<'projects'>['data']
  | CollectionEntry<'drones'>['data']
  | CollectionEntry<'pages'>['data'];

/** `~/projects/orbital-mesh`-style (ticket 18 § OG images): the node's own `path`
 * (never its URL — a directory's `path` already omits its readme's filename, which is
 * exactly the example ticket 18 gives), extension dropped, tilde in place of the
 * leading slash. */
function tildePath(rawPath: string): string {
  const withoutExtension = rawPath.replace(/\.[^./]+$/, '');
  return withoutExtension === '/' || withoutExtension === '' ? '~' : `~${withoutExtension}`;
}

/** D6, matching `src/fs/tree.ts` and `SpecBlock.astro`'s own formatting. */
function formatPeriod(period: { start: string; end?: string | undefined }): string {
  const start = period.start.slice(0, 4);
  if (period.end === undefined) return start;
  const end = period.end === 'present' ? 'PRESENT' : period.end.slice(0, 4);
  return `${start}–${end}`;
}

/** Project: role, first three tech entries, period. Drone: class, frame, prop size
 * (ticket 18 § OG images). `undefined` for anything else (notes, pages) — that card
 * shows the summary instead. */
function specFieldsFor(entryData: EntryData): CardSpecField[] | undefined {
  if (entryData.type === 'project') {
    return [
      { key: 'Role', value: entryData.role },
      { key: 'Tech', value: entryData.tech.slice(0, 3).join(', ') },
      { key: 'Period', value: formatPeriod(entryData.period) },
    ];
  }
  if (entryData.type === 'drone') {
    const fields: CardSpecField[] = [
      { key: 'Class', value: entryData.class.toUpperCase() },
      { key: 'Frame', value: entryData.frame },
    ];
    if (entryData.propSizeIn !== undefined) {
      fields.push({ key: 'Props', value: `${entryData.propSizeIn}"` });
    }
    return fields;
  }
  return undefined;
}

/** A directory never carries a body itself (glossary "Readme"): its card's spec fields
 * (or summary) come from its readme child, the same collapse `[...path].astro` performs. */
function bodyNodeFor(node: FsNode, tree: FsTree): FsNode | undefined {
  if (node.kind !== 'dir') return node;
  const readmePath = node.children?.find((childPath) => tree[childPath]?.name === 'readme.md');
  return readmePath ? tree[readmePath] : undefined;
}

async function cardDataForNode(node: FsNode, tree: FsTree): Promise<CardData> {
  const bodyNode = bodyNodeFor(node, tree);
  const entry = bodyNode ? await getEntryForNode(bodyNode.path) : undefined;
  const fields = entry ? specFieldsFor(entry.data) : undefined;

  return {
    path: tildePath(node.path),
    title: node.title,
    fields,
    summary: fields ? undefined : descriptionFor(node, tree),
  };
}

/** The drone SVG, coloured for a standalone data URI: Satori renders the `<img>` as its
 * own document, so the SVG's `currentColor` stroke (`src/drone/svg.ts`) has nothing to
 * inherit from — the shell's own `--ink` is baked in directly instead. */
function droneDataUri(ink: string): string {
  const svg = renderDroneSvg({ width: DRONE_WIDTH, height: DRONE_HEIGHT }).replaceAll(
    'currentColor',
    ink,
  );
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export const getStaticPaths = (async () => {
  const [tree, fontBytes, tokensCss] = await Promise.all([
    getTree(),
    // The endpoint's cache key must fold in the font bytes by hand (research 17 hazard
    // 4): they're read from disk, which Astro's incremental-build dependency graph can't
    // see.
    readFile(REGULAR_TTF_PATH),
    readFile(TOKENS_CSS_PATH, 'utf-8'),
  ]);
  const fontHash = createHash('sha256').update(fontBytes).digest('hex');
  const ink = parseHexTokens(tokensCss)['ink'] ?? '#7dff8f';

  function cacheKeyFor(data: CardData): string {
    return createHash('sha256').update(fontHash).update(JSON.stringify(data)).digest('hex');
  }

  // Ticket 12 § URLs: a directory wins a URL collision with its own readme.md.
  const byUrl = new Map<string, FsNode>();
  for (const node of Object.values(tree)) {
    if (!node.url || node.url === '/') continue;
    const existing = byUrl.get(node.url);
    if (!existing || node.kind === 'dir') byUrl.set(node.url, node);
  }

  const nodeEntries = await Promise.all(
    [...byUrl.values()].map(async (node) => {
      const data = await cardDataForNode(node, tree);
      return {
        params: { path: node.url!.replace(/^\/+|\/+$/g, '') },
        props: { data },
        cacheKey: cacheKeyFor(data),
      };
    }),
  );

  // D22: `/` has no node with a URL of its own — the site default, the only card
  // carrying the drone wireframe (ticket 18 § OG images).
  const indexData: CardData = {
    path: '~',
    title: SITE_NAME,
    summary: SITE_DESCRIPTION,
    droneSvgDataUri: droneDataUri(ink),
  };

  return [
    ...nodeEntries,
    { params: { path: 'index' }, props: { data: indexData }, cacheKey: cacheKeyFor(indexData) },
  ];
}) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;

export const GET: APIRoute<Props> = async ({ props }) => {
  const png = await renderOgImage(props.data);
  // `Response`'s `BodyInit` doesn't include Node's `Buffer`, only `Uint8Array`.
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
