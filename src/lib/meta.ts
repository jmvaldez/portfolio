// Per-page meta. Pure: imports nothing from `astro:content` or `astro:config`, so it can
// be unit-tested, which is why the site origin is a parameter rather than read live.

import type { FsNode, FsTree } from '~/fs/types';
import { SITE_DESCRIPTION, SITE_NAME } from './site';

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  ogImageAlt: string;
}

/** The fixed title for `/`, the exception to `<entry title> · Joe Valdez`. */
const ROOT_TITLE = `${SITE_NAME} · Software Engineer`;

function parentPathOf(path: string): string | undefined {
  if (path === '/') return undefined;
  const idx = path.lastIndexOf('/');
  return idx <= 0 ? '/' : path.slice(0, idx);
}

/** Returns the node's own summary; a directory without one borrows its readme's. */
function ownSummary(node: FsNode, tree: FsTree): string | undefined {
  if (node.summary) return node.summary;
  if (node.kind === 'dir') {
    const readmePath = node.children?.find((childPath) => tree[childPath]?.name === 'readme.md');
    return readmePath ? tree[readmePath]?.summary : undefined;
  }
  return undefined;
}

/**
 * Returns the description for `node`: its own summary, else its parent directory's, else
 * the site-wide default. Never throws. Exported so the OG card shows the same text as
 * `og:description`.
 */
export function descriptionFor(node: FsNode, tree: FsTree): string {
  const own = ownSummary(node, tree);
  if (own) return own;

  const parentPath = parentPathOf(node.path);
  const parent = parentPath ? tree[parentPath] : undefined;
  const parentSummary = parent ? ownSummary(parent, tree) : undefined;
  if (parentSummary) return parentSummary;

  return SITE_DESCRIPTION;
}

/** Returns the OG image path for a node URL, e.g. `/og/index.png` for `/` and
 * `/og/projects/orbital-mesh.png` for `/projects/orbital-mesh/`. */
function ogPathFor(url: string): string {
  const trimmed = url.replace(/^\/+|\/+$/g, '');
  return `/og/${trimmed === '' ? 'index' : trimmed}.png`;
}

/**
 * Returns the full meta set for a page. `node` is omitted for `/`, which gets the fixed
 * title and description. `site` is the absolute origin (`Astro.site` as a string) that
 * every URL is built against.
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
    // The alt text reuses the computed title, suffix included.
    ogImageAlt: title,
  };
}
