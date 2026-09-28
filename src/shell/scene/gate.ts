// The 3D layer's gate (ticket 01 § Reduced motion, layer 1; D19): WebGL2 present AND
// `prefers-reduced-motion: no-preference`. Deliberately three-free — `Desktop.tsx`, the
// scene layer and `Viewer.tsx` all import this, and none of them may drag three into
// the shell's static import graph (map Hazards). Like D20's head gate this never
// creates a context to check: `WebGL2RenderingContext`'s presence is the test, and a
// context that then fails to build is caught at runtime (`SceneBoundary` -> `markFailed`).
import { useSyncExternalStore } from 'react';

export const MOTION_OK_QUERY = '(prefers-reduced-motion: no-preference)';

function webgl2Available(): boolean {
  return typeof window.WebGL2RenderingContext !== 'undefined';
}

let failed = false;
const failListeners = new Set<() => void>();

/** Called by the scene's error boundary when the canvas could not be built after
 * all (blocklisted GPU, context creation refused): everything that reads the gate
 * then takes the fallback path, same as if it had never passed. */
export function markSceneFailed(): void {
  if (failed) return;
  failed = true;
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

/** The gate's current value, for non-React callers (the terminal's `arm`). */
export function sceneGateOpen(): boolean {
  return !failed && webgl2Available() && window.matchMedia(MOTION_OK_QUERY).matches;
}

/** Live: flips when the visitor changes their reduced-motion setting mid-session
 * (ticket 01 layer 2), not just at mount. */
export function useSceneGate(): boolean {
  return useSyncExternalStore(subscribe, sceneGateOpen, () => false);
}
