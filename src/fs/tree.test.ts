import { describe, expect, it } from 'vitest';
import { mounts } from './mounts';
import { buildTree, type RawEntry } from './tree';
import type { FsNode } from './types';

// A handful of `/bin` nodes, standing in for `src/fs/bin.ts`'s real export — this file
// tests `buildTree` in isolation, per its own contract of taking plain data.
const bin: FsNode[] = [
  {
    path: '/bin/ls',
    name: 'ls',
    kind: 'text',
    title: 'ls',
    text: 'ls [path]      list a directory\nusage: ls [path]',
  },
  { path: '/bin/hack', name: 'hack', kind: 'text', title: 'hack', text: 'do not.' },
  {
    path: '/bin/terminal.exe',
    name: 'terminal.exe',
    kind: 'app',
    title: 'terminal.exe',
    app: 'terminal',
    launcher: true,
    icon: true,
  },
];

const pages: RawEntry[] = [
  {
    collection: 'pages',
    id: 'about',
    data: { type: 'page', title: 'About', filename: 'about.txt', order: 1 },
  },
  {
    collection: 'pages',
    id: 'resume',
    data: { type: 'page', title: 'Resume', filename: 'resume.txt', order: 4 },
  },
  {
    collection: 'pages',
    id: 'contact',
    data: { type: 'page', title: 'Contact', filename: 'contact.txt', order: 5 },
  },
];

const projects: RawEntry[] = [
  {
    collection: 'projects',
    id: 'orbital-mesh/readme',
    data: {
      type: 'project',
      title: 'Orbital Mesh',
      summary: 'A distributed mesh scheduler.',
      role: 'Lead engineer',
      period: { start: '2025-03', end: 'present' },
      status: 'wip',
      featured: true,
    },
  },
  {
    collection: 'projects',
    id: 'orbital-mesh/notes',
    data: { type: 'note', title: 'Scheduler tuning notes' },
  },
  {
    collection: 'projects',
    id: 'ledger-lite',
    data: {
      type: 'project',
      title: 'Ledger Lite',
      role: 'Solo maintainer',
      period: { start: '2022', end: '2023' },
      status: 'archived',
    },
  },
  {
    collection: 'projects',
    id: 'signal-relay/readme',
    data: {
      type: 'project',
      title: 'Signal Relay',
      role: 'Backend engineer',
      period: { start: '2024', end: '2024' },
      status: 'shipped',
    },
  },
];

const drones: RawEntry[] = [
  {
    collection: 'drones',
    id: 'nazgul/readme',
    data: {
      type: 'drone',
      title: 'Nazgul',
      class: 'freestyle',
      propSizeIn: 5,
      weightG: 612,
      firstFlight: '2025-01-12',
      featured: true,
    },
  },
  { collection: 'drones', id: 'nazgul/tuning', data: { type: 'note', title: 'PID tuning log' } },
  {
    collection: 'drones',
    id: 'pico-whoop',
    data: { type: 'drone', title: 'Pico Whoop', class: 'micro' },
  },
];

const entries: RawEntry[] = [...pages, ...projects, ...drones];

function tree() {
  return buildTree(entries, mounts, bin);
}

describe('buildTree', () => {
  it('synthesises intermediate directories from slash-separated ids', () => {
    const t = tree();
    expect(t['/projects/orbital-mesh']?.kind).toBe('dir');
    expect(t['/projects/orbital-mesh']?.title).toBe('Orbital Mesh'); // inherited from its readme
    expect(t['/drones/nazgul']?.kind).toBe('dir');
    expect(t['/drones/nazgul']?.title).toBe('Nazgul');
  });

  it('collapses a readme.md URL to its directory', () => {
    const t = tree();
    expect(t['/projects/orbital-mesh/readme.md']?.url).toBe('/projects/orbital-mesh/');
    expect(t['/projects/orbital-mesh']?.url).toBe('/projects/orbital-mesh/');
  });

  it('applies a filename override and derives its URL from it', () => {
    const t = tree();
    const about = t['/about.txt'];
    expect(about?.name).toBe('about.txt');
    expect(about?.url).toBe('/about/');
  });

  it('gives a note its own URL, distinct from its parent', () => {
    const t = tree();
    expect(t['/projects/orbital-mesh/notes.md']?.url).toBe('/projects/orbital-mesh/notes/');
  });

  it('gives /bin and its contents no URL', () => {
    const t = tree();
    expect(t['/bin']?.url).toBeUndefined();
    expect(t['/bin/ls']?.url).toBeUndefined();
  });

  it('orders siblings readme first, then featured desc, then date desc, then title', () => {
    const t = tree();
    expect(t['/projects']?.children).toEqual([
      '/projects/orbital-mesh', // featured
      '/projects/signal-relay', // 2024
      '/projects/ledger-lite.md', // 2022
    ]);
    expect(t['/projects/orbital-mesh']?.children).toEqual([
      '/projects/orbital-mesh/readme.md',
      '/projects/orbital-mesh/notes.md',
    ]);
    expect(t['/drones']?.children).toEqual(['/drones/nazgul', '/drones/pico-whoop.md']);
  });

  it('formats the project spec strip with every field present', () => {
    const t = tree();
    expect(t['/projects/orbital-mesh/readme.md']?.strip).toBe('WIP · 2025–PRESENT · LEAD ENGINEER');
    expect(t['/projects/ledger-lite.md']?.strip).toBe('ARCHIVED · 2022–2023 · SOLO MAINTAINER');
  });

  it('formats the drone spec strip, omitting empty parts', () => {
    const t = tree();
    expect(t['/drones/nazgul/readme.md']?.strip).toBe('FREESTYLE · 5" · 612G');
    expect(t['/drones/pico-whoop.md']?.strip).toBe('MICRO');
  });

  it('throws a descriptive error on a duplicate path', () => {
    const dupe: RawEntry[] = [
      ...entries,
      {
        collection: 'projects',
        id: 'ledger-lite',
        data: {
          type: 'project',
          title: 'Ledger Lite II',
          role: 'x',
          period: { start: '2020' },
          status: 'wip',
        },
      },
    ];
    expect(() => buildTree(dupe, mounts, bin)).toThrow(/duplicate path/i);
  });

  it("agrees pages' order with the launcher order of the mount table (D11)", () => {
    // D11: "Launcher and Section order is mount-table order: about, projects, drones,
    // resume, contact" — `resume.pdf`, `readme.txt` and `/bin` are mounts too, but they
    // are not launchers, so they don't get a position in that sequence.
    const launcherOrder = mounts.filter((m) => 'launcher' in m && m.launcher).map((m) => m.path);
    const expected: Record<string, number> = {
      '/about.txt': 1,
      '/resume.txt': 4,
      '/contact.txt': 5,
    };
    for (const [path, order] of Object.entries(expected)) {
      expect(launcherOrder.indexOf(path) + 1).toBe(order);
    }
  });
});
