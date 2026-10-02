// The shell's zustand store: layout surface, window state, toasts, and effects. zustand is
// used because R3F already depends on it and `useFrame` can read it without a re-render.

import { create } from 'zustand';
import type { FsTree } from '~/fs/types';
import type { Rect, SnapZone } from './wm/geometry';

/** One open window. `id` equals `path`, since each node opens at most one window.
 * `restoreRect` is the pre-snap geometry restored when the window is dragged free. */
export interface ShellWindow {
  id: string;
  path: string;
  rect: Rect;
  z: number;
  minimised: boolean;
  snapped?: SnapZone;
  restoreRect?: Rect;
  /** The id of the window that opened this one; focus returns to it on close if still open. */
  opener?: string;
}

/** One kill-feed toast. `id` is a unique counter value, since several toasts can share a
 * `label`. */
export interface Toast {
  id: number;
  label: string;
  value?: string;
  /** Drawn as a centred full-viewport banner instead of a corner toast. */
  splash?: boolean;
}

/**
 * Session-only visual effects state; never persisted, so it resets on reload.
 * `armed` is set by the terminal's `arm`/`disarm`, `gridTint` by the Konami code and read
 * by the WebGL grid, and `vector` is written by the scene layer and read by the taskbar's
 * `VEC` gauge.
 */
export interface EffectsState {
  armed: boolean;
  gridTint: 'blue' | 'amber';
  vector: 'running' | 'standby';
}

/** Where focus should land after `close()` removes a window: the opener if still open, else
 * the taskbar button of the top window, else the first desktop icon. The store has no DOM
 * access, so the UI layer resolves this into a `.focus()` call. */
export type FocusTarget =
  { type: 'window'; id: string } | { type: 'taskbar'; id: string } | { type: 'icon' };

/** A new window's placeholder geometry, replaced by the caller's follow-up `setRect`. */
const DEFAULT_RECT: Rect = { x: 40, y: 40, width: 400, height: 300 };

interface ShellState {
  /** Which surface currently owns `/`. Written only by `Shell.tsx`, on mount and on every
   * live breakpoint swap. */
  surface: 'shell' | 'linear';
  setSurface: (surface: 'shell' | 'linear') => void;

  /** The `FsTree` the island receives as props, held here so any component can read it. */
  tree: FsTree | null;
  setTree: (tree: FsTree) => void;

  /** The build-time drone SVG and HUD readout shown by `viewer.exe` without WebGL, so the
   * fallback needs no three import. Empty until `Shell.tsx` sets them. */
  droneFallback: { svg: string; readout: string };
  setDroneFallback: (fallback: { svg: string; readout: string }) => void;

  /** The latest message for the shared `role="status"` region that `Shell.tsx` renders. */
  lastAnnouncement: string;
  announce: (message: string) => void;

  /** Every open window in the order it was opened. The order never changes after insertion
   * so the DOM order is stable; stacking lives on each window's `z`. */
  windows: ShellWindow[];
  /** The focused window's id, or `null` when none is focused. */
  focusedId: string | null;
  /** The z counter that `raise`, `focus`, and `open` draw from; the top window has the
   * highest z ever assigned. */
  zCounter: number;

  /** Opens `path` at `DEFAULT_RECT` and focuses it, or raises and focuses the existing
   * window if `path` is already open. `opener` is recorded for `close()`'s focus return. */
  open: (path: string, opener?: string) => void;
  /** Removes the window and returns where focus should go next: the opener if still open,
   * else the highest-z remaining window's taskbar button, else the first desktop icon. The
   * caller performs the actual `.focus()`. */
  close: (id: string) => FocusTarget;
  /** Raises `id` above every other window and marks it focused. */
  focus: (id: string) => void;
  minimise: (id: string) => void;
  restore: (id: string) => void;
  toggleMinimised: (id: string) => void;
  setRect: (id: string, rect: Rect) => void;
  /** Tiles `id` to `zone` at `rect`, saving its current geometry in `restoreRect`. */
  snap: (id: string, zone: SnapZone, rect: Rect) => void;
  /** Clears the snapped state, e.g. when a snapped window is dragged free. */
  unsnap: (id: string) => void;
  /** Raises `id` above every other window without changing focus or array order. */
  raise: (id: string) => void;
  /** Appends `win` verbatim, as restored from `vos:layout`; unlike `open()`, it does not
   * default the rect or assign a new `z`. Keeps `zCounter` at or above the highest `z`. */
  restoreWindow: (win: ShellWindow) => void;
  /** Sets `focusedId` without raising, unlike `focus()`, which would disturb a restored
   * z-order. */
  setFocused: (id: string | null) => void;

  /** Each open window's body scroll position, keyed by window id. Kept apart from
   * `ShellWindow` because it changes on every scroll but is persisted only by the debounced
   * and `pagehide` writes. */
  bodyScroll: Record<string, number>;
  setBodyScroll: (id: string, scrollTop: number) => void;
  /** Scroll positions restored from `vos:layout`, keyed by window id, held until each
   * window's body has loaded. `ContentWindow.tsx` and `FolderWindow.tsx` consume their own
   * entry via `consumePendingScroll`, which returns `undefined` when there is none. */
  pendingScroll: Record<string, number>;
  setPendingScroll: (scroll: Record<string, number>) => void;
  consumePendingScroll: (id: string) => number | undefined;

