import { describe, expect, it } from 'vitest';
import type { FsNode, FsTree } from '~/fs/types';
import { pageMeta } from './meta';
import { SITE_DESCRIPTION } from './site';

const SITE = 'https://joe-valdez-portfolio.pages.dev';

function node(partial: Partial<FsNode> & Pick<FsNode, 'path' | 'name' | 'kind' | 'title'>): FsNode {
  return partial;
}

// A hand-built tree standing in for `buildTree`'s output (kept independent of `fs/tree`
// so this file tests `pageMeta` in isolation, per the same discipline as `fs/tree.test.ts`).
const tree: FsTree = {
  '/': node({ path: '/', name: '', kind: 'dir', title: 'Root', children: ['/projects'] }),
  '/projects': node({
    path: '/projects',
    name: 'projects',
    kind: 'dir',
    title: 'Projects',
    url: '/projects/',
    children: ['/projects/orbital-mesh'],
  }),
  '/projects/orbital-mesh': node({
    path: '/projects/orbital-mesh',
    name: 'orbital-mesh',
    kind: 'dir',
    title: 'Orbital Mesh',
    url: '/projects/orbital-mesh/',
    children: ['/projects/orbital-mesh/readme.md', '/projects/orbital-mesh/notes.md'],
  }),
  '/projects/orbital-mesh/readme.md': node({
    path: '/projects/orbital-mesh/readme.md',
    name: 'readme.md',
    kind: 'file',
    title: 'Orbital Mesh',
    url: '/projects/orbital-mesh/',
    summary: 'A distributed mesh scheduler.',
  }),
  // A note with no summary of its own (ticket 18 § Meta: falls back to the parent's).
  '/projects/orbital-mesh/notes.md': node({
    path: '/projects/orbital-mesh/notes.md',
    name: 'notes.md',
    kind: 'file',
    title: 'Scheduler tuning notes',
    url: '/projects/orbital-mesh/notes/',
  }),
  // A folder with no readme and no summary anywhere in the chain — the "else" case,
  // must fall all the way to SITE_DESCRIPTION without throwing.
  '/empty-folder': node({
    path: '/empty-folder',
    name: 'empty-folder',
    kind: 'dir',
    title: 'Empty Folder',
    url: '/empty-folder/',
    children: ['/empty-folder/other.md'],
  }),
  '/empty-folder/other.md': node({
    path: '/empty-folder/other.md',
    name: 'other.md',
    kind: 'file',
    title: 'Other',
    url: '/empty-folder/other/',
  }),
  // A page with its own summary, mounted directly off root.
  '/about.txt': node({
    path: '/about.txt',
    name: 'about.txt',
    kind: 'file',
    title: 'About',
    url: '/about/',
    summary: 'A short introduction.',
  }),
};

describe('pageMeta', () => {
  it('uses the node’s own summary when it has one', () => {
    const meta = pageMeta(tree['/about.txt'], tree, SITE);
    expect(meta.description).toBe('A short introduction.');
  });

  it('falls back to the parent directory’s summary (borrowed from its readme)', () => {
    const meta = pageMeta(tree['/projects/orbital-mesh/notes.md'], tree, SITE);
    expect(meta.description).toBe('A distributed mesh scheduler.');
  });

  it('falls back to SITE_DESCRIPTION when neither the node nor its parent has one', () => {
    const meta = pageMeta(tree['/empty-folder/other.md'], tree, SITE);
    expect(meta.description).toBe(SITE_DESCRIPTION);
  });

  it('gives a folder page without a readme a sensible title and description', () => {
    const meta = pageMeta(tree['/empty-folder'], tree, SITE);
    expect(meta.title).toBe('Empty Folder · Joe Valdez');
    expect(meta.description).toBe(SITE_DESCRIPTION);
  });

  it('never uses the raw filename for the title', () => {
    const meta = pageMeta(tree['/projects/orbital-mesh/readme.md'], tree, SITE);
    expect(meta.title).toBe('Orbital Mesh · Joe Valdez');
    expect(meta.title).not.toContain('readme.md');
  });

  it('gives "/" (no node) the fixed title and the site-wide description', () => {
    const meta = pageMeta(undefined, tree, SITE);
    expect(meta.title).toBe('Joe Valdez · Software Engineer');
    expect(meta.description).toBe(SITE_DESCRIPTION);
  });

  it('builds an absolute, self-canonical URL from the site origin', () => {
    const meta = pageMeta(tree['/projects/orbital-mesh/readme.md'], tree, SITE);
    expect(meta.canonical).toBe(`${SITE}/projects/orbital-mesh/`);
  });

  it('builds "/" canonical as the bare origin plus a slash', () => {
    const meta = pageMeta(undefined, tree, SITE);
    expect(meta.canonical).toBe(`${SITE}/`);
  });

  it('builds the OG image path from the URL per D22, not the node path', () => {
    const meta = pageMeta(tree['/projects/orbital-mesh/readme.md'], tree, SITE);
    expect(meta.ogImage).toBe(`${SITE}/og/projects/orbital-mesh.png`);
  });

  it('uses "/og/index.png" for "/"', () => {
    const meta = pageMeta(undefined, tree, SITE);
    expect(meta.ogImage).toBe(`${SITE}/og/index.png`);
  });

  it('sets og:image:alt to the computed title', () => {
    const meta = pageMeta(tree['/about.txt'], tree, SITE);
    expect(meta.ogImageAlt).toBe(meta.title);
  });

  it('never implies noindex anywhere in the emitted meta (ticket 18: nothing is hidden)', () => {
    for (const candidate of [undefined, tree['/about.txt'], tree['/empty-folder']]) {
      const meta = pageMeta(candidate, tree, SITE);
      expect(JSON.stringify(meta).toLowerCase()).not.toContain('noindex');
    }
  });
});
