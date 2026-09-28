// Static body files, fetched on open and prefetched on hover. Both functions share one
// cache keyed by `bodyUrl`, so hovering then opening a node makes a single request.
import type { FsNode } from '~/fs/types';

const cache = new Map<string, Promise<string>>();

function load(url: string): Promise<string> {
  const cached = cache.get(url);
  if (cached) return cached;
  const promise = fetch(url).then((res) => {
    if (!res.ok) throw new Error(`fs/bodies: ${url} responded ${res.status}`);
    return res.text();
  });
  cache.set(url, promise);
  return promise;
}

/** Returns `node`'s rendered body HTML. Rejects if `bodyUrl` is missing or the fetch fails. */
export function fetchBody(node: FsNode): Promise<string> {
  if (!node.bodyUrl) {
    return Promise.reject(new Error(`fs/bodies: node "${node.path}" has no bodyUrl`));
  }
  return load(node.bodyUrl);
}

/** Warms the cache without waiting on the result. Failures are ignored; opening the node
 * fetches again and reports its own error. */
export function prefetchBody(node: FsNode): void {
  if (!node.bodyUrl) return;
  void load(node.bodyUrl).catch(() => {
    // Ignored on purpose; see the doc comment.
  });
}
