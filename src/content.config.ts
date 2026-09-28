// Content collections `projects`, `drones`, and `pages`. Markdown only: `.mdx` entries
// never carry `entry.rendered`.

import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { dronesUnion, pageSchema, projectsUnion } from './content/schemas';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: ({ image }) => projectsUnion(image),
});

const drones = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/drones' }),
  schema: ({ image }) => dronesUnion(image),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: pageSchema,
});

export const collections = { projects, drones, pages };
