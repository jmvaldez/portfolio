import { beforeEach, describe, expect, it } from 'vitest';
import { useShellStore } from '../store';

// zustand's own recommended test pattern for a module-level store: snapshot the
// store's initial state once, then reset to it before each test rather than
// reconstructing a fresh store per test (the store is a singleton — `Shell.tsx`
// imports the same `useShellStore` this file does, per D17).
const INITIAL_STATE = useShellStore.getState();

beforeEach(() => {
  useShellStore.setState(INITIAL_STATE, true);
});

function findWindow(id: string) {
  return useShellStore.getState().windows.find((w) => w.id === id);
}

describe('open', () => {
  it('appends a new window and focuses it', () => {
    useShellStore.getState().open('/about.txt');
    const { windows, focusedId } = useShellStore.getState();
    expect(windows).toHaveLength(1);
    const about = windows.find((w) => w.id === '/about.txt');
    expect(about?.id).toBe('/about.txt');
    expect(about?.path).toBe('/about.txt');
    expect(about?.minimised).toBe(false);
    expect(focusedId).toBe('/about.txt');
  });

  it('raises and focuses an already-open window instead of duplicating it', () => {
    useShellStore.getState().open('/about.txt');
    useShellStore.getState().open('/projects');
    const zBefore = useShellStore.getState().windows.find((w) => w.id === '/about.txt')?.z;

    useShellStore.getState().open('/about.txt');

    const { windows, focusedId } = useShellStore.getState();
    expect(windows).toHaveLength(2); // no duplicate
    const about = windows.find((w) => w.id === '/about.txt');
    expect(about?.z).toBeGreaterThan(zBefore ?? 0);
    expect(focusedId).toBe('/about.txt');
  });

  it('records the opener for focus-return bookkeeping', () => {
    useShellStore.getState().open('/projects', '/about.txt');
    const win = useShellStore.getState().windows.find((w) => w.id === '/projects');
    expect(win?.opener).toBe('/about.txt');
  });
});

describe('raise', () => {
  it('changes z but never reorders the underlying windows array', () => {
    useShellStore.getState().open('/about.txt');
    useShellStore.getState().open('/projects');
    useShellStore.getState().open('/viewer.exe');

    const idsBefore = useShellStore.getState().windows.map((w) => w.id);
    useShellStore.getState().raise('/about.txt'); // back window comes to front by z only

    const state = useShellStore.getState();
    const idsAfter = state.windows.map((w) => w.id);
    expect(idsAfter).toEqual(idsBefore); // array (open) order unchanged

    const about = state.windows.find((w) => w.id === '/about.txt')!;
    const highestOther = Math.max(
      ...state.windows.filter((w) => w.id !== '/about.txt').map((w) => w.z),
    );
    expect(about.z).toBeGreaterThan(highestOther);
  });
});

describe('close', () => {
  it('removes the window from the array', () => {
    useShellStore.getState().open('/about.txt');
    useShellStore.getState().open('/projects');

    useShellStore.getState().close('/about.txt');

    const { windows } = useShellStore.getState();
    expect(windows).toHaveLength(1);
    expect(windows.find((w) => w.id === '/projects')).toBeDefined();
  });

  it('focuses the opener when it is still open', () => {
    useShellStore.getState().open('/about.txt');
    useShellStore.getState().open('/projects', '/about.txt');

    const target = useShellStore.getState().close('/projects');

    expect(target).toEqual({ type: 'window', id: '/about.txt' });
  });

  it('falls back to the taskbar button of the next-highest-z window when the opener is gone', () => {
    useShellStore.getState().open('/about.txt');
    useShellStore.getState().open('/projects');
    useShellStore.getState().open('/viewer.exe', '/about.txt');
    // The opener ('/about.txt') closes first, so it's gone by the time '/viewer.exe' closes.
    useShellStore.getState().close('/about.txt');

    const target = useShellStore.getState().close('/viewer.exe');

    // Only '/projects' remains, so it's both highest-z and the fallback target.
    expect(target).toEqual({ type: 'taskbar', id: '/projects' });
  });

  it('falls back to the taskbar button of the next-highest-z window with no opener at all', () => {
    useShellStore.getState().open('/about.txt');
    useShellStore.getState().open('/projects');
    useShellStore.getState().open('/viewer.exe');
    // '/viewer.exe' is currently highest-z; raise '/projects' above it so the
    // "next" window is genuinely the second-highest, not just whatever is left.
    useShellStore.getState().raise('/projects');

    const target = useShellStore.getState().close('/viewer.exe');

    expect(target).toEqual({ type: 'taskbar', id: '/projects' });
  });

  it('falls back to a desktop icon once no windows remain', () => {
    useShellStore.getState().open('/about.txt');

    const target = useShellStore.getState().close('/about.txt');

    expect(target).toEqual({ type: 'icon' });
    expect(useShellStore.getState().windows).toHaveLength(0);
  });
});

describe('minimise / restore / toggleMinimised', () => {
  it('sets and clears the minimised flag', () => {
    useShellStore.getState().open('/about.txt');
    useShellStore.getState().minimise('/about.txt');
    expect(findWindow('/about.txt')?.minimised).toBe(true);

    useShellStore.getState().restore('/about.txt');
    expect(findWindow('/about.txt')?.minimised).toBe(false);
  });

  it('toggles', () => {
    useShellStore.getState().open('/about.txt');
    useShellStore.getState().toggleMinimised('/about.txt');
    expect(findWindow('/about.txt')?.minimised).toBe(true);
    useShellStore.getState().toggleMinimised('/about.txt');
    expect(findWindow('/about.txt')?.minimised).toBe(false);
  });
});

describe('setRect / snap / unsnap', () => {
  it('setRect replaces the rect', () => {
    useShellStore.getState().open('/about.txt');
    const rect = { x: 10, y: 20, width: 300, height: 200 };
    useShellStore.getState().setRect('/about.txt', rect);
    expect(findWindow('/about.txt')?.rect).toEqual(rect);
  });

  it('snap records the zone and rect, remembering the pre-snap geometry', () => {
    useShellStore.getState().open('/about.txt');
    const original = findWindow('/about.txt')?.rect;
    const tiled = { x: 0, y: 0, width: 600, height: 800 };

    useShellStore.getState().snap('/about.txt', 'left', tiled);

    const win = findWindow('/about.txt');
    expect(win?.snapped).toBe('left');
    expect(win?.rect).toEqual(tiled);
    expect(win?.restoreRect).toEqual(original);
  });

  it('unsnap clears the snapped state', () => {
    useShellStore.getState().open('/about.txt');
    useShellStore.getState().snap('/about.txt', 'top', { x: 0, y: 0, width: 1, height: 1 });

    useShellStore.getState().unsnap('/about.txt');

    const win = findWindow('/about.txt');
    expect(win?.snapped).toBeUndefined();
    expect(win?.restoreRect).toBeUndefined();
  });
});
