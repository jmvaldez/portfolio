// The launch decision layer (ticket 05 § Terminal and desktop surfaces, ticket 09 §
// the shell never mutates the URL, D16). Every entry point that opens something — a
// desktop icon, a taskbar launcher, a folder row, and (Phase 11) the terminal's
// `open` command — goes through this one function, so "can this even be opened" and
// "does opening it look right everywhere" are answered once, not once per call site.
//
// `launch` only decides WHETHER to open a window (via the store's own `open()`,
// Phase 9), trigger a download, or refuse. What renders *inside* the window once it's
// open is a separate decision (`windows/WindowBody.tsx`) — `launch` never imports a
// window component.
import { appRegistry } from './apps/registry';
import { useShellStore } from './store';
import { rescue } from './wm/geometry';
import type { FsNode } from '~/fs/types';

/** A launched window's size, as a fraction of the desktop (the same D16 terms as the
 * seed layout, never fixed pixels), clamped so it opens readable on a small desktop
 * and not sprawling on a large one. */
const LAUNCH_W = 0.42;
const LAUNCH_H = 0.62;
const LAUNCH_MIN = { width: 420, height: 320 };
const LAUNCH_MAX = { width: 900, height: 720 };
/** Each open window offsets the next one by this much, so launches cascade rather
 * than stack exactly on top of each other. */
const CASCADE_STEP = 28;
const CASCADE_WRAP = 6;

/** `store.open()` places a new window at a placeholder rect; this gives a *newly*
 * opened one its real, desktop-relative geometry. An already-open window is only
 * raised — its user-chosen rect is left alone. */
function openSized(path: string, opener: string | undefined): void {
  const store = useShellStore.getState();
  const isNew = !store.windows.some((w) => w.id === path);
  if (opener !== undefined) store.open(path, opener);
  else store.open(path);
  if (!isNew) return;

  const desktop = document.getElementById('desktop')?.getBoundingClientRect();
  if (!desktop || desktop.width === 0) return;
  const width = Math.min(
    LAUNCH_MAX.width,
    Math.max(LAUNCH_MIN.width, desktop.width * LAUNCH_W),
    desktop.width,
  );
  const height = Math.min(
    LAUNCH_MAX.height,
    Math.max(LAUNCH_MIN.height, desktop.height * LAUNCH_H),
    desktop.height,
  );
  const step = ((store.windows.length % CASCADE_WRAP) + 1) * CASCADE_STEP;
  const rect = {
    x: Math.max(0, (desktop.width - width) / 2 - CASCADE_STEP * 2 + step),
    y: Math.max(0, (desktop.height - height) / 3 - CASCADE_STEP * 2 + step),
    width,
    height,
  };
  useShellStore.getState().setRect(path, rescue(rect, desktop));
}

/** Opens, focuses, or downloads `node`, dispatching on `node.kind` (ticket 05's five
 * node kinds). `opener` is the id (path) of whatever triggered the launch — a desktop
 * icon, a folder row's own window, a taskbar launcher — forwarded straight to the
 * store's `open()` for ticket 14's focus-on-close priority. Omit it for a launch with
 * no real "opener" window (a desktop icon, a taskbar launcher). */
export function launch(node: FsNode, opener?: string): void {
  switch (node.kind) {
    case 'dir':
    case 'file':
    case 'text':
      // Rendering differs by kind (`WindowBody.tsx` picks `FolderWindow` vs.
      // `ContentWindow`), but opening the window is identical: single-instance per
      // node, raised if already open (`store.ts`'s own `open()`).
      openSized(node.path, opener);
      return;

    case 'app':
      // Not launchable at all unless it's a registered key (ticket 05, D16's own
      // seed-skipping rule generalised to every launch site, not just the seed).
      // `DesktopIcons`/`Taskbar` never render a launcher for one of these to begin
      // with — reaching this branch with an unregistered app means some other caller
      // (Phase 11's terminal `open`) tried to open something that isn't wired up.
      if (node.app === undefined || !(node.app in appRegistry)) return;
      openSized(node.path, opener);
      return;

    case 'link': {
      // Never a window, never a navigation of the *current* document (ticket 09: the
      // shell never touches the URL) — a temporary, invisible download link, clicked
      // programmatically and discarded.
      const a = document.createElement('a');
      a.href = node.href ?? node.path;
      if (node.download !== undefined) a.download = node.download;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
  }
}
