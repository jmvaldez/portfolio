// `viewer.exe`: the window body is transparent and holds the drone's `<View>`, so it
// composites over the same grid as the desktop floor, with a plain-HTML HUD on top. When
// the scene gate is off, the HUD sits over the build-time drone SVG instead and three is
// never imported, since the 3D half is its own lazy chunk.
import { lazy, Suspense, useState } from 'react';
import { useShellStore } from '../store';
import { useSceneGate } from '../scene/gate';
import type { AppProps } from './registry';

const ViewerView = lazy(() => import('../scene/ViewerView'));

/** `src/drone/svg.ts`'s fixed view sits at this azimuth. */
const REST_ORBIT_DEG = 35;

export default function Viewer({ windowId }: AppProps) {
  const live = useSceneGate();
  const { svg, readout } = useShellStore((state) => state.droneFallback);
  const [orbit, setOrbit] = useState(REST_ORBIT_DEG);

  return (
    <div className="viewer">
      {live ? (
        <Suspense fallback={null}>
          <ViewerView windowId={windowId} onOrbit={setOrbit} />
        </Suspense>
      ) : (
        <div
          className="viewer-fallback"
          aria-hidden="true"
          // Build-time SVG from `index.astro`; ours, not user input.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
      <div className="cross" aria-hidden="true" />
      <div className="readout" aria-hidden="true">
        {[readout, `ORBIT ${live ? orbit : REST_ORBIT_DEG}°`].filter(Boolean).join(' · ')}
      </div>
      <p className="sr-only">Wireframe model of a 5-inch FPV quadcopter, slowly rotating.</p>
    </div>
  );
}
