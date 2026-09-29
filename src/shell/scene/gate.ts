// The 3D layer's gate: WebGL2 is present and `prefers-reduced-motion` is `no-preference`.
// Three-free, since `Desktop.tsx`, the scene layer and `Viewer.tsx` all import it and none
// may pull three into the shell's static import graph. It never creates a context to check:
// `WebGL2RenderingContext`'s presence is the test, and a context that then fails to build is
// caught at runtime (`SceneBoundary` calls `markSceneFailed`).
import { useSyncExternalStore } from 'react';
import { track } from '~/analytics';

export const MOTION_OK_QUERY = '(prefers-reduced-motion: no-preference)';

function webgl2Available(): boolean {
  return typeof window.WebGL2RenderingContext !== 'undefined';
}

let sceneReported = false;

/** Reports how the scene resolved, once per page load: the first outcome wins, so a later
 * reduced-motion switch on a running scene doesn't read as a fallback. */
export function reportScene(scene: 'webgl' | 'svg_fallback'): void {
  if (sceneReported) return;
  sceneReported = true;
  track('scene_resolved', { scene });
}

let failed = false;
const failListeners = new Set<() => void>();

/** Closes the gate for the rest of the session after the canvas failed to build (blocklisted
 * GPU, context creation refused), so everything reading it takes the fallback path. */
export function markSceneFailed(): void {
  if (failed) return;
  failed = true;
  reportScene('svg_fallback');
  failListeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(MOTION_OK_QUERY);
  mql.addEventListener('change', onChange);
  failListeners.add(onChange);
  return () => {
    mql.removeEventListener('change', onChange);
    failListeners.delete(onChange);
  };
}

/** Returns whether the gate is open, for non-React callers (the terminal's `arm`). */
export function sceneGateOpen(): boolean {
  return !failed && webgl2Available() && window.matchMedia(MOTION_OK_QUERY).matches;
}

/** Returns whether the gate is open, updating when the visitor changes their
 * reduced-motion setting mid-session. */
export function useSceneGate(): boolean {
  return useSyncExternalStore(subscribe, sceneGateOpen, () => false);
}
