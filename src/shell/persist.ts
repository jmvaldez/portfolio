// The `vos:layout` round trip: serialising window state, debounced and `pagehide` writes,
// and restoring windows into the store. Storage is `sessionStorage` only, via
// `readLayout`/`writeLayout` in `src/lib/storage.ts`.
import { appRegistry } from './apps/registry';
import { rescue, type Rect, type SnapZone } from './wm/geometry';
import { useShellStore, type ShellWindow } from './store';
import { readLayout, writeLayout, type StoredLayout } from '~/lib/storage';
import type { FsTree } from '~/fs/types';

/** How long a burst of changes (drag, resize) waits before being written. */
const DEBOUNCE_MS = 150;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function toStoredRect(rect: Rect): { x: number; y: number; w: number; h: number } {
  return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
}

function toRect(stored: { x: number; y: number; w: number; h: number }): Rect {
  return { x: stored.x, y: stored.y, width: stored.w, height: stored.h };
}

/** Builds a `StoredLayout` from the store's live window state. Stored rects use `w`/`h`
 * where `Rect` uses `width`/`height`; this is where the two are mapped. */
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

/** Writes the layout after a `DEBOUNCE_MS` pause, restarting the wait on each call. */
export function persistLayout(): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    writeLayout(serializeLayout());
  }, DEBOUNCE_MS);
}

/** Cancels any pending debounced write and writes the layout immediately. */
export function persistLayoutSync(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  writeLayout(serializeLayout());
}

/** Returns the stored layout, or `null` if none exists or it is malformed. */
export function restoreLayout(): StoredLayout | null {
  return readLayout();
}

/**
 * Restores `stored`'s windows into the store, clamping their rects to `desktopSize`. Windows
 * whose node no longer exists or whose app is no longer registered are skipped, since both
 * can change between sessions.
 */
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

/** Persists the layout on every windows-related store change and on `pagehide`. Returns a
 * cleanup that removes both. */
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
