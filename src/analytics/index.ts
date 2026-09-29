// The facade shell code calls: `track`, `page`, and `initAnalytics` (once, from the island).
// Calls made before the adapter has loaded are queued and replayed in order, so call sites
// never wait on analytics or check whether it is on.
import { analyticsKey, loadAdapter } from './provider';
import type { Analytics, AnalyticsEvents, EventName } from './types';

export type { AnalyticsEvents, EventName } from './types';

type Call = (adapter: Analytics) => void;

/** How long `init` may wait for an idle moment before starting anyway. */
const IDLE_TIMEOUT_MS = 4000;

/** The queue/replay machinery, split from the singleton below so tests can drive it with a
 * fake loader. */
export function createFacade(load: () => Promise<Analytics>) {
  let adapter: Analytics | null = null;
  let queue: Call[] | null = [];
  let started = false;

  function dispatch(call: Call): void {
    if (adapter) call(adapter);
    else queue?.push(call);
  }

  // Arrow functions, so the facade's members can be re-exported without their object.
  const track = <E extends EventName>(event: E, props: AnalyticsEvents[E]): void =>
    dispatch((a) => a.track(event, props));

  const page = (): void => dispatch((a) => a.page());

  /** Loads and starts the adapter once, then replays the queue. A failed load drops the
   * queue and leaves analytics off: it must never surface to the visitor. */
  const init = async (): Promise<void> => {
    if (started) return;
    started = true;
    try {
      const loaded = await load();
      await loaded.init();
      adapter = loaded;
      const pending = queue ?? [];
      queue = null;
      for (const call of pending) call(loaded);
    } catch {
      queue = null;
    }
  };

  return { track, page, init };
}

const facade = createFacade(() => loadAdapter(analyticsKey()));

export const track = facade.track;
export const page = facade.page;

/** Starts analytics once the browser is idle, so the SDK's lazy chunk never competes with
 * the shell's first paint. Safe to call more than once. */
export function initAnalytics(): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => void facade.init(), { timeout: IDLE_TIMEOUT_MS });
  } else {
    setTimeout(() => void facade.init(), 1);
  }
}
