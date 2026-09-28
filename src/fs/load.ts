// Server-only glue between `astro:content` and the pure tree builder (map Hazards:
// `getCollection()` is a hard `[ServerOnlyModule]` build error from client code — nothing
// in this file may be imported by an island).

import { getCollection, getEntry } from 'astro:content';
import { binNodes } from './bin';
import { mounts } from './mounts';
import { buildTree, type RawEntry } from './tree';
import type { FsTree } from './types';

let cached: FsTree | undefined;

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

/** Looks a node's underlying collection entry back up, for a page to reach
 * `entry.rendered` and its frontmatter. `undefined` for a node with no collection entry
 * behind it (a synthetic node, or a node that doesn't exist). */
export async function getEntryForNode(path: string) {
  const tree = await getTree();
  const node = tree[path];
  if (!node?.entry) return undefined;
  return getEntry(node.entry.collection, node.entry.id);
}
