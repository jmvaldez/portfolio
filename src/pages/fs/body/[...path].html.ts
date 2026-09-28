// One static file per `file` node's rendered body (ticket 05, D9): `/fs/body/<path>.html`.
// Fetched when a window opens, prefetched on launcher hover — never inlined into the
// landing HTML (research 05 § 3, 8).

import type { APIRoute, GetStaticPaths, InferGetStaticPropsType } from 'astro';
import { getEntry } from 'astro:content';
import { getTree } from '../../../fs/load';

export const getStaticPaths = (async () => {
  const tree = await getTree();
  const fileNodes = Object.values(tree).filter((node) => node.kind === 'file');

  return Promise.all(
    fileNodes.map(async (node) => {
      if (!node.entry) {
        throw new Error(`fs/body: file node "${node.path}" has no collection entry`);
      }
      const entry = await getEntry(node.entry.collection, node.entry.id);
      if (!entry?.rendered) {
        // Map Hazards: `.mdx` entries never carry `entry.rendered` — `@astrojs/mdx`
        // sends every `.mdx` entry down the deferred-render branch. Reaching here means
        // someone introduced a `.mdx` file where the content model requires `.md`.
        throw new Error(`fs/body: "${node.path}" has no rendered body (is it .mdx?)`);
      }
      return {
        params: { path: node.path.slice(1) },
        props: { html: entry.rendered.html },
      };
    }),
  );
}) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;

export const GET: APIRoute<Props> = ({ props }) =>
  new Response(props.html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
