// The serialisable filesystem node (ticket 05 § The filesystem, ticket 12 § URLs, D9, D12).
//
// This is the contract every later phase reads: the island receives a `FsTree` as
// serialised props (research 05 § 3), so it must stay JSON-safe — no functions, no
// `Date`, nothing that can't survive `JSON.stringify`/Astro's prop serialiser.

export type NodeKind = 'dir' | 'file' | 'text' | 'app' | 'link';

export interface FsNode {
  /** Absolute path, e.g. '/projects/orbital-mesh/readme.md'. Also the key into `FsTree`. */
  path: string;
  /** The filename shown in a listing or a title bar, e.g. 'readme.md'. */
  name: string;
  kind: NodeKind;
  /** Human title. Directories use their readme's title, falling back to their name. */
  title: string;
  /** The node's page, iff it has one (ticket 09: a window has a maximise box iff its
   * node has a URL). Root, `/bin`, and every `text`/`app`/`link` node omit this (D12). */
  url?: string;
  /** Directory only: child paths in listing order (D10 inside a collection mount; the
   * mount table's own order for `/`; `/bin`'s authored order for `/bin`). */
  children?: string[];
  summary?: string;
  /** The one-line spec strip (ticket 12), project/drone `file` nodes only. */
  strip?: string;
  entry?: {
    collection: 'projects' | 'drones' | 'pages';
    id: string;
    type: 'project' | 'drone' | 'note' | 'page';
  };
  /** `file` nodes only (D9): '/fs/body/<path>.html'. */
  bodyUrl?: string;
  /** `file` nodes only (D9): '/fs/src/<path>.txt'. */
  srcUrl?: string;
  /** `text` nodes: inline prose, printed whole by `cat`. */
  text?: string;
  /** `link` nodes. */
  href?: string;
  download?: string;
  /** `app` nodes. */
  app?: 'terminal' | 'viewer';
  /** D11: UI flags read by the taskbar, the desktop icons, and the linear layout's
   * Sections. */
  launcher?: boolean;
  icon?: boolean;
  section?: string;
}

export type FsTree = Record<string, FsNode>;
