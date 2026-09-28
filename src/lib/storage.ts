// The storage contract: two `localStorage` keys (shared across tabs and sessions) and four
// `sessionStorage` keys (per tab). Every accessor swallows storage exceptions, since
// private browsing and storage-disabled contexts can throw on `getItem` and `setItem`,
// and returns a safe fallback instead.
//
// `HeadGate.astro` interpolates the key names into its inline script, which can't import,
// so this file is the one place each literal key is written.

export const CRT_KEY = 'vos:crt';
export const LAYOUT_OVERRIDE_KEY = 'vos:layout-override';
export const BOOTED_KEY = 'vos:booted';
export const LAYOUT_KEY = 'vos:layout';
export const HISTORY_KEY = 'vos:history';
/** Session flag for the terminal's message of the day: printed on a session's first
 * terminal open and never again, even when a reload restores an open terminal. */
export const TERMINAL_MOTD_KEY = 'vos:terminal-motd';

/** How many typed commands `vos:history` keeps. */
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
 * inaccessible entry. */
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

/** Safe write of `vos:layout`. A throw (quota, private browsing) is dropped. */
export function writeLayout(layout: StoredLayout): void {
  try {
    sessionStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // Dropping the write is safe: the session simply re-seeds.
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
 * does not replay it. */
export function setBooted(): void {
  try {
    sessionStorage.setItem(BOOTED_KEY, '1');
  } catch {
    // Private browsing etc.: the boot may replay on reload, which is the safe fallback.
  }
}

/** Whether the visitor chose the linear layout even above the breakpoint
 * (`vos:layout-override`). */
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

/** Whether the terminal's motd has already printed this session. */
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

/** Safe read of `vos:history`. Returns `[]` on a missing, malformed, or inaccessible
 * entry. */
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
 * throw (quota, private browsing) is dropped. */
export function appendHistory(line: string): void {
  try {
    const next = [...readHistory(), line].slice(-HISTORY_LIMIT);
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Dropping the write is the safe fallback: history just doesn't grow this time.
  }
}
