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
/** Not one of D13's originally-enumerated keys — added by Phase 11 for ticket 08/10's
 * motd rule: printed on "a session's first open" of the terminal and never again,
 * including across a reload that restores an already-open terminal from `vos:layout`
 * (ticket 14: "not announced, because the terminal opens unfocused" implies it's still
 * in the log from the start on that first open, but absent on every later one).
 * `sessionStorage` is exactly "session" scope, same reasoning as `BOOTED_KEY`. */
export const TERMINAL_MOTD_KEY = 'vos:terminal-motd';

/** How many typed commands `vos:history` keeps (ticket 08 § Keys: "last 100
 * commands"). */
const HISTORY_LIMIT = 100;

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

/** Whether the terminal's motd (`valdez-os 1.0 · type 'help'`) has already printed
 * this session — the session's very first terminal open, and never again, including
 * across a reload that restores an already-open terminal (ticket 08, ticket 10 §
 * "The terminal's motd"). */
export function hasShownTerminalMotd(): boolean {
  try {
    return sessionStorage.getItem(TERMINAL_MOTD_KEY) === '1';
  } catch {
    return false;
  }
}

export function setTerminalMotdShown(): void {
  try {
    sessionStorage.setItem(TERMINAL_MOTD_KEY, '1');
  } catch {
    // Private browsing etc.: the motd may reprint on the next open, the safe fallback.
  }
}

/** Safe read of `vos:history` (ticket 08 § Keys: "kept in sessionStorage alongside
 * the window layout"). Returns `[]` on a missing, malformed, or inaccessible entry. */
export function readHistory(): string[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

/** Appends `line` to `vos:history`, capped at the last `HISTORY_LIMIT` entries. A
 * throw (quota, private browsing) is dropped rather than surfaced, same as every
 * other write in this file. */
export function appendHistory(line: string): void {
  try {
    const next = [...readHistory(), line].slice(-HISTORY_LIMIT);
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Dropping the write is the safe fallback: history just doesn't grow this time.
  }
}
