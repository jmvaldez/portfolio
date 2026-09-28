// Server-only glue between `astro:content` and the pure tree builder. Islands must not
// import this: `getCollection()` from client code is a build error.

import { getCollection, getEntry } from 'astro:content';
import { binNodes } from './bin';
import { mounts } from './mounts';
import { buildTree, type RawEntry } from './tree';
import type { FsTree } from './types';

let cached: FsTree | undefined;

/** Returns the filesystem tree, built once from all collections and cached. */
export async function getTree(): Promise<FsTree> {
  if (cached) return cached;

  const [projects, drones, pages] = await Promise.all([
    getCollection('projects'),
    getCollection('drones'),
    getCollection('pages'),
  ]);

  const entries: RawEntry[] = [
    ...projects.map((e) => ({ collection: 'projects' as const, id: e.id, data: e.data })),
    ...drones.map((e) => ({ collection: 'drones' as const, id: e.id, data: e.data })),
    ...pages.map((e) => ({ collection: 'pages' as const, id: e.id, data: e.data })),
  ];

  cached = buildTree(entries, mounts, binNodes);
  return cached;
}

/** Returns the collection entry behind the node at `path`, for its rendered body and
 * frontmatter. Returns `undefined` for a synthetic or missing node. */
export async function getEntryForNode(path: string) {
  const tree = await getTree();
  const node = tree[path];
  if (!node?.entry) return undefined;
  return getEntry(node.entry.collection, node.entry.id);
}
