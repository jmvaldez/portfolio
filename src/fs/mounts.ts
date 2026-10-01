// The mount table: where each collection and synthetic node attaches to the root. Order
// is the launcher and Section order (about, projects, drones, resume, contact). Only
// attachment points live here; `buildTree` synthesises collection contents from the
// entries it is given and attaches `/bin`'s nodes from `bin.ts`.

import { GITHUB_URL, LINKEDIN_URL } from '../lib/site';

export interface RootFileMount {
  kind: 'file';
  path: string;
  /** The `pages` entry id (e.g. 'about') this path shows. */
  collection: 'pages';
  id: string;
  launcher?: boolean;
  icon?: boolean;
  section?: string;
}

export interface CollectionMount {
  kind: 'collection';
  path: string;
  collection: 'projects' | 'drones';
  launcher?: boolean;
  icon?: boolean;
  section?: string;
}

export interface LinkMount {
  kind: 'link';
  path: string;
  title: string;
  href: string;
  download?: string;
  icon?: boolean;
}

export interface TextMount {
  kind: 'text';
  path: string;
  title: string;
  text: string;
  icon?: boolean;
}

/** A synthetic directory whose contents come from elsewhere (`/bin` from `src/fs/bin.ts`). */
export interface BinMount {
  kind: 'bin';
  path: string;
}

export type Mount = RootFileMount | CollectionMount | LinkMount | TextMount | BinMount;

export const mounts: Mount[] = [
  {
    kind: 'file',
    path: '/about.txt',
    collection: 'pages',
    id: 'about',
    launcher: true,
    icon: true,
    section: 'about',
  },
  {
    kind: 'collection',
    path: '/projects',
    collection: 'projects',
    launcher: true,
    icon: true,
    section: 'projects',
  },
  {
    kind: 'collection',
    path: '/drones',
    collection: 'drones',
    launcher: true,
    icon: true,
    section: 'drones',
  },
  {
    kind: 'file',
    path: '/resume.txt',
    collection: 'pages',
    id: 'resume',
    launcher: true,
    icon: true,
    section: 'resume',
  },
  {
    kind: 'link',
    path: '/resume.pdf',
    title: 'resume.pdf',
    href: '/resume.pdf',
    download: 'joe-valdez-resume.pdf',
    icon: true,
  },
  {
    kind: 'file',
    path: '/contact.txt',
    collection: 'pages',
    id: 'contact',
    launcher: true,
    icon: true,
    section: 'contact',
  },
  {
    kind: 'link',
    path: '/linkedin.url',
    title: 'linkedin.url',
    href: LINKEDIN_URL,
    icon: true,
  },
  {
    kind: 'link',
    path: '/github.url',
    title: 'github.url',
    href: GITHUB_URL,
    icon: true,
  },
  {
    kind: 'text',
    path: '/readme.txt',
    title: 'readme.txt',
    text: [
      "you're not lost. 'cat about.txt' is the short version of why this exists.",
      "'help' spells the rest out, if you'd rather be told than look.",
      '',
    ].join('\n'),
    icon: true,
  },
  { kind: 'bin', path: '/bin' },
];
