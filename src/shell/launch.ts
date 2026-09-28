// The launch decision layer. Every entry point that opens something (desktop icon, taskbar
// launcher, folder row, terminal `open`) goes through `launch`, so whether a node can be
// opened is decided in one place. It only decides whether to open a window, download, or
// refuse; what renders inside the window is `windows/WindowBody.tsx`'s decision.
import { appRegistry } from './apps/registry';
import { useShellStore } from './store';
import { rescue } from './wm/geometry';
import type { FsNode } from '~/fs/types';

/** A launched window's size as a fraction of the desktop, clamped to the min and max so it
 * is readable on a small desktop and not sprawling on a large one. */
const LAUNCH_W = 0.42;
const LAUNCH_H = 0.62;
const LAUNCH_MIN = { width: 420, height: 320 };
const LAUNCH_MAX = { width: 900, height: 720 };
/** Offset applied per open window so launches cascade instead of stacking exactly. */
const CASCADE_STEP = 28;
const CASCADE_WRAP = 6;

/** Opens `path` and gives a newly opened window desktop-relative geometry, since
 * `store.open()` uses a placeholder rect. An already-open window is only raised. */
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

/**
 * Opens, focuses, or downloads `node` depending on its kind. Does nothing for an `app` node
 * that isn't registered.
 *
 * `opener` is the id of the window that triggered the launch, used to return focus when the
 * new window closes; omit it when no window triggered it (desktop icon, taskbar launcher).
 */
export function launch(node: FsNode, opener?: string): void {
  switch (node.kind) {
    case 'dir':
    case 'file':
    case 'text':
      openSized(node.path, opener);
      return;

    case 'app':
      // The icons and launchers never render for an unregistered app, so reaching this
      // with one means another caller (the terminal's `open`) tried it.
      if (node.app === undefined || !(node.app in appRegistry)) return;
      openSized(node.path, opener);
      return;

    case 'link': {
      // Never a window or a navigation of the current document: click a temporary,
      // invisible link and discard it.
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
