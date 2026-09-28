// The `vos:layout` round trip (ticket 09 § State across the round trip, D13, Task
// 10.3): serialising the store's window state into `StoredLayout`'s shape,
// debounced writes, a synchronous write for `pagehide`, and reconstructing a
// restored session's windows back into the store. Nothing here ever touches
// `localStorage` — `readLayout`/`writeLayout` (`src/lib/storage.ts`) are
// `sessionStorage` only (ticket 04, narrowed by 09).
import { appRegistry } from './apps/registry';
import { rescue, type Rect, type SnapZone } from './wm/geometry';
import { useShellStore, type ShellWindow } from './store';
import { readLayout, writeLayout, type StoredLayout } from '~/lib/storage';
import type { FsTree } from '~/fs/types';

/** How long a burst of geometry changes (drag, resize) waits before it's actually
 * written (Task 10.3: "DEBOUNCED at 150ms so rapid drag/resize doesn't write on
 * every frame"). */
const DEBOUNCE_MS = 150;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function toStoredRect(rect: Rect): { x: number; y: number; w: number; h: number } {
  return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
}

function toRect(stored: { x: number; y: number; w: number; h: number }): Rect {
  return { x: stored.x, y: stored.y, width: stored.w, height: stored.h };
}

/** Builds `StoredLayout` from the store's live window state (Task 10.3). Field
 * names deliberately differ from `Rect`'s own (`x,y,w,h` vs. `x,y,width,height`) —
 * `StoredLayout` is Phase 8's shape and this is the one place that maps between
 * the two. */
export function serializeLayout(): StoredLayout {
  const { windows, focusedId, bodyScroll } = useShellStore.getState();

  return {
    v: 1,
    windows: windows.map((win) => {
      const scroll = bodyScroll[win.id];
      return {
        path: win.path,
        ...toStoredRect(win.rect),
        z: win.z,
        minimised: win.minimised,
        ...(win.snapped ? { snapped: win.snapped } : {}),
        ...(win.restoreRect ? { restore: toStoredRect(win.restoreRect) } : {}),
        ...(scroll !== undefined ? { scroll } : {}),
      };
    }),
    ...(focusedId ? { focus: focusedId } : {}),
  };
}

/** The debounced write every committed geometry/window-state change goes through
 * (Task 10.3, wired from `initPersistence`'s store subscription). */
export function persistLayout(): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    writeLayout(serializeLayout());
  }, DEBOUNCE_MS);
}

/** The undebounced write for `pagehide` (Task 10.3): the page may be gone before a
 * pending debounced write ever fires, so this cancels it and writes immediately. */
export function persistLayoutSync(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  writeLayout(serializeLayout());
}

/** Reads back `vos:layout`, or `null` if there's nothing valid to restore
 * (`readLayout` already treats a malformed entry the same as no entry). */
export function restoreLayout(): StoredLayout | null {
  return readLayout();
}

/** Reconstructs a restored session's windows into the store (Task 10.3, called from
 * `Desktop.tsx`'s seed/restore effect once the desktop has a real size to rescue
 * against). A stored path whose node no longer exists, or whose `app` is no longer
 * registered, is skipped rather than opened half-broken — the filesystem and the
 * app registry can both change between sessions, and `vos:layout` is a cache of a
 * shape, not a guarantee. */
export function applyStoredLayout(
  stored: StoredLayout,
  tree: FsTree,
  desktopSize: { width: number; height: number },
): void {
  const store = useShellStore.getState();
  const pendingScroll: Record<string, number> = {};

  for (const win of stored.windows) {
    const node = tree[win.path];
    if (!node) continue; // the node this path pointed to is gone
    if (node.kind === 'app' && (node.app === undefined || !(node.app in appRegistry))) continue;

    const restored: ShellWindow = {
      id: win.path,
      path: win.path,
      rect: rescue(toRect(win), desktopSize),
      z: win.z,
      minimised: win.minimised,
      ...(win.snapped ? { snapped: win.snapped as SnapZone } : {}),
      ...(win.restore ? { restoreRect: rescue(toRect(win.restore), desktopSize) } : {}),
    };
    store.restoreWindow(restored);
    if (win.scroll !== undefined) pendingScroll[win.path] = win.scroll;
  }

  store.setPendingScroll(pendingScroll);
  if (stored.focus && tree[stored.focus]) store.setFocused(stored.focus);
}

/** Wires the debounced persist to every committed windows-related change, and the
 * synchronous persist to `pagehide` (Task 10.3). Called once from `Desktop.tsx`'s
 * top-level mount effect; the returned cleanup un-wires both, so a narrow/widen
 * remount never accumulates duplicate subscriptions or listeners. */
export function initPersistence(): () => void {
  const unsubscribe = useShellStore.subscribe((state, prevState) => {
    if (
      state.windows !== prevState.windows ||
      state.focusedId !== prevState.focusedId ||
      state.bodyScroll !== prevState.bodyScroll
    ) {
      persistLayout();
    }
  });

  function handlePageHide(): void {
    persistLayoutSync();
  }
  window.addEventListener('pagehide', handlePageHide);

  return () => {
    unsubscribe();
    window.removeEventListener('pagehide', handlePageHide);
  };
}
