// Desktop icons (ticket 05 § Terminal and desktop surfaces: "derived from the same
// mount table [as the taskbar], so the desktop and the taskbar cannot disagree";
// ticket 14 § Shell structure: "a labelled list of buttons"). Read straight off
// `mounts.ts`, in mount-table order — not off `getTree()` (a hard `[ServerOnlyModule]`
// build error from client code, map Hazards) and not off the tree's own child-order
// bookkeeping, which is `/`'s D10 listing order, not the icon set. The actual node
// data (title, kind, url, …) still comes from the store's `tree`, so a node with
// `icon: true` in the mount table but no matching tree entry (shouldn't happen, but
// cheap to guard) is silently skipped rather than rendered half-populated.
import type { KeyboardEvent } from 'react';
import type { FsNode } from '~/fs/types';
import { mounts, type BinMount, type Mount } from '~/fs/mounts';
import { appRegistry } from './apps/registry';
import { prefetchBody } from './bodies';
import { launch } from './launch';
import { useShellStore } from './store';

function hasIcon(mount: Mount): mount is Exclude<Mount, BinMount> {
  return mount.kind !== 'bin' && Boolean(mount.icon);
}

/** An `app` node whose `app` isn't registered isn't launchable at all (ticket 05,
 * D16's rule generalised) — its icon must not even render, not just sit there
 * disabled. Every other kind is always launchable. */
function isLaunchable(node: FsNode): boolean {
  return node.kind !== 'app' || (node.app !== undefined && node.app in appRegistry);
}

/** Reasonable placeholder glyphs per kind (visual system is ticket 06's job, not
 * this task's — these are box-drawing characters from the same subset ticket 13
 * kept for chrome, `case,tnum` plus the font's default box-drawing coverage). */
function glyphOf(node: FsNode): string {
  switch (node.kind) {
    case 'dir':
      return '▧';
    case 'app':
      return '◆';
    case 'link':
      return '⇩';
    case 'file':
    case 'text':
      return '▤';
  }
}

export default function DesktopIcons() {
  const tree = useShellStore((state) => state.tree);
  if (!tree) return null;

  const icons = mounts
    .filter(hasIcon)
    .map((mount) => tree[mount.path])
    .filter((node): node is FsNode => node !== undefined && isLaunchable(node));

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
              {glyphOf(node)}
            </span>
            <span className="desktop-icon-label">{node.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
