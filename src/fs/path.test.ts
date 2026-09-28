import { describe, expect, it } from 'vitest';
import { listDir, resolvePath } from './path';
import type { FsTree } from './types';

// A small fixture tree, enough to exercise every resolution rule without pulling in the
// real mount table or content collections.
const tree: FsTree = {
  '/': {
    path: '/',
    name: '/',
    kind: 'dir',
    title: '/',
    children: ['/about.txt', '/projects', '/drones', '/bin'],
  },
  '/about.txt': {
    path: '/about.txt',
    name: 'about.txt',
    kind: 'file',
    title: 'About',
    url: '/about/',
  },
  '/projects': {
    path: '/projects',
    name: 'projects',
    kind: 'dir',
    title: 'Projects',
    url: '/projects/',
    children: ['/projects/orbital-mesh'],
  },
  '/projects/orbital-mesh': {
    path: '/projects/orbital-mesh',
    name: 'orbital-mesh',
    kind: 'dir',
    title: 'Orbital Mesh',
    url: '/projects/orbital-mesh/',
    children: ['/projects/orbital-mesh/readme.md', '/projects/orbital-mesh/notes.md'],
  },
  '/projects/orbital-mesh/readme.md': {
    path: '/projects/orbital-mesh/readme.md',
    name: 'readme.md',
    kind: 'file',
    title: 'Orbital Mesh',
    url: '/projects/orbital-mesh/',
  },
  '/projects/orbital-mesh/notes.md': {
    path: '/projects/orbital-mesh/notes.md',
    name: 'notes.md',
    kind: 'file',
    title: 'Scheduler tuning notes',
    url: '/projects/orbital-mesh/notes/',
  },
  '/drones': {
    path: '/drones',
    name: 'drones',
    kind: 'dir',
    title: 'Drones',
    url: '/drones/',
    children: [],
  },
  '/bin': { path: '/bin', name: 'bin', kind: 'dir', title: 'bin', children: ['/bin/ls'] },
  '/bin/ls': {
    path: '/bin/ls',
    name: 'ls',
    kind: 'text',
    title: 'ls',
    text: 'ls [path]      list a directory',
  },
};

describe('resolvePath', () => {
  it('resolves an absolute path', () => {
    const result = resolvePath(tree, '/', '/projects/orbital-mesh');
    expect(result).toEqual({ node: tree['/projects/orbital-mesh'] });
  });

  it('resolves a relative path against the working directory', () => {
    const result = resolvePath(tree, '/projects', 'orbital-mesh');
    expect(result).toEqual({ node: tree['/projects/orbital-mesh'] });
  });

  it('resolves "."', () => {
    const result = resolvePath(tree, '/projects', '.');
    expect(result).toEqual({ node: tree['/projects'] });
  });

  it('resolves ".." one level up', () => {
    const result = resolvePath(tree, '/projects/orbital-mesh', '..');
    expect(result).toEqual({ node: tree['/projects'] });
  });

  it('clamps ".." at the root', () => {
    const result = resolvePath(tree, '/projects', '../..');
    expect(result).toEqual({ node: tree['/'] });
  });

  it('resolves "~" as the root', () => {
    expect(resolvePath(tree, '/projects/orbital-mesh', '~')).toEqual({ node: tree['/'] });
  });

  it('resolves "~/drones"', () => {
    expect(resolvePath(tree, '/projects', '~/drones')).toEqual({ node: tree['/drones'] });
  });

  it('collapses repeated and trailing slashes', () => {
    expect(resolvePath(tree, '/', '//projects///orbital-mesh//')).toEqual({
      node: tree['/projects/orbital-mesh'],
    });
  });

  it('returns ENOENT for a path that does not exist', () => {
    expect(resolvePath(tree, '/', '/nope')).toEqual({ error: 'ENOENT' });
  });

  it('returns ENOTDIR when a file appears mid-path', () => {
    expect(resolvePath(tree, '/', '/about.txt/x')).toEqual({ error: 'ENOTDIR' });
  });
});

describe('listDir', () => {
  it('sorts children alphabetically, distinct from D10 order', () => {
    const names = listDir(tree, '/projects/orbital-mesh').map((n) => n.name);
    expect(names).toEqual(['notes.md', 'readme.md']); // alphabetical, not readme-first
  });

  it('returns an empty array for an empty directory', () => {
    expect(listDir(tree, '/drones')).toEqual([]);
  });
});
