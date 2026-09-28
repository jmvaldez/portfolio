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
import type { FsNode } from '~/fs/types';

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
      if (opener !== undefined) useShellStore.getState().open(node.path, opener);
      else useShellStore.getState().open(node.path);
      return;

    case 'app':
      // Not launchable at all unless it's a registered key (ticket 05, D16's own
      // seed-skipping rule generalised to every launch site, not just the seed).
      // `DesktopIcons`/`Taskbar` never render a launcher for one of these to begin
      // with — reaching this branch with an unregistered app means some other caller
      // (Phase 11's terminal `open`) tried to open something that isn't wired up.
      if (node.app === undefined || !(node.app in appRegistry)) return;
      if (opener !== undefined) useShellStore.getState().open(node.path, opener);
      else useShellStore.getState().open(node.path);
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