  /** The kill-feed toast stack, showing at most `MAX_TOASTS`; a new arrival beyond that
   * drops the oldest. Each toast is also sent to the status region via `announce()`. */
  toasts: Toast[];
  toast: (label: string, value?: string, splash?: boolean) => void;
  dismissToast: (id: number) => void;

  /** Session-only visual effects state. */
  effects: EffectsState;
  setEffects: (patch: Partial<EffectsState>) => void;
}

/** Source of toast ids; a counter rather than `Date.now()`, since several toasts can fire
 * in the same millisecond. */
let nextToastId = 0;

/** How long a toast stays visible before auto-dismissing. */
const TOAST_LIFETIME_MS = 4000;

/** How long a splash toast stays up; `Toasts.tsx`'s splash animation runs for the same time. */
export const SPLASH_LIFETIME_MS = 3000;

/** The cap on simultaneously visible toasts. */
const MAX_TOASTS = 4;

export const useShellStore = create<ShellState>((set, get) => ({
  surface: 'linear',
  setSurface: (surface) => set({ surface }),

  tree: null,
  setTree: (tree) => set({ tree }),

  droneFallback: { svg: '', readout: '' },
  setDroneFallback: (droneFallback) => set({ droneFallback }),

  lastAnnouncement: '',
  announce: (message) => set({ lastAnnouncement: message }),

  windows: [],
  focusedId: null,
  zCounter: 0,

  open: (path, opener) => {
    const existing = get().windows.find((w) => w.id === path);
    if (existing) {
      get().focus(path);
      return;
    }
    const z = get().zCounter + 1;
    const win: ShellWindow = {
      id: path,
      path,
      rect: DEFAULT_RECT,
      z,
      minimised: false,
      // `exactOptionalPropertyTypes`: an absent opener must be an absent key, not an
      // explicit `undefined` value.
      ...(opener !== undefined ? { opener } : {}),
    };
    set((state) => ({
      windows: [...state.windows, win],
      zCounter: z,
      focusedId: path,
    }));
  },

  close: (id) => {
    const { windows } = get();
    const closed = windows.find((w) => w.id === id);
    const remaining = windows.filter((w) => w.id !== id);

    let target: FocusTarget;
    let focusedId: string | null;
    if (closed?.opener && remaining.some((w) => w.id === closed.opener)) {
      target = { type: 'window', id: closed.opener };
      focusedId = closed.opener;
    } else if (remaining.length > 0) {
      const next = remaining.reduce((top, w) => (w.z > top.z ? w : top));
      target = { type: 'taskbar', id: next.id };
      focusedId = next.id;
    } else {
      target = { type: 'icon' };
      focusedId = null;
    }

    set({ windows: remaining, focusedId });
    return target;
  },

  focus: (id) => {
    get().raise(id);
    set({ focusedId: id });
  },

  minimise: (id) =>
    set((state) => ({
      windows: state.windows.map((w) => (w.id === id ? { ...w, minimised: true } : w)),
    })),

  restore: (id) =>
    set((state) => ({
      windows: state.windows.map((w) => (w.id === id ? { ...w, minimised: false } : w)),
    })),

  toggleMinimised: (id) =>
    set((state) => ({
      windows: state.windows.map((w) => (w.id === id ? { ...w, minimised: !w.minimised } : w)),
    })),

  setRect: (id, rect) =>
    set((state) => ({
      windows: state.windows.map((w) => (w.id === id ? { ...w, rect } : w)),
    })),

  snap: (id, zone, rect) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, snapped: zone, restoreRect: w.rect, rect } : w,
      ),
    })),

  unsnap: (id) =>
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== id) return w;
        // `exactOptionalPropertyTypes`: clear by dropping the keys, not setting `undefined`.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarded on purpose
        const { snapped, restoreRect, ...rest } = w;
        return rest;
      }),
    })),

  raise: (id) =>
    set((state) => {
      const z = state.zCounter + 1;
      return {
        zCounter: z,
        windows: state.windows.map((w) => (w.id === id ? { ...w, z } : w)),
      };
    }),

  restoreWindow: (win) =>
    set((state) => ({
      windows: [...state.windows, win],
      zCounter: Math.max(state.zCounter, win.z),
    })),

  setFocused: (id) => set({ focusedId: id }),

  bodyScroll: {},
  setBodyScroll: (id, scrollTop) =>
    set((state) => ({ bodyScroll: { ...state.bodyScroll, [id]: scrollTop } })),

  pendingScroll: {},
  setPendingScroll: (scroll) => set({ pendingScroll: scroll }),
  consumePendingScroll: (id) => {
    const value = get().pendingScroll[id];
    if (value === undefined) return undefined;
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarded on purpose
      const { [id]: _consumed, ...rest } = state.pendingScroll;
      return { pendingScroll: rest };
    });
    return value;
  },

  toasts: [],
  toast: (label, value, splash) => {
    const id = ++nextToastId;
    set((state) => {
      const next = [
        ...state.toasts,
        {
          id,
          ...(value !== undefined ? { value } : {}),
          ...(splash ? { splash } : {}),
          label,
        },
      ];
      return { toasts: next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next };
    });
    get().announce(value ? `${label}: ${value}` : label);
    setTimeout(() => get().dismissToast(id), splash ? SPLASH_LIFETIME_MS : TOAST_LIFETIME_MS);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  effects: { armed: false, gridTint: 'blue', vector: 'standby' },
  setEffects: (patch) => set((state) => ({ effects: { ...state.effects, ...patch } })),
}));
