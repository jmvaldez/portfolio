// D9's static body files, fetched on demand (ticket 05 § Where content is rendered:
// "one static file per entry fetched on open and prefetched on hover"). Both
// functions share one module-level cache keyed by `bodyUrl`, so hovering (which
// prefetches) and then opening (which fetches) a node only ever performs one real
// network request — the second call returns the same in-flight or resolved promise.
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

/** Fetches `node`'s rendered body HTML. Rejects on a missing `bodyUrl` or a failed
 * fetch — callers (`ContentWindow.tsx`) render the loading/error state themselves,
 * this module has no opinion on how a failure looks. */
export function fetchBody(node: FsNode): Promise<string> {
  if (!node.bodyUrl) {
    return Promise.reject(new Error(`fs/bodies: node "${node.path}" has no bodyUrl`));
  }
  return load(node.bodyUrl);
}

/** Warms the cache without waiting on the result (a hover on a desktop icon or a
 * folder row). A prefetch failure is swallowed here — the eventual real `fetchBody`
 * call on open re-fetches and renders its own error state; a prefetch has no UI of
 * its own to report one to. */
export function prefetchBody(node: FsNode): void {
  if (!node.bodyUrl) return;
  void load(node.bodyUrl).catch(() => {
    // Swallowed on purpose — see doc comment above.
  });
}
