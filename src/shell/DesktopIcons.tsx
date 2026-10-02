// Desktop icons, in mount-table order, then the `/bin` apps flagged `icon` (terminal,
// viewer). The icon set comes from `mounts.ts` (not `getTree()`, which is server-only) so
// the desktop and taskbar agree; node data comes from the store's `tree`, and a mount with
// no matching node is skipped.
import type { KeyboardEvent } from 'react';
import type { FsNode } from '~/fs/types';
import { mounts, type BinMount, type Mount } from '~/fs/mounts';
import { isExternalHref } from '~/lib/external-links';
import { appRegistry } from './apps/registry';
import { prefetchBody } from './bodies';
import { brandLogos } from './brandLogos';
import { launch } from './launch';
import { useShellStore } from './store';

function hasIcon(mount: Mount): mount is Exclude<Mount, BinMount> {
  return mount.kind !== 'bin' && Boolean(mount.icon);
}

/** Returns whether `node` can be launched; an `app` node with no registered app cannot. */
function isLaunchable(node: FsNode): boolean {
  return node.kind !== 'app' || (node.app !== undefined && node.app in appRegistry);
}

/** Returns the placeholder icon glyph for a node's kind. */
function glyphOf(node: FsNode): string {
  switch (node.kind) {
    case 'dir':
      return '▧';
    case 'app':
      return '◆';
    case 'link':
      return isExternalHref(node.href) ? '↗' : '⇩';
    case 'file':
    case 'text':
      return '▤';
  }
}

export default function DesktopIcons() {
  const tree = useShellStore((state) => state.tree);
  if (!tree) return null;

  const binIcons = Object.values(tree).filter(
    (node) => node.path.startsWith('/bin/') && node.icon === true,
  );
  const icons = [...mounts.filter(hasIcon).map((mount) => tree[mount.path]), ...binIcons].filter(
    (node): node is FsNode => node !== undefined && isLaunchable(node),
  );

  function handleKeyDown(node: FsNode) {
    return (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        launch(node);
      }
    };
  }

  return (
    <ul className="desktop-icons" aria-label="Desktop">
      {icons.map((node) => (
        <li key={node.path}>
          <button
            type="button"
            className="desktop-icon"
            onDoubleClick={() => launch(node)}
            onKeyDown={handleKeyDown(node)}
            onMouseEnter={() => prefetchBody(node)}
            onFocus={() => prefetchBody(node)}
          >
            <span className="desktop-icon-glyph" aria-hidden="true">
              {brandLogos[node.path] ?? glyphOf(node)}
            </span>
            <span className="desktop-icon-label">{node.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
