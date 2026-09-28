// The viewer's HUD readout, built from the featured drone's frontmatter. Shared by
// `DroneFigure.astro` and `index.astro` so the linear layout and the shell's fallback
// agree. Build-time only: imports `astro:content`.
import { getCollection } from 'astro:content';

/** Pixel size of the static drone SVG, shared by every surface that renders it. */
export const DRONE_FIGURE_SIZE = { width: 400, height: 300 } as const;

/**
 * Returns the featured drone's readout, e.g. `MICRO-3 · 250 G · 3 IN`, omitting any segment
 * whose field is missing. Returns `''` when no drone is featured.
 */
export async function featuredReadout(): Promise<string> {
  const drones = await getCollection('drones');
  const featured = drones.find((entry) => entry.data.type === 'drone' && entry.data.featured);
  if (!featured || featured.data.type !== 'drone') return '';

  const { class: droneClass, weightG, propSizeIn } = featured.data;
  const parts: string[] = [];
  if (droneClass && propSizeIn !== undefined) {
    parts.push(`${droneClass.toUpperCase()}-${propSizeIn}`);
  }
  if (weightG !== undefined) parts.push(`${weightG} G`);
  if (propSizeIn !== undefined) parts.push(`${propSizeIn} IN`);
  return parts.join(' · ');
}
