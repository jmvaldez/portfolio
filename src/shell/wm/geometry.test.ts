import { describe, expect, it } from 'vitest';
import { magnetise, rescue, resize, seedToRect, snapRect, snapTarget } from './geometry';

const DESKTOP = { width: 1200, height: 800 };

describe('seedToRect', () => {
  it('converts desktop fractions into absolute pixels', () => {
    expect(seedToRect({ x: 0.04, y: 0.06, w: 0.26, h: 0.42 }, DESKTOP)).toEqual({
      x: 48,
      y: 48,
      width: 312,
      height: 336,
    });
  });

  it('scales with the desktop rather than staying fixed pixels', () => {
    const seed = { x: 0.5, y: 0.5, w: 0.25, h: 0.25 };
    const small = seedToRect(seed, { width: 1000, height: 1000 });
    const large = seedToRect(seed, { width: 2000, height: 2000 });
    expect(large.x).toBe(small.x * 2);
    expect(large.width).toBe(small.width * 2);
  });
});

describe('snapTarget', () => {
  it('returns null away from every edge', () => {
    expect(snapTarget({ x: 600, y: 400 }, DESKTOP)).toBeNull();
  });

  it('detects the left edge', () => {
    expect(snapTarget({ x: 10, y: 400 }, DESKTOP)).toBe('left');
  });

  it('detects the right edge', () => {
    expect(snapTarget({ x: 1190, y: 400 }, DESKTOP)).toBe('right');
  });

  it('detects the top edge as maximise', () => {
    expect(snapTarget({ x: 600, y: 5 }, DESKTOP)).toBe('top');
  });

  it('prioritises a corner over the edges that compose it', () => {
    // Within 26px of both the left edge and the top edge: a corner, not 'left'.
    expect(snapTarget({ x: 10, y: 10 }, DESKTOP)).toBe('top-left');
  });

  it('detects every corner', () => {
    expect(snapTarget({ x: 1190, y: 10 }, DESKTOP)).toBe('top-right');
    expect(snapTarget({ x: 10, y: 790 }, DESKTOP)).toBe('bottom-left');
    expect(snapTarget({ x: 1190, y: 790 }, DESKTOP)).toBe('bottom-right');
  });
});

describe('snapRect', () => {
  it('gives halves for left and right', () => {
    expect(snapRect('left', DESKTOP)).toEqual({ x: 0, y: 0, width: 600, height: 800 });
    expect(snapRect('right', DESKTOP)).toEqual({ x: 600, y: 0, width: 600, height: 800 });
  });

  it('gives the full desktop for top (maximise)', () => {
    expect(snapRect('top', DESKTOP)).toEqual({ x: 0, y: 0, width: 1200, height: 800 });
  });

  it('gives quarters for corners', () => {
    expect(snapRect('top-left', DESKTOP)).toEqual({ x: 0, y: 0, width: 600, height: 400 });
    expect(snapRect('top-right', DESKTOP)).toEqual({ x: 600, y: 0, width: 600, height: 400 });
    expect(snapRect('bottom-left', DESKTOP)).toEqual({ x: 0, y: 400, width: 600, height: 400 });
    expect(snapRect('bottom-right', DESKTOP)).toEqual({
      x: 600,
      y: 400,
      width: 600,
      height: 400,
    });
  });
});

