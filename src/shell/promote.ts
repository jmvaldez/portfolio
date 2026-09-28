// The promotion click handler, shared by `MaximiseBox.tsx` and `ContentWindow.tsx`'s
// "read full page" bar. Both are real links; this runs before the browser navigates and
// never prevents it.
//
// The handler finds its window via `closest('.frame')` rather than a ref threaded through
// `Window` and `Desktop`; both links always render inside the `.frame` that `Window` makes.
import type { MouseEvent } from 'react';
import { persistLayoutSync } from './persist';

/** The element currently carrying `view-transition-name: page-frame`, if any. At most one
 * element may hold the name, so this is a single module-level slot. */
let lastNamed: HTMLElement | null = null;

/**
 * Clears a leftover inline `view-transition-name`. A page restored from bfcache after
 * promotion keeps the name, and two elements sharing it silently skip the whole transition.
 */
export function clearStalePromotionName(): void {
  if (lastNamed) {
    lastNamed.style.viewTransitionName = '';
    lastNamed = null;
  }
}

/**
 * Persists the layout, then names the clicked link's window frame `page-frame`, the name
 * `PageLayout.astro`'s `Frame` carries, so the cross-document view transition morphs one
 * into the other. Does not prevent the navigation.
 */
export function handlePromotionClick(event: MouseEvent<HTMLAnchorElement>): void {
  persistLayoutSync();
  const frame = event.currentTarget.closest<HTMLElement>('.frame');
  if (!frame) return;
  clearStalePromotionName();
  frame.style.viewTransitionName = 'page-frame';
  lastNamed = frame;
}
