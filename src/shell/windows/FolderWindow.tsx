// A window holding a `dir` node's listing, in `node.children` order. Rows and class names
// match `FolderListing.astro`, but each row is a `<button>`, since launching goes through
// `launch()` rather than a navigation.
//
// A single click only focuses the row; double-click or Enter launches. Space is deliberately
// not bound (unlike `DesktopIcons.tsx`), as in file managers where it toggles selection.
import { useEffect, useRef } from 'react';
import type { FsNode } from '~/fs/types';
import { prefetchBody } from '../bodies';
import { launch } from '../launch';
import { useShellStore } from '../store';

interface Props {
  node: FsNode;
}

/** Returns the `ls -F`-style marker for `child`: a trailing slash for a directory. */
function markerOf(child: FsNode): string {
  return child.kind === 'dir' ? '/' : '';
}

export default function FolderWindow({ node }: Props) {
  const tree = useShellStore((state) => state.tree);
  const rootRef = useRef<HTMLDivElement>(null);

  const children = (node.children ?? [])
    .map((path) => tree?.[path])
    .filter((child): child is FsNode => child !== undefined);

  // The listing comes from the store synchronously, so there is no load to wait on:
  // restore the saved scroll position on mount.
  useEffect(() => {
    const container = rootRef.current?.parentElement;
    const pending = useShellStore.getState().consumePendingScroll(node.path);
    if (pending !== undefined && container) container.scrollTo({ top: pending });
    // Only on mount: `node.path` is this window's own id and never changes under it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="folder-listing" ref={rootRef}>
      <div className="folder-listing-head" aria-hidden="true">
        <span className="folder-col-name">Name</span>
        <span className="folder-col-title">Title</span>
        <span className="folder-col-spec">Spec</span>
      </div>
      <ul className="folder-listing-rows">
        {children.map((child) => (
          <li className="folder-row" key={child.path}>
            <button
              type="button"
              className="folder-row-link"
              onDoubleClick={() => launch(child, node.path)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  launch(child, node.path);
                }
              }}
              onMouseEnter={() => prefetchBody(child)}
              onFocus={() => prefetchBody(child)}
            >
              <span className="folder-col-name">
                {child.name}
                {markerOf(child)}
              </span>
              <span className="folder-col-title">{child.title}</span>
              {child.strip && <span className="folder-col-spec">{child.strip}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
