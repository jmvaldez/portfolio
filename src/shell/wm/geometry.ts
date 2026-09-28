// Pure geometry for the hand-rolled window manager (ticket 04 § Behaviour, as settled).
// DOM-free on purpose — nothing here touches `document` or `window` — so it can be
// exercised head-on by Vitest and driven from React (`Window.tsx`, Phase 9.3) without
// either side owning the math. Every unit is CSS pixels relative to the desktop rect;
// callers own turning a pointer event into `{ x, y }` and a `#desktop`
// `getBoundingClientRect()` into `{ width, height }`.
//
// Ported from the throwaway prototype's variant B (branch `prototype/window-manager`,
// `snapZone`/`zoneRect`/`magnet`/resize's inline math), generalised into named pure
// functions and given the two behaviours the prototype only sketched: `tearOff` (the
// prototype inlined tear-off into its drag handler) and `rescue` (the prototype's
// `startDrag` clamp, lifted out so it can also run from a `ResizeObserver`, Task 9.4).

/** A window's geometry, in CSS px relative to the desktop's own rect. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The eight resize handles (n/s/e/w edges, plus the four corners). */
export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** The regions a drag can release into (ticket 04: "left and right edges give
 * halves, corners give quarters, the top edge maximises"). There is no plain
 * `'bottom'` zone — the prototype's own `snapZone` never produces one, and ticket 04
 * doesn't ask for a bottom-edge tile. */
export type SnapZone =
  'left' | 'right' | 'top' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** D16's seed layout, expressed as fractions 0-1 of the desktop — never fixed pixels
 * (map Hazards: "a fixed-pixel seed layout is a trap"). */
export interface SeedFraction {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How close a pointer must be to an edge, in px, before it arms a snap zone
 * (ticket 04: "release within 26px of an edge"). */
const EDGE_ZONE = 26;

/** Window-to-window and window-to-desktop-edge magnetism, in px, on each axis
 * independently (ticket 04: "8px window-to-window and window-to-edge, on both
 * axes, while free"). */
const MAGNET = 8;

/** The floor every resize respects (ticket 04 § Shared: "8-way resize (min
 * 200x120)"). */
const MIN_WIDTH = 200;
const MIN_HEIGHT = 120;

/** D14's title-bar height (ticket 06: "30px title bars") and how much of its width
 * `rescue` insists on keeping reachable — "enough to grab", not the whole bar (the
 * prototype's own clamp used the same 80px). This is the floor ticket 04's honest
 * note describes as minimal by design: it repositions, it never resizes, and a
 * badly-shrunk desktop can still leave a window mostly overflowing it. The mobile
 * breakpoint is what actually owns not rendering the shell that small. */
const TITLE_BAR_HEIGHT = 30;
const MIN_VISIBLE_TITLE_WIDTH = 80;

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

/** D16: converts a fraction-of-desktop seed into an absolute-pixel `Rect`. */
export function seedToRect(seed: SeedFraction, desktop: { width: number; height: number }): Rect {
  return {
    x: seed.x * desktop.width,
    y: seed.y * desktop.height,
    width: seed.w * desktop.width,
    height: seed.h * desktop.height,
  };
}

/** Which snap zone a released pointer lands in, or `null` if it's nowhere near an
 * edge. Corner detection takes priority over a plain edge — a pointer within 26px of
 * both the left edge and the top edge is `'top-left'`, never `'left'`. */
export function snapTarget(
  pointer: { x: number; y: number },
  desktop: { width: number; height: number },
): SnapZone | null {
  const nearTop = pointer.y < EDGE_ZONE;
  const nearBottom = pointer.y > desktop.height - EDGE_ZONE;
  const nearLeft = pointer.x < EDGE_ZONE;
  const nearRight = pointer.x > desktop.width - EDGE_ZONE;

  if (nearTop && nearLeft) return 'top-left';
  if (nearTop && nearRight) return 'top-right';
  if (nearBottom && nearLeft) return 'bottom-left';
  if (nearBottom && nearRight) return 'bottom-right';
  if (nearTop) return 'top';
  if (nearLeft) return 'left';
  if (nearRight) return 'right';
  return null;
}

/** The absolute rect a given snap zone resolves to on this desktop. */
export function snapRect(target: SnapZone, desktop: { width: number; height: number }): Rect {
  const halfWidth = desktop.width / 2;
  const halfHeight = desktop.height / 2;
  switch (target) {
    case 'left':
      return { x: 0, y: 0, width: halfWidth, height: desktop.height };
    case 'right':
      return { x: halfWidth, y: 0, width: halfWidth, height: desktop.height };
    case 'top':
      return { x: 0, y: 0, width: desktop.width, height: desktop.height };
    case 'top-left':
      return { x: 0, y: 0, width: halfWidth, height: halfHeight };
    case 'top-right':
      return { x: halfWidth, y: 0, width: halfWidth, height: halfHeight };
    case 'bottom-left':
      return { x: 0, y: halfHeight, width: halfWidth, height: halfHeight };
    case 'bottom-right':
      return { x: halfWidth, y: halfHeight, width: halfWidth, height: halfHeight };
  }
}

/** Snaps `rect`'s position to within 8px of a neighbour's edge or the desktop's own
 * edge, independently on each axis. Pure geometry only — it has no notion of
 * "snapped" window state; the caller (Task 9.3's drag handler) is what excludes
 * already-tiled windows from `others` before calling this, per ticket 04. */
export function magnetise(
  rect: Rect,
  others: Rect[],
  desktop: { width: number; height: number },
): Rect {
  const xTargets: number[] = [0, desktop.width - rect.width];
  const yTargets: number[] = [0, desktop.height - rect.height];

  for (const other of others) {
    // Every alignment that puts one of rect's edges flush with one of other's edges:
    // left-to-right, right-to-left, left-to-left, right-to-right.
    xTargets.push(
      other.x + other.width,
      other.x - rect.width,
      other.x,
      other.x + other.width - rect.width,
    );
    yTargets.push(
      other.y + other.height,
      other.y - rect.height,
      other.y,
      other.y + other.height - rect.height,
    );
  }

  let x = rect.x;
  for (const target of xTargets) {
    if (Math.abs(rect.x - target) < MAGNET) {
      x = target;
      break;
    }
  }

  let y = rect.y;
  for (const target of yTargets) {
    if (Math.abs(rect.y - target) < MAGNET) {
      y = target;
      break;
    }
  }

  return { ...rect, x, y };
}

/** Applies a resize delta from one of the 8 handles, respecting the 200x120 floor.
 * A handle touching the top or left edge moves the origin as it shrinks or grows;
 * `'se'` only ever changes width/height. If a delta would shrink past the minimum,
 * the delta is clamped so the result is exactly the minimum and the origin never
 * overshoots where that minimum would put it. */
export function resize(rect: Rect, handle: ResizeHandle, dx: number, dy: number): Rect {
  let { x, y, width, height } = rect;

  if (handle.includes('e')) width = rect.width + dx;
  if (handle.includes('s')) height = rect.height + dy;
  if (handle.includes('w')) {
    width = rect.width - dx;
    x = rect.x + dx;
  }
  if (handle.includes('n')) {
    height = rect.height - dy;
    y = rect.y + dy;
  }

  if (width < MIN_WIDTH) {
    if (handle.includes('w')) x = rect.x + rect.width - MIN_WIDTH;
    width = MIN_WIDTH;
  }
  if (height < MIN_HEIGHT) {
    if (handle.includes('n')) y = rect.y + rect.height - MIN_HEIGHT;
    height = MIN_HEIGHT;
  }

  return { x, y, width, height };
}

/** A snapped or maximised window starting to drag tears free back to its pre-snap
 * size, recentred under the pointer (ticket 04: "restores its pre-snap size, centred
 * under the cursor"). `snapped` isn't needed for the math — the restore size and the
 * pointer are all a tear-off needs — but it's kept in the signature since the caller
 * always has it in hand and it documents what's being torn off. */
export function tearOff(
  _snapped: Rect,
  restoreSize: { width: number; height: number },
  pointer: { x: number; y: number },
): Rect {
  return {
    x: pointer.x - restoreSize.width / 2,
    y: pointer.y - restoreSize.height / 2,
    width: restoreSize.width,
    height: restoreSize.height,
  };
}

/** Keeps a window's title bar reachable within the desktop (ticket 04's floor
 * requirement, map Hazards: "a window lost outside a shrinking desktop"). Only ever
 * repositions — it never resizes — and only guarantees `MIN_VISIBLE_TITLE_WIDTH` of
 * the bar's width plus its full height stay on-screen. Ticket 04's own honest note is
 * that this is minimal and it shows at very small sizes; the mobile breakpoint not
 * rendering the shell at all is what actually carries the rest. */
export function rescue(rect: Rect, desktop: { width: number; height: number }): Rect {
  const x = clamp(
    rect.x,
    MIN_VISIBLE_TITLE_WIDTH - rect.width,
    desktop.width - MIN_VISIBLE_TITLE_WIDTH,
  );
  const y = clamp(rect.y, 0, Math.max(0, desktop.height - TITLE_BAR_HEIGHT));
  return { ...rect, x, y };
}
