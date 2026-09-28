import { describe, expect, it } from 'vitest';
import { tree } from './fixture';
import { complete, type CompleteCtx } from './complete';

const ctx: CompleteCtx = { tree, wd: '/' };

describe('command position', () => {
  it('completes a single unambiguous command', () => {
    expect(complete('who', 3, ctx)).toEqual({ type: 'single', value: 'whoami' });
  });

  it('completes an egg command, since eggs are real /bin entries', () => {
    expect(complete('su', 2, ctx)).toEqual({ type: 'single', value: 'sudo' });
  });

  it('completes an app name', () => {
    expect(complete('view', 4, ctx)).toEqual({ type: 'single', value: 'viewer.exe' });
  });

  it('lists candidates on several matches', () => {
    const result = complete('c', 1, ctx);
    expect(result.type).toBe('multiple');
    if (result.type === 'multiple') {
      expect(result.candidates).toEqual(expect.arrayContaining(['cat', 'cd', 'clear']));
    }
  });

  it('returns none when nothing matches', () => {
    expect(complete('zzz', 3, ctx)).toEqual({ type: 'none' });
  });
});

describe('path position', () => {
  it('completes a single unambiguous path segment with a trailing slash for a directory', () => {
    expect(complete('cd proj', 7, ctx)).toEqual({ type: 'single', value: 'cd projects/' });
  });

  it('completes a file without a trailing slash', () => {
    expect(complete('cat about', 9, ctx)).toEqual({ type: 'single', value: 'cat about.txt' });
  });

  it('completes relative to a non-root working directory', () => {
    const nested: CompleteCtx = { tree, wd: '/projects' };
    expect(complete('cat orb', 7, nested)).toEqual({ type: 'single', value: 'cat orbital-mesh/' });
  });

  it('completes a path with an explicit directory prefix', () => {
    expect(complete('ls /bin/su', 10, ctx)).toEqual({ type: 'single', value: 'ls /bin/sudo' });
  });

  it('lists candidates when several path segments match', () => {
    const result = complete('cat /bin/c', 10, ctx);
    expect(result.type).toBe('multiple');
    if (result.type === 'multiple') expect(result.candidates).toEqual(['cat', 'cd', 'clear']);
  });

  it('returns none for a directory prefix that does not resolve', () => {
    expect(complete('cat /nope/x', 11, ctx)).toEqual({ type: 'none' });
  });

  it('returns none for a target that is not a directory', () => {
    expect(complete('cat about.txt/x', 15, ctx)).toEqual({ type: 'none' });
  });
});
