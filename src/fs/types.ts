// The serialisable filesystem node. The island receives an `FsTree` as serialised props,
// so it must stay JSON-safe: no functions, `Date`s, or anything `JSON.stringify` drops.

export type NodeKind = 'dir' | 'file' | 'text' | 'app' | 'link';

export interface FsNode {
  /** Absolute path, e.g. '/projects/orbital-mesh/readme.md'. Also the key into `FsTree`. */
  path: string;
  /** The filename shown in a listing or a title bar, e.g. 'readme.md'. */
  name: string;
  kind: NodeKind;
  /** Human title. Directories use their readme's title, falling back to their name. */
  title: string;
  /** The node's page, if it has one. Root, `/bin`, and `text`/`app`/`link` nodes omit it. */
  url?: string;
  /** Directories only: child paths in listing order (mount order for `/`, authored
   * order for `/bin`). */
  children?: string[];
  summary?: string;
  /** One-line spec strip, on project and drone `file` nodes only. */
  strip?: string;
  entry?: {
    collection: 'projects' | 'drones' | 'pages';
    id: string;
    type: 'project' | 'drone' | 'note' | 'page';
  };
  /** `file` nodes only: `/fs/body/<path>.html`. */
  bodyUrl?: string;
  /** `file` nodes only: `/fs/src/<path>.txt`. */
  srcUrl?: string;
  /** `text` nodes: inline prose, printed whole by `cat`. */
  text?: string;
  /** `link` nodes. */
  href?: string;
  download?: string;
  /** `app` nodes. */
  app?: 'terminal' | 'viewer';
  /** UI flags read by the taskbar, the desktop icons, and the linear layout's Sections. */
  launcher?: boolean;
  icon?: boolean;
  section?: string;
}

export type FsTree = Record<string, FsNode>;
