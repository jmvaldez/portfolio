// A window holding a `dir` node's listing (glossary "Folder window"; ticket 12 §
// Folder pages: "the same template... as the folder window"). Same rows and class
// names as `FolderListing.astro` (D10 order — `node.children` is already sorted that
// way by `buildTree`) — D14: shared verbatim between the Astro and React sides — but
// each row is a `<button>` rather than a link, since inside the shell launching goes
// through `launch()`, never a real navigation.
//
// A single click only focuses/selects the row (native `<button>` behaviour needs no
// code for that); double-click or Enter launches. Space is deliberately not bound
// here (unlike `DesktopIcons.tsx`) — matching typical file-manager row semantics,
// where Space toggles selection rather than opening.
import { useEffect, useRef } from 'react';
import type { FsNode } from '~/fs/types';
import { prefetchBody } from '../bodies';
import { launch } from '../launch';
import { useShellStore } from '../store';

interface Props {
  node: FsNode;
}

/** `ls -F`-style marker: a directory's name gets a trailing slash (D10). */
function markerOf(child: FsNode): string {
  return child.kind === 'dir' ? '/' : '';
}

export default function FolderWindow({ node }: Props) {
  const tree = useShellStore((state) => state.tree);
  const rootRef = useRef<HTMLDivElement>(null);

  const children = (node.children ?? [])
    .map((path) => tree?.[path])
    .filter((child): child is FsNode => child !== undefined);

  // A folder window's listing is available synchronously (it's just `tree`, already
  // in the store) — unlike `ContentWindow`'s fetched body, there's no load state to
  // wait on, so this restores the saved scroll position (Task 10.3) on mount.
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
