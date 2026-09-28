// Pure path resolution for the terminal: absolute, relative, `.`, `..` (clamped at `/`),
// `~` as `/`, and repeated or trailing slashes. Works on an already-built `FsTree`.

import type { FsNode, FsTree } from './types';

export type PathResult = { node: FsNode } | { error: 'ENOENT' | 'ENOTDIR' };

/** Turns `wd` + `input` into an absolute segment list with no empty or `.` segments and
 * `..` resolved, clamped at the root. */
function normalizeSegments(wd: string, input: string): string[] {
  const base = input.startsWith('~')
    ? `/${input.slice(1)}`
    : input.startsWith('/')
      ? input
      : `${wd}/${input}`;
  const segments: string[] = [];
  for (const segment of base.split('/')) {
    if (segment.length === 0 || segment === '.') continue;
    if (segment === '..') {
      if (segments.length > 0) segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments;
}

/** Resolves `input` against `wd` to a node, or an `ENOENT`/`ENOTDIR` error. */
export function resolvePath(tree: FsTree, wd: string, input: string): PathResult {
  const segments = normalizeSegments(wd, input);

  if (segments.length === 0) {
    const root = tree['/'];
    return root ? { node: root } : { error: 'ENOENT' };
  }

  let currentPath = '';
  for (let i = 0; i < segments.length; i++) {
    currentPath += `/${segments[i]}`;
    const node = tree[currentPath];
    if (!node) return { error: 'ENOENT' };
    const isLast = i === segments.length - 1;
    if (!isLast && node.kind !== 'dir') return { error: 'ENOTDIR' };
    if (isLast) return { node };
  }

  /* istanbul ignore next -- unreachable: the loop above always returns on its last
   * iteration once `segments.length > 0`. */
  return { error: 'ENOENT' };
}

/** Lists the children of `path` in `ls` order (alphabetical by name), not listing order. */
export function listDir(tree: FsTree, path: string): FsNode[] {
  const dir = tree[path];
  const childPaths = dir?.children ?? [];
  return childPaths
    .map((childPath) => tree[childPath])
    .filter((node): node is FsNode => node !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));
}
