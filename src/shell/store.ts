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

/** One kill-feed toast (ticket 06 § gauges/HUD layer, ticket 14 § Terminal: "toasts
 * ... all go through one shared role=status region"). `id` is a monotonically
 * increasing counter, not the window/node path — a toast has no natural key of its
 * own, and several can carry the same `label` (e.g. two Konami attempts). */
export interface Toast {
  id: number;
  label: string;
  value?: string;
}

/** Task 10.4's effects slice, shared with Phases 11 and 12: session-only, never
 * written to `sessionStorage`/`localStorage` (unlike `windows`) — it resets on
 * reload same as any other in-memory `useState` would. `armed` and `vector` are
 * Phase 11's terminal easter eggs (`arm`/`disarm`); `gridTint` is the Konami code
 * here in Phase 10, read by Phase 12's WebGL grid. */
export interface EffectsState {
  armed: boolean;
  gridTint: 'blue' | 'amber';
  vector: 'running' | 'standby';
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
  /** Restores a window exactly as `persist.ts`'s `applyStoredLayout` (Task 10.3)
   * reconstructs it from `vos:layout` — unlike `open()`, this never defaults the
   * rect or bumps `z` relative to whatever's already open. The caller has already
   * rescued the rect for the current viewport and resolved whether the underlying
   * app is still registered; this just appends it verbatim and keeps `zCounter`
   * ahead of the highest restored `z` so a later `raise()` still wins. */
  restoreWindow: (win: ShellWindow) => void;
  /** Sets `focusedId` directly, with no raise — `open()`/`focus()` always raise the
   * window they focus, which is wrong for restoring a whole session's z-order in one
   * pass (Task 10.3): the stored `focus` id's `z` is already exactly what it was
   * when the session was saved. */
  setFocused: (id: string | null) => void;

  /** Each open window's current body scroll position, keyed by window id (Task
   * 10.3 § body scroll persistence). Lives here rather than on `ShellWindow` itself
   * since it's read continuously (every scroll) but only ever written to storage on
   * the debounced/`pagehide` persist pass, not on every store update. */
  bodyScroll: Record<string, number>;
  setBodyScroll: (id: string, scrollTop: number) => void;
  /** Scroll positions read back from `vos:layout` on restore, keyed by window id,
   * waiting for that window's body to finish loading before they can actually be
   * applied (Task 10.3: "once each window's body has loaded"). `ContentWindow.tsx`
   * and `FolderWindow.tsx` each consume their own entry once their content is ready. */
  pendingScroll: Record<string, number>;
  setPendingScroll: (scroll: Record<string, number>) => void;
  consumePendingScroll: (id: string) => number | undefined;

  /** The kill-feed toast stack (Task 10.4, ticket 06): newest-4-visible — a 5th
   * arrival drops the oldest rather than queuing (ticket 06's "kill-feed" framing:
   * a feed shows what's current, it doesn't hold a backlog). Each toast is also sent
   * to the shared `role="status"` region via `announce()`, so the same text reaches
   * both channels ticket 14 names. */
  toasts: Toast[];
  toast: (label: string, value?: string) => void;
  dismissToast: (id: number) => void;

  /** Task 10.4's session-only effects slice, shared with Phases 11 and 12. */
  effects: EffectsState;
  setEffects: (patch: Partial<EffectsState>) => void;
}

/** Toast ids: a plain module-level counter rather than `Date.now()` — several
 * toasts can legitimately fire within the same millisecond (e.g. rapid-fire
 * easter eggs), and a counter guarantees uniqueness where a timestamp wouldn't. */
let nextToastId = 0;

/** How long a toast stays visible before auto-dismissing (ticket 06 § gauges: the
 * kill-feed style implies a short, fixed lifetime, not a manual dismiss). */
const TOAST_LIFETIME_MS = 4000;

/** The cap on simultaneously visible toasts (Task 10.4: "a MAXIMUM of 4 visible at
 * once... oldest drops off if a 5th arrives"). */
const MAX_TOASTS = 4;

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
  toast: (label, value) => {
    const id = ++nextToastId;
    set((state) => {
      const next = [...state.toasts, { id, ...(value !== undefined ? { value } : {}), label }];
      return { toasts: next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next };
    });
    get().announce(value ? `${label}: ${value}` : label);
    setTimeout(() => get().dismissToast(id), TOAST_LIFETIME_MS);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  effects: { armed: false, gridTint: 'blue', vector: 'standby' },
  setEffects: (patch) => set((state) => ({ effects: { ...state.effects, ...patch } })),
}));