describe('magnetise', () => {
  it('leaves a rect alone when nothing is close', () => {
    const rect = { x: 300, y: 300, width: 200, height: 150 };
    expect(magnetise(rect, [], DESKTOP)).toEqual(rect);
  });

  it('snaps to the top-left desktop edges within 8px', () => {
    const near = { x: 4, y: 3, width: 200, height: 150 };
    expect(magnetise(near, [], DESKTOP)).toEqual({ ...near, x: 0, y: 0 });
  });

  it('snaps to the bottom-right desktop edges within 8px', () => {
    // x + width should land on desktop.width (1200); y + height on desktop.height (800).
    const near = { x: 997, y: 646, width: 200, height: 150 };
    const result = magnetise(near, [], DESKTOP);
    expect(result.x + result.width).toBe(DESKTOP.width);
    expect(result.y + result.height).toBe(DESKTOP.height);
  });

  it('snaps flush against a neighbour on both axes independently', () => {
    const other = { x: 400, y: 200, width: 300, height: 300 };
    // rect's right edge (x + width = 402) sits 2px from other's left edge (400):
    // snaps x so rect.x + rect.width === other.x. rect's top (y=196) sits 4px from
    // other's top (200): snaps y to other.y.
    const rect = { x: 202, y: 196, width: 200, height: 150 };
    const result = magnetise(rect, [other], DESKTOP);
    expect(result.x + result.width).toBe(other.x);
    expect(result.y).toBe(other.y);
  });

  it('does not snap when a neighbour is more than 8px away', () => {
    const other = { x: 400, y: 200, width: 300, height: 300 };
    const rect = { x: 150, y: 150, width: 200, height: 150 };
    expect(magnetise(rect, [other], DESKTOP)).toEqual(rect);
  });
});

describe('resize', () => {
  it('grows from the se handle without moving the origin', () => {
    const rect = { x: 100, y: 100, width: 300, height: 200 };
    expect(resize(rect, 'se', 50, 30)).toEqual({ x: 100, y: 100, width: 350, height: 230 });
  });

  it('moves the origin when shrinking from nw', () => {
    const rect = { x: 100, y: 100, width: 300, height: 200 };
    const result = resize(rect, 'nw', 20, 10);
    expect(result).toEqual({ x: 120, y: 110, width: 280, height: 190 });
  });

  it('enforces the 200x120 minimum from a large inward nw delta', () => {
    const rect = { x: 100, y: 100, width: 300, height: 200 };
    const result = resize(rect, 'nw', 1000, 1000);
    expect(result.width).toBe(200);
    expect(result.height).toBe(120);
    // The origin must land exactly where the minimum size puts it, never past it:
    // right/bottom edges are fixed at rect.x + rect.width / rect.y + rect.height.
    expect(result.x).toBe(rect.x + rect.width - 200);
    expect(result.y).toBe(rect.y + rect.height - 120);
  });

  it('clamps a single axis independently of the other', () => {
    const rect = { x: 0, y: 0, width: 300, height: 200 };
    const result = resize(rect, 'w', 1000, 0);
    expect(result.width).toBe(200);
    expect(result.x).toBe(100);
    expect(result.height).toBe(200);
  });
});

describe('rescue', () => {
  const small = { width: 1024, height: 600 };

  it('leaves a fully on-screen window untouched', () => {
    const rect = { x: 100, y: 100, width: 300, height: 200 };
    expect(rescue(rect, small)).toEqual(rect);
  });

  it('pulls a window dragged far off the left back to a grabbable sliver', () => {
    const rect = { x: -900, y: 100, width: 300, height: 200 };
    const result = rescue(rect, small);
    // At least 80px of the title bar's width remains inside the desktop.
    expect(result.x + result.width).toBeGreaterThanOrEqual(80);
    expect(result.width).toBe(300);
    expect(result.height).toBe(200);
  });

  it('pulls a window dragged far off the right back to a grabbable sliver', () => {
    const rect = { x: 2000, y: 100, width: 300, height: 200 };
    const result = rescue(rect, small);
    expect(result.x).toBeLessThanOrEqual(small.width - 80);
  });

  it('pulls a window dragged above the desktop back down', () => {
    const rect = { x: 100, y: -500, width: 300, height: 200 };
    const result = rescue(rect, small);
    expect(result.y).toBe(0);
  });

  it('keeps the full title bar height on-screen when the desktop shrinks vertically', () => {
    const rect = { x: 100, y: 590, width: 300, height: 200 };
    const result = rescue(rect, small);
    expect(result.y).toBeLessThanOrEqual(small.height - 30);
  });

  it('never changes the window size, only its position', () => {
    const rect = { x: -900, y: -900, width: 300, height: 200 };
    const result = rescue(rect, small);
    expect(result.width).toBe(300);
    expect(result.height).toBe(200);
  });
});
