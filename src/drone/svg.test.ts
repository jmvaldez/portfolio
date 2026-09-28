import { describe, expect, it } from 'vitest';
import { renderDroneSvg } from './svg';

describe('renderDroneSvg', () => {
  it('stays within the performance budget row (ticket 19: drone SVG <= 15 KB)', () => {
    const svg = renderDroneSvg({ width: 400, height: 300 });
    const bytes = new TextEncoder().encode(svg).length;
    expect(bytes).toBeLessThanOrEqual(15 * 1024);
  });

  it('emits exactly one <path> carrying every edge segment', () => {
    const svg = renderDroneSvg({ width: 400, height: 300 });
    const matches = svg.match(/<path/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('is deterministic: identical options produce byte-identical output', () => {
    const a = renderDroneSvg({ width: 400, height: 300 });
    const b = renderDroneSvg({ width: 400, height: 300 });
    expect(a).toBe(b);
  });
});
