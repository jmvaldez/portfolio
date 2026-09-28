// The D13 storage contract: two `localStorage` keys (survive across tabs and
// sessions) and three `sessionStorage` keys (per tab; a new tab is a new session,
// ticket 10 § Mechanism). Every accessor below swallows storage exceptions —
// private browsing and storage-disabled contexts can throw on both `getItem` and
// `setItem` (same reasoning as `CrtPrefScript`) — and returns a safe fallback
// instead of letting the throw reach the caller.
//
// `HeadGate.astro` interpolates the key names below into its inline script (it
// can't `import` at runtime from an `is:inline` script), so this file stays the one
// place each literal key string is written. Phase 10 is the one that actually
// writes `vos:layout` with real window geometry; the gate here only ever reads it
// to count `windows.length` for the Restore line.

export const CRT_KEY = 'vos:crt';
export const LAYOUT_OVERRIDE_KEY = 'vos:layout-override';
export const BOOTED_KEY = 'vos:booted';
export const LAYOUT_KEY = 'vos:layout';
export const HISTORY_KEY = 'vos:history';

export interface StoredLayout {
  v: 1;
  windows: Array<{
    path: string;
    x: number;
    y: number;
    w: number;
    h: number;
    z: number;
    minimised: boolean;
    snapped?: string;
    restore?: { x: number; y: number; w: number; h: number };
    scroll?: number;
  }>;
  focus?: string;
}

/** Safe read of `vos:layout`. Returns `null` on a missing, malformed, or
 * inaccessible entry — a bad stored shape is treated the same as no layout at all. */
export function readLayout(): StoredLayout | null {
  try {
    const raw = sessionStorage.getItem(LAYOUT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'v' in parsed &&
      'windows' in parsed &&
      parsed.v === 1 &&
      Array.isArray(parsed.windows)
    ) {
      return parsed as StoredLayout;
    }
    return null;
  } catch {
    return null;
  }
}

/** Safe write of `vos:layout`. Phase 10 calls this on every geometry change;
 * a throw (quota, private browsing) is dropped rather than surfaced. */
export function writeLayout(layout: StoredLayout): void {
  try {
    sessionStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // Dropping the write is the safe fallback: the session simply re-seeds.
  }
}

/** Whether the shell has already booted this session (`vos:booted`). */
export function hasBooted(): boolean {
  try {
    return sessionStorage.getItem(BOOTED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Marks the shell as booted for the rest of this session, so a reload mid-boot
 * does not replay it (ticket 10 § Mechanism). */
export function setBooted(): void {
  try {
    sessionStorage.setItem(BOOTED_KEY, '1');
  } catch {
    // Private browsing etc.: the boot may replay on reload, which is the safe fallback.
  }
}

/** The layout override (`vos:layout-override`, ticket 14 § Strategy): a visitor's
 * standing choice of the linear layout even above the breakpoint. */
export function getLayoutOverride(): boolean {
  try {
    return localStorage.getItem(LAYOUT_OVERRIDE_KEY) === 'linear';
  } catch {
    return false;
  }
}

export function setLayoutOverride(on: boolean): void {
  try {
    if (on) {
      localStorage.setItem(LAYOUT_OVERRIDE_KEY, 'linear');
    } else {
      localStorage.removeItem(LAYOUT_OVERRIDE_KEY);
    }
  } catch {
    // Private browsing etc.: the override simply doesn't persist.
  }
}
