// Schema pieces for the three content collections (ticket 05 § Schemas, D6, D7).
//
// This file imports only `astro/zod`, never `astro:content`, so it can be unit-tested
// directly (`schemas.test.ts`) without pulling in Astro's content-layer machinery. The
// real `image()` schema helper is supplied by Astro's collection `schema` function at
// build time; here it is just a parameter typed loosely enough for a test double.

import { z } from 'astro/zod';

/** The shape of Astro's `image()` schema helper, narrowed to what this file needs. */
export type ImageSchema = () => z.ZodType;

/** D6: `{ start: 'YYYY' | 'YYYY-MM', end?: 'YYYY' | 'YYYY-MM' | 'present' }`. */
const yearOrMonth = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, 'expected YYYY or YYYY-MM');

export const period = z.object({
  start: yearOrMonth,
  end: z.union([yearOrMonth, z.literal('present')]).optional(),
});

/** D7: a footage item, with an optional poster frame (a framed ▶ glyph otherwise). */
export function footageItem(image: ImageSchema) {
  return z.object({
    label: z.string(),
    url: z.url(),
    poster: image().optional(),
  });
}

export function hardware() {
  return z.object({
    motors: z.string().optional(),
    esc: z.string().optional(),
    flightController: z.string().optional(),
    vtx: z.string().optional(),
    camera: z.string().optional(),
  });
}

export function projectSchema(image: ImageSchema) {
  return z.object({
    type: z.literal('project'),
    title: z.string(),
    summary: z.string(),
    role: z.string(),
    tech: z.array(z.string()),
    period,
    status: z.enum(['shipped', 'archived', 'wip']),
    repo: z.url().optional(),
    live: z.url().optional(),
    cover: image().optional(),
    featured: z.boolean().default(false),
    filename: z.string().optional(),
  });
}

export function droneSchema(image: ImageSchema) {
  return z.object({
    type: z.literal('drone'),
    title: z.string(),
    summary: z.string(),
    class: z.enum(['freestyle', 'cinematic', 'long-range', 'racing', 'micro']),
    frame: z.string(),
    hardware: hardware().optional(),
    weightG: z.number().optional(),
    propSizeIn: z.number().optional(),
    firstFlight: z.date().optional(),
    footage: z.array(footageItem(image)).optional(),
    gallery: z.array(image()).optional(),
    featured: z.boolean().default(false),
    filename: z.string().optional(),
  });
}

/** A supporting entry nested under a project or drone build (ticket 05 § Nesting). */
export function noteSchema() {
  return z.object({
    type: z.literal('note'),
    title: z.string(),
    summary: z.string().optional(),
  });
}

export function projectsUnion(image: ImageSchema) {
  return z.discriminatedUnion('type', [projectSchema(image), noteSchema()]);
}

export function dronesUnion(image: ImageSchema) {
  return z.discriminatedUnion('type', [droneSchema(image), noteSchema()]);
}

export function pageSchema() {
  return z.object({
    type: z.literal('page'),
    title: z.string(),
    filename: z.string(),
    order: z.number().int(),
    summary: z.string().optional(),
  });
}
