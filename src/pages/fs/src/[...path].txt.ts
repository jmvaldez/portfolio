// One static file per `file` node's raw source, frontmatter included (ticket 05 § the
// filesystem, D8: "`cat` prints the whole file, frontmatter included"): `/fs/src/<path>.txt`.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { APIRoute, GetStaticPaths, InferGetStaticPropsType } from 'astro';
import { getEntry } from 'astro:content';
import { getTree } from '../../../fs/load';

export const getStaticPaths = (async () => {
  const tree = await getTree();
  const fileNodes = Object.values(tree).filter((node) => node.kind === 'file');

  return Promise.all(
    fileNodes.map(async (node) => {
      if (!node.entry) {
        throw new Error(`fs/src: file node "${node.path}" has no collection entry`);
      }
      const entry = await getEntry(node.entry.collection, node.entry.id);
      if (!entry?.filePath) {
        throw new Error(`fs/src: "${node.path}" has no on-disk file`);
      }
      // D8: read from disk against `process.cwd()`, never a path built from
      // `import.meta.url` — at build time that resolves into `dist/.prerender/chunks/`,
      // not the source tree (research 17, hazard 8).
      const source = await readFile(join(process.cwd(), entry.filePath), 'utf-8');
      return {
        params: { path: node.path.slice(1) },
        props: { source },
      };
    }),
  );
}) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;

export const GET: APIRoute<Props> = ({ props }) =>
  new Response(props.source, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
