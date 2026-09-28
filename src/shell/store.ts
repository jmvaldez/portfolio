// The shell's state store (D17: zustand — R3F 9 already depends on it, and
// `useFrame` can read it without a re-render). Kept deliberately minimal for Phase 8:
// just what the readiness handshake and the live breakpoint swap need. Phase 9 adds a
// window-geometry/z-order slice here, Phase 10 adds taskbar/gauge state; this file is
// where those slices land, not a second store next to it.

import { create } from 'zustand';
import type { FsTree } from '~/fs/types';

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
}

export const useShellStore = create<ShellState>((set) => ({
  surface: 'linear',
  setSurface: (surface) => set({ surface }),

  tree: null,
  setTree: (tree) => set({ tree }),

  lastAnnouncement: '',
  announce: (message) => set({ lastAnnouncement: message }),
}));
