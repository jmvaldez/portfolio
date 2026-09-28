// The shell's state store (D17: zustand — R3F 9 already depends on it, and
// `useFrame` can read it without a re-render). Kept deliberately minimal for Phase 8:
// just what the readiness handshake and the live breakpoint swap need. Phase 9 adds a
// window-geometry/z-order slice here, Phase 10 adds taskbar/gauge state; this file is
// where those slices land, not a second store next to it.

import { create } from 'zustand';
import type { FsTree } from '~/fs/types';
import type { Rect, SnapZone } from './wm/geometry';

/** One open window (ticket 04, ticket 14 § Z-order never reorders the DOM). `id` is
 * just `path` — single-instance-per-node (ticket 04) makes the node's own path the
 * natural unique key, so `open()`'s "is this node already open" check is a single
 * array search rather than a second index. `restoreRect` is the pre-snap geometry
 * `tearOff` (Task 9.3) needs when the window is dragged free again. */
export interface ShellWindow {
  id: string;
  path: string;
  rect: Rect;
  z: number;
  minimised: boolean;
  snapped?: SnapZone;
  restoreRect?: Rect;
  /** The id (path) of whatever opened this window — a desktop icon, a taskbar
   * launcher, another window, the terminal's `open` — kept for ticket 14's
   * focus-on-close priority: the opener, if it's still open, is the first place
   * focus returns to. */
  opener?: string;
}

/** Where focus should land after `close()` removes a window (ticket 14 § Focus and
 * the window lifecycle): the opener if it's still open, else the taskbar button of
 * the window that is now on top, else the first desktop icon. `close()` can't call
 * `.focus()` itself — that's a real DOM element only the UI layer (Task 9.3) has —
 * so it returns this descriptor for the caller to resolve. */
export type FocusTarget =
  { type: 'window'; id: string } | { type: 'taskbar'; id: string } | { type: 'icon' };

/** A new window's geometry before Task 9.3's seeding (or the terminal's `open`) sets
 * its real rect with `setRect`. Arbitrary but harmless: nothing renders at this rect
 * for more than the one tick between `open()` and the caller's follow-up `setRect`. */
const DEFAULT_RECT: Rect = { x: 40, y: 40, width: 400, height: 300 };

interface ShellState {
  /** Which surface currently owns `/`. `Shell.tsx` is the only writer — set once on
   * mount and again on every live breakpoint swap (ticket 11 § Crossing it
   * mid-session). */
  surface: 'shell' | 'linear';
  setSurface: (surface: 'shell' | 'linear') => void;

  /** The `FsTree` the island receives as serialised props (D9). Held here so Phase
   * 9/10's window manager and taskbar can read it without every component re-deriving
   * it from `Shell`'s own props. */
  tree: FsTree | null;
  setTree: (tree: FsTree) => void;

  /** The most recent message for the one shared `role="status"` region
   * (`Desktop.tsx` renders it): boot-ready and live-swap announcements now
   * (ticket 14 § Boot and resume, § Live swap), toasts in later phases
   * (ticket 14 § Terminal: "one shared role=status region"). */
  lastAnnouncement: string;
  announce: (message: string) => void;

  /** Every open window, in the order it was opened (ticket 14: "windows sit in the
   * DOM in the order they were opened" — this array *is* that order, and it never
   * reorders after insertion). Z-order lives on each window's own `z`, not on array
   * position. */
  windows: ShellWindow[];
  /** Currently-focused window's id, or `null` when nothing is (e.g. right after the
   * last window closes). */
  focusedId: string | null;
  /** The running z counter `raise`/`focus`/`open` all draw from, so "on top" always
   * means "highest z ever assigned", never a recomputed max. */
  zCounter: number;

  /** Opens `path` at `DEFAULT_RECT` and focuses it. Single instance per node (ticket
   * 04): if `path` is already open, this raises and focuses the existing window
   * instead of creating a second one. `opener` is bookkeeping for `close()`'s
   * focus-return priority (ticket 14), not looked at otherwise. */
  open: (path: string, opener?: string) => void;
  /** Removes the window and returns where focus should go next (ticket 14): the
   * opener if it's still open, else the taskbar button of the window that is now
   * highest-z among what's left, else the first desktop icon. Does not itself call
   * `.focus()` — the caller (Task 9.3) resolves the descriptor into a real DOM
   * focus call. */
  close: (id: string) => FocusTarget;
  /** Raises `id` above every other window and marks it focused. */
  focus: (id: string) => void;
  minimise: (id: string) => void;
  restore: (id: string) => void;
  toggleMinimised: (id: string) => void;
  setRect: (id: string, rect: Rect) => void;
  /** Marks `id` as tiled to `zone` at `rect`, remembering its current geometry in
   * `restoreRect` so a later `tearOff` (Task 9.3) knows what to restore. */
  snap: (id: string, zone: SnapZone, rect: Rect) => void;
  /** Clears the snapped state — used when a snapped window is torn free by drag. */
  unsnap: (id: string) => void;
  /** Bumps `id`'s `z` above every other window, without touching focus or array
   * order. `focus()` calls this; exposed on its own for callers (e.g. a click that
   * shouldn't move keyboard focus) that only want the stacking change. */
  raise: (id: string) => void;
}

export const useShellStore = create<ShellState>((set, get) => ({
  surface: 'linear',
  setSurface: (surface) => set({ surface }),

  tree: null,
  setTree: (tree) => set({ tree }),

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
        // `exactOptionalPropertyTypes`: clearing means dropping the keys, not
        // setting them to an explicit `undefined`.
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
}));
