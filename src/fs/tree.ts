// The pure tree builder (ticket 05 § The filesystem, ticket 12 § URLs, D9, D10, D12).
//
// Takes plain data — collection entries, the mount table, and `/bin`'s nodes — and
// returns the finished filesystem, keyed by path. No `astro:content` import here (see
// `src/fs/load.ts` for the server-only glue): that's what makes this file directly
// unit-testable (map Hazards: `getCollection()` is a hard build error outside the server).

import type {
  BinMount,
  CollectionMount,
  LinkMount,
  Mount,
  RootFileMount,
  TextMount,
} from './mounts';
import type { FsNode, FsTree } from './types';

/**
 * A collection entry, reduced to what the tree builder needs. Loosely typed on purpose —
 * covers the union of `project` / `drone` / `note` / `page` fields the schemas in
 * `src/content/schemas.ts` validate well before this runs.
 */
export interface RawEntryData {
  type: 'project' | 'drone' | 'note' | 'page';
  title: string;
  summary?: string | undefined;
  filename?: string | undefined;
  featured?: boolean | undefined;
  status?: 'shipped' | 'archived' | 'wip' | undefined;
  role?: string | undefined;
  period?: { start: string; end?: string | undefined } | undefined;
  class?: string | undefined;
  propSizeIn?: number | undefined;
  weightG?: number | undefined;
  firstFlight?: Date | string | undefined;
  order?: number | undefined;
}

export interface RawEntry {
  collection: 'projects' | 'drones' | 'pages';
  id: string;
  data: RawEntryData;
}

/** D10's sort key, computed per node and consumed once children arrays are built. A
 * synthesized directory inherits its readme's (ticket 05 D10: "a directory inherits its
 * readme's"). */
interface SortKey {
  isReadme: boolean;
  featured: boolean;
  dateKey?: string | undefined;
  title: string;
}

/** Directories whose children preserve their authored/mount-table order rather than D10 —
 * D10 is about listing order *inside a collection*, and neither of these is one. */
const UNSORTED_DIRS = new Set(['/', '/bin']);
/** Directories with no page of their own (D12). */
const NO_URL_DIRS = new Set(['/', '/bin']);

function dateKeyOf(entry: Pick<RawEntry, 'collection' | 'data'>): string | undefined {
  if (entry.collection === 'projects') return entry.data.period?.start;
  if (entry.collection === 'drones') {
    const flight = entry.data.firstFlight;
    if (flight === undefined) return undefined;
    return flight instanceof Date ? flight.toISOString().slice(0, 10) : flight;
  }
  return undefined;
}

