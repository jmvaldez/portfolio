import { describe, expect, it } from 'vitest';
import { z } from 'astro/zod';
import { dronesUnion, noteSchema, period, projectsUnion } from './schemas';

// A stand-in for Astro's real `image()` schema helper, which just needs to accept a
// relative path string in these tests — the real image processing only runs inside
// Astro's build.
const image = () => z.string();

describe('projectsUnion', () => {
  const base = {
    type: 'project' as const,
    title: 'Orbital Mesh',
    summary: 'A distributed mesh scheduler.',
    role: 'Lead engineer',
    tech: ['TypeScript'],
    period: { start: '2025-03' },
    status: 'wip' as const,
  };

  it('accepts a well-formed project', () => {
    expect(projectsUnion(image).safeParse(base).success).toBe(true);
  });

  it('fails a project missing role', () => {
    const withoutRole: Record<string, unknown> = { ...base };
    delete withoutRole.role;
    const result = projectsUnion(image).safeParse(withoutRole);
    expect(result.success).toBe(false);
  });

  it('accepts a note with only a title', () => {
    const result = projectsUnion(image).safeParse({ type: 'note', title: 'Notes' });
    expect(result.success).toBe(true);
  });

  it('rejects a typo in the discriminator instead of silently reclassifying', () => {
    const result = projectsUnion(image).safeParse({ ...base, type: 'porject' });
    expect(result.success).toBe(false);
  });
});

describe('dronesUnion', () => {
  it('accepts a note with only a title', () => {
    const result = dronesUnion(image).safeParse({ type: 'note', title: 'Tuning' });
    expect(result.success).toBe(true);
  });
});

describe('noteSchema', () => {
  it('passes with only a title', () => {
    expect(noteSchema().safeParse({ type: 'note', title: 'Notes' }).success).toBe(true);
  });
});

describe('period', () => {
  it('accepts YYYY and YYYY-MM', () => {
    expect(period.safeParse({ start: '2025' }).success).toBe(true);
    expect(period.safeParse({ start: '2025-03' }).success).toBe(true);
  });

  it('accepts an end of "present"', () => {
    expect(period.safeParse({ start: '2025-03', end: 'present' }).success).toBe(true);
  });

  it('rejects an invalid month', () => {
    expect(period.safeParse({ start: '2025-13' }).success).toBe(false);
    expect(period.safeParse({ start: '2025-03', end: '2025-13' }).success).toBe(false);
  });
});
