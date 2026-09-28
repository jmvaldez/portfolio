// The shell's side of the 3D layer: decides whether the lazy `Scene` chunk is fetched at
// all, and paints the fallback when it is not. Three-free; `Scene` is the only door to it,
// via `React.lazy`.
//
// Once the gate has passed the scene stays mounted for the shell's lifetime: a live
// reduced-motion change only stops it (`Scene`'s `frameloop="never"`) and swaps the
// fallback in, so re-enabling motion never pays for a second context.
import { lazy, Suspense, useEffect, useState, type RefObject } from 'react';
import { useShellStore } from '../store';
import { useSceneGate } from './gate';
import SceneBoundary from './SceneBoundary';

const Scene = lazy(() => import('./Scene'));

interface Props {
  desktopRef: RefObject<HTMLElement | null>;
}

export default function SceneLayer({ desktopRef }: Props) {
  const gate = useSceneGate();
  const [everPassed, setEverPassed] = useState(gate);

  // Latched during render (derived state), so the lazy chunk is requested in the same
  // pass the gate first passes.
  if (gate && !everPassed) setEverPassed(true);

  useEffect(() => {
    if (!gate) useShellStore.getState().setEffects({ vector: 'standby' });
  }, [gate]);

  return (
    <>
      {/* The CSS floor (same rules as `GridFloor.astro`, one source) behind the desktop
          whenever the canvas is not showing. */}
      {!gate && <div className="grid-floor scene-floor" aria-hidden="true" />}
      {everPassed && (
        <SceneBoundary>
          <Suspense fallback={null}>
            <Scene desktopRef={desktopRef} active={gate} />
          </Suspense>
        </SceneBoundary>
      )}
    </>
  );
}