function titleCase(segment: string): string {
  return segment
    .split(/[-_]/)
    .map((word) => (word.length > 0 ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function withTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

function dropExtension(path: string): string {
  return path.replace(/\.[^./]+$/, '');
}

/** `readme.md` collapses to its directory's own URL; everything else drops its extension
 * (ticket 12 § URLs). */
function fileUrl(path: string, name: string, dirUrl: string): string {
  return name === 'readme.md' ? dirUrl : withTrailingSlash(dropExtension(path));
}

/** D6: `{ start, end? }` renders as `2025–PRESENT` in chrome. Only the year survives in
 * the strip even when `start`/`end` carry a month. */
function formatPeriod(period: { start: string; end?: string | undefined }): string {
  const start = period.start.slice(0, 4);
  if (period.end === undefined) return start;
  const end = period.end === 'present' ? 'PRESENT' : period.end.slice(0, 4);
  return `${start}–${end}`;
}

/** Ticket 12 spec strip: `STATUS · PERIOD · ROLE`, uppercase, empty parts omitted. */
function projectStrip(data: RawEntryData): string {
  const parts = [
    data.status?.toUpperCase(),
    data.period ? formatPeriod(data.period) : undefined,
    data.role?.toUpperCase(),
  ];
  return parts.filter((part): part is string => part !== undefined).join(' · ');
}

/** Ticket 12 spec strip: `CLASS · <prop>" · <weight>G`, uppercase, empty parts omitted. */
function droneStrip(data: RawEntryData): string {
  const parts = [
    data.class?.toUpperCase(),
    data.propSizeIn !== undefined ? `${data.propSizeIn}"` : undefined,
    data.weightG !== undefined ? `${data.weightG}G` : undefined,
  ];
  return parts.filter((part): part is string => part !== undefined).join(' · ');
}

/** D10: readme first, then featured desc, then date desc, then title. */
function compareD10(a: SortKey, b: SortKey): number {
  if (a.isReadme !== b.isReadme) return a.isReadme ? -1 : 1;
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  if (a.dateKey !== b.dateKey) {
    if (a.dateKey === undefined) return 1;
    if (b.dateKey === undefined) return -1;
    return a.dateKey > b.dateKey ? -1 : 1;
  }
  return a.title.localeCompare(b.title);
}

export function buildTree(entries: RawEntry[], mounts: Mount[], bin: FsNode[]): FsTree {
  const tree: FsTree = {};
  const sortKeys = new Map<string, SortKey>();
  const childPaths = new Map<string, string[]>();

  function addChild(parentPath: string, childPath: string): void {
    const list = childPaths.get(parentPath);
    if (list) list.push(childPath);
    else childPaths.set(parentPath, [childPath]);
  }

  function insert(node: FsNode, sortKey?: SortKey): void {
    if (tree[node.path]) {
      throw new Error(`fs/tree: duplicate path "${node.path}"`);
    }
    tree[node.path] = node;
    if (sortKey) sortKeys.set(node.path, sortKey);
  }

  function ensureDir(path: string, parentPath: string): FsNode {
    const existing = tree[path];
    if (existing) return existing;
    const name = path.slice(path.lastIndexOf('/') + 1);
    const title = titleCase(name);
    const node: FsNode = NO_URL_DIRS.has(path)
      ? { path, name, kind: 'dir', title }
      : { path, name, kind: 'dir', title, url: withTrailingSlash(path) };
    insert(node, { isReadme: false, featured: false, title });
    addChild(parentPath, path);
    return node;
  }

  function buildFileMount(mount: RootFileMount): void {
    const entry = entries.find((e) => e.collection === mount.collection && e.id === mount.id);
    if (!entry) {
      throw new Error(
        `fs/tree: no ${mount.collection} entry "${mount.id}" for mount ${mount.path}`,
      );
    }
    const name = entry.data.filename ?? `${mount.id}.md`;
    const url = withTrailingSlash(dropExtension(mount.path));
    const node: FsNode = {
      path: mount.path,
      name,
      kind: 'file',
      title: entry.data.title,
      url,
      entry: { collection: entry.collection, id: entry.id, type: entry.data.type },
      bodyUrl: `/fs/body${mount.path}.html`,
      srcUrl: `/fs/src${mount.path}.txt`,
    };
    if (entry.data.summary !== undefined) node.summary = entry.data.summary;
    if (mount.launcher !== undefined) node.launcher = mount.launcher;
    if (mount.icon !== undefined) node.icon = mount.icon;
    if (mount.section !== undefined) node.section = mount.section;
    insert(node);
    addChild('/', mount.path);
  }

  function buildCollectionMount(mount: CollectionMount): void {
    const rootNode = ensureDir(mount.path, '/');
    if (mount.launcher !== undefined) rootNode.launcher = mount.launcher;
    if (mount.icon !== undefined) rootNode.icon = mount.icon;
    if (mount.section !== undefined) rootNode.section = mount.section;
    const collectionEntries = entries.filter((e) => e.collection === mount.collection);
    const readmeByDir = new Map<string, RawEntry>();

    for (const entry of collectionEntries) {
      const segments = entry.id.split('/');
      const last = segments[segments.length - 1]!;
      let dirPath = mount.path;
      for (const segment of segments.slice(0, -1)) {
        const parent = dirPath;
        dirPath = `${dirPath}/${segment}`;
        ensureDir(dirPath, parent);
      }
      const name = entry.data.filename ?? (last === 'readme' ? 'readme.md' : `${last}.md`);
      const path = `${dirPath}/${name}`;
      const dirUrl = withTrailingSlash(dirPath);
      const node: FsNode = {
        path,
        name,
        kind: 'file',
        title: entry.data.title,
        url: fileUrl(path, name, dirUrl),
        entry: { collection: entry.collection, id: entry.id, type: entry.data.type },
        bodyUrl: `/fs/body${path}.html`,
        srcUrl: `/fs/src${path}.txt`,
      };
      if (entry.data.summary !== undefined) node.summary = entry.data.summary;
      if (entry.data.type === 'project') node.strip = projectStrip(entry.data);
      if (entry.data.type === 'drone') node.strip = droneStrip(entry.data);

      insert(node, {
        isReadme: name === 'readme.md',
        featured: Boolean(entry.data.featured),
        dateKey: dateKeyOf(entry),
        title: entry.data.title,
      });
      addChild(dirPath, path);
      if (name === 'readme.md') readmeByDir.set(dirPath, entry);
    }

    for (const [dirPath, readme] of readmeByDir) {
      const dirNode = tree[dirPath];
      if (!dirNode) continue;
      dirNode.title = readme.data.title;
      sortKeys.set(dirPath, {
        isReadme: false,
        featured: Boolean(readme.data.featured),
        dateKey: dateKeyOf(readme),
        title: readme.data.title,
      });
    }
  }

  function buildLinkMount(mount: LinkMount): void {
    const name = mount.path.slice(mount.path.lastIndexOf('/') + 1);
    const node: FsNode = {
      path: mount.path,
      name,
      kind: 'link',
      title: mount.title,
      href: mount.href,
    };
    if (mount.download !== undefined) node.download = mount.download;
    if (mount.icon !== undefined) node.icon = mount.icon;
    insert(node);
    addChild('/', mount.path);
  }

  function buildTextMount(mount: TextMount): void {
    const name = mount.path.slice(mount.path.lastIndexOf('/') + 1);
    const node: FsNode = {
      path: mount.path,
      name,
      kind: 'text',
      title: mount.title,
      text: mount.text,
    };
    if (mount.icon !== undefined) node.icon = mount.icon;
    insert(node);
    addChild('/', mount.path);
  }

  function buildBinMount(mount: BinMount): void {
    ensureDir(mount.path, '/');
    for (const node of bin) {
      insert(node, { isReadme: false, featured: false, title: node.title });
      addChild(mount.path, node.path);
    }
  }

  insert({ path: '/', name: '/', kind: 'dir', title: '/' });

  for (const mount of mounts) {
    switch (mount.kind) {
      case 'file':
        buildFileMount(mount);
        break;
      case 'collection':
        buildCollectionMount(mount);
        break;
      case 'link':
        buildLinkMount(mount);
        break;
      case 'text':
        buildTextMount(mount);
        break;
      case 'bin':
        buildBinMount(mount);
        break;
    }
  }

  for (const [dirPath, children] of childPaths) {
    const dirNode = tree[dirPath];
    if (!dirNode) continue;
    dirNode.children = UNSORTED_DIRS.has(dirPath)
      ? children
      : [...children].sort((a, b) => compareD10(sortKeys.get(a)!, sortKeys.get(b)!));
  }

  return tree;
}
