// Pure geometry for the hand-rolled window manager. DOM-free, so it can be unit tested and
// driven from React without either side owning the math. Every unit is CSS pixels relative
// to the desktop rect; callers convert pointer events to `{ x, y }` and `#desktop`'s box to
// `{ width, height }`.

/** A window's geometry, in CSS px relative to the desktop's own rect. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The eight resize handles (n/s/e/w edges, plus the four corners). */
export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** The regions a drag can release into: left and right halves, corner quarters, and the top
 * edge to maximise. There is no plain bottom zone. */
export type SnapZone =
  'left' | 'right' | 'top' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** A window rect expressed as fractions 0-1 of the desktop, so it scales with its size. */
export interface SeedFraction {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How close a pointer must be to an edge, in px, to arm a snap zone. */
const EDGE_ZONE = 26;

/** Magnetism distance, in px, to another window or a desktop edge, applied per axis. */
const MAGNET = 8;

/** The minimum size any resize allows. */
const MIN_WIDTH = 200;
const MIN_HEIGHT = 120;

/** The title-bar height and how much of its width `rescue` keeps reachable, enough to grab. */
const TITLE_BAR_HEIGHT = 30;
const MIN_VISIBLE_TITLE_WIDTH = 80;

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

/** Converts a fraction-of-desktop seed into an absolute-pixel `Rect`. */
export function seedToRect(seed: SeedFraction, desktop: { width: number; height: number }): Rect {
  return {
    x: seed.x * desktop.width,
    y: seed.y * desktop.height,
    width: seed.w * desktop.width,
    height: seed.h * desktop.height,
  };
}

/** Returns the snap zone a pointer lands in, or `null` if it is not near an edge. Corners
 * take priority over plain edges, so a pointer near both the left and top edges is
 * `'top-left'`. */
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

/** Returns the absolute rect that `target` occupies on this desktop. */
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

/** Returns `rect` moved so its edges sit flush with a neighbour's edge or the desktop's edge
 * when within `MAGNET` px, independently on each axis. `others` should hold only free
 * windows; the caller excludes snapped ones. */
export function magnetise(
  rect: Rect,
  others: Rect[],
  desktop: { width: number; height: number },
): Rect {
  const xTargets: number[] = [0, desktop.width - rect.width];
  const yTargets: number[] = [0, desktop.height - rect.height];

  for (const other of others) {
    // Every alignment that puts one of rect's edges flush with one of other's edges.
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

/** Returns `rect` resized by the delta `dx`, `dy` applied at `handle`, never below the
 * minimum size. Handles on the top or left edge also move the origin; when clamped to the
 * minimum, the origin stays where that minimum size puts it. */
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

/** Returns the rect for a snapped window torn free by a drag: `restoreSize`, centred on
 * `pointer`. The `_snapped` rect is unused and kept for documentation. */
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

/** Returns `rect` repositioned so its title bar stays reachable when the desktop shrinks.
 * It never resizes, and guarantees only `MIN_VISIBLE_TITLE_WIDTH` of the bar's width and its
 * full height stay on-screen, so very small desktops can still overflow a window. */
export function rescue(rect: Rect, desktop: { width: number; height: number }): Rect {
  const x = clamp(
    rect.x,
    MIN_VISIBLE_TITLE_WIDTH - rect.width,
    desktop.width - MIN_VISIBLE_TITLE_WIDTH,
  );
  const y = clamp(rect.y, 0, Math.max(0, desktop.height - TITLE_BAR_HEIGHT));
  return { ...rect, x, y };
}
