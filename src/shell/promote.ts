// The promotion click handler (glossary "Promotion"; ticket 09 § The transition;
// Task 10.3). Shared by `MaximiseBox.tsx` and `ContentWindow.tsx`'s `READ FULL
// PAGE` bar — both are real `<a href={node.url}>` links, and this only runs code
// *before* the browser's own navigation, never `preventDefault`s it.
//
// Judgment call: rather than threading a ref to the window's `.frame` root down
// through `Window.tsx` -> `Desktop.tsx` -> `MaximiseBox`/`ContentWindow` (both of
// which are constructed as standalone elements in `Desktop.tsx`, outside `Window`'s
// own JSX subtree), the click handler finds its own frame via
// `e.currentTarget.closest('.frame')`. Both links live inside the `.frame` section
// `Window.tsx` renders (the maximise box in its `.titlebar`, the READ FULL PAGE bar
// in its `.window-body`), so this is exact, not a heuristic — and it's the "receive
// the window's DOM node some other way" option the task doc names as an
// alternative to ref-threading.
import type { MouseEvent } from 'react';
import { persistLayoutSync } from './persist';

/** The one element currently carrying `view-transition-name: page-frame`, if any —
 * tracked so `clearStalePromotionName` (the `pageshow`/bfcache-return handler) knows
 * what to clear without re-querying the DOM. Module-level and singular on purpose:
 * ticket 09's own hazard is two elements sharing the name, so at most one is ever
 * named at a time. */
let lastNamed: HTMLElement | null = null;

/** Clears any leftover inline `view-transition-name` (map Hazards: two elements
 * sharing a `view-transition-name` silently skips the whole transition). Wired to
 * `window`'s `pageshow` event from `Desktop.tsx`'s mount effect: a visitor who
 * navigates back to `/` via the browser's back button can restore this page from
 * bfcache with the inline style from before promotion still in place, which would
 * collide with the next promotion's own assignment. */
export function clearStalePromotionName(): void {
  if (lastNamed) {
    lastNamed.style.viewTransitionName = '';
    lastNamed = null;
  }
}

/** Runs before the maximise box's or the READ FULL PAGE bar's own `<a>` navigates
 * (ticket 09 § "the name is applied... in the click handler immediately before
 * navigating"): persists the layout synchronously first, so the write isn't lost to
 * the navigation, then names exactly this window's frame `page-frame` — the same
 * name `PageLayout.astro`'s `Frame` carries on the destination page — so the
 * outbound cross-document view transition morphs one into the other. Never calls
 * `preventDefault`; the whole point is that a real navigation follows immediately. */
export function handlePromotionClick(event: MouseEvent<HTMLAnchorElement>): void {
  persistLayoutSync();
  const frame = event.currentTarget.closest<HTMLElement>('.frame');
  if (!frame) return;
  clearStalePromotionName();
  frame.style.viewTransitionName = 'page-frame';
  lastNamed = frame;
}
