// The viewer's HUD readout, from the featured drone's frontmatter (ticket 11: "these
// three values come from the featured drone's frontmatter"). Shared by
// `DroneFigure.astro` (the linear layout) and `index.astro` (the shell island's
// fallback prop), so the two surfaces cannot drift. Build-time only: imports
// `astro:content`.
import { getCollection } from 'astro:content';

/** The fallback SVG's box and the linear layout figure's: one size, one source. */
export const DRONE_FIGURE_SIZE = { width: 400, height: 300 } as const;

// The `drones` collection also holds `note` entries nested under a build (glossary:
// "Note"), which carry no `featured`/`class`/spec fields — narrow to `type: "drone"`
// first, same discriminant the content schemas use.
export async function featuredReadout(): Promise<string> {
  const drones = await getCollection('drones');
  const featured = drones.find((entry) => entry.data.type === 'drone' && entry.data.featured);
  if (!featured || featured.data.type !== 'drone') return '';

  // Nothing here is invented if a future featured drone is missing a field — the
  // readout just omits that segment.
  const { class: droneClass, weightG, propSizeIn } = featured.data;
  const parts: string[] = [];
  if (droneClass && propSizeIn !== undefined) {
    parts.push(`${droneClass.toUpperCase()}-${propSizeIn}`);
  }
  if (weightG !== undefined) parts.push(`${weightG} G`);
  if (propSizeIn !== undefined) parts.push(`${propSizeIn} IN`);
  return parts.join(' · ');
}
