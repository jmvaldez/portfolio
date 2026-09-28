// Per-page meta (ticket 18 § Meta, D22). Pure — no `astro:content`/`astro:config`
// import, so it's directly unit-testable (map Hazards: `getCollection()` is a hard
// build error outside the server, and the same discipline applies to `Astro.site`,
// which is why the site origin is an explicit parameter here rather than read live).

import type { FsNode, FsTree } from '~/fs/types';
import { SITE_DESCRIPTION, SITE_NAME } from './site';

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  ogImageAlt: string;
}

/** `/` is the fixed exception to "`<entry title> · Joe Valdez`" (ticket 18 § Meta). */
const ROOT_TITLE = `${SITE_NAME} · Software Engineer`;

function parentPathOf(path: string): string | undefined {
  if (path === '/') return undefined;
  const idx = path.lastIndexOf('/');
  return idx <= 0 ? '/' : path.slice(0, idx);
}

/** A node's own summary if it has one; a directory with no summary of its own borrows
 * its readme child's (ticket 18: "the entry's summary" — a directory's entry, when it
 * has one, is its readme). */
function ownSummary(node: FsNode, tree: FsTree): string | undefined {
  if (node.summary) return node.summary;
  if (node.kind === 'dir') {
    const readmePath = node.children?.find((childPath) => tree[childPath]?.name === 'readme.md');
    return readmePath ? tree[readmePath]?.summary : undefined;
  }
  return undefined;
}

/** The description fallback chain (ticket 18 § Meta): the node's own summary, else the
 * parent directory's, else the site-wide default. Never throws on a node with neither —
 * a folder page with no readme is exactly the "else" case. Exported so Task 7.2's OG
 * card can reuse the exact same fallback for its summary text instead of re-deriving it —
 * the card and `og:description` should never say different things. */
export function descriptionFor(node: FsNode, tree: FsTree): string {
  const own = ownSummary(node, tree);
  if (own) return own;

  const parentPath = parentPathOf(node.path);
  const parent = parentPath ? tree[parentPath] : undefined;
  const parentSummary = parent ? ownSummary(parent, tree) : undefined;
  if (parentSummary) return parentSummary;

  return SITE_DESCRIPTION;
}

/** D22: OG image paths follow the node's *URL*, not its path in the fake filesystem —
 * `/og/index.png` for `/`, `/og/projects/orbital-mesh.png` for `/projects/orbital-mesh/`. */
function ogPathFor(url: string): string {
  const trimmed = url.replace(/^\/+|\/+$/g, '');
  return `/og/${trimmed === '' ? 'index' : trimmed}.png`;
}

/**
 * The full per-page meta set (ticket 18 § Meta). `node` is omitted for `/`, which gets
 * the fixed title/description rather than a lookup — `/` has no collection entry backing
 * it, so there's nothing to derive a title from. `site` is the absolute origin
 * (`Astro.site`, stringified by the caller) every URL here is built against.
 */
export function pageMeta(node: FsNode | undefined, tree: FsTree, site: string): PageMeta {
  const origin = site.replace(/\/+$/, '');

  const title = node ? `${node.title} · ${SITE_NAME}` : ROOT_TITLE;
  const description = node ? descriptionFor(node, tree) : SITE_DESCRIPTION;
  const url = node?.url ?? '/';

  return {
    title,
    description,
    canonical: `${origin}${url}`,
    ogImage: `${origin}${ogPathFor(url)}`,
    // Ticket 18 § Social: "og:image:alt set to the title" — the same computed title,
    // suffix and all, never a separate "og-title" string.
    ogImageAlt: title,
  };
}
