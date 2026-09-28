// The lazy chunk's root (ticket 01 § Directive; ticket 07 Variant B): ONE `<Canvas>` for
// the shell's lifetime, fixed behind `#desktop`. The grid is a `<View>` tracking the
// desktop; each `viewer.exe` adds a `<View>` (from the DOM side, through drei's tunnel)
// rather than a context. `<Canvas>`, never `createRoot` (Task 12.1).
//
// Imported only via `React.lazy` from `SceneLayer.tsx`, so three stays out of the shell's
// static import graph and `index.html` carries no modulepreload for this chunk.
import { useEffect, type RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { View } from '@react-three/drei';
import { useShellStore } from '../store';
import CrtViewPass from './CrtViewPass';
import GridView from './GridView';

interface Props {
  desktopRef: RefObject<HTMLElement | null>;
  /** The live gate (`useSceneGate`). False after mount means reduced motion was switched
   * on mid-session: the canvas stays mounted but stops (ticket 01 layer 2). */
  active: boolean;
}

export default function Scene({ desktopRef, active }: Props) {
  // D18: the taskbar's `VEC` gauge reports this and nothing else does.
  useEffect(() => {
    useShellStore.getState().setEffects({ vector: active ? 'running' : 'standby' });
    return () => useShellStore.getState().setEffects({ vector: 'standby' });
  }, [active]);

  return (
    <Canvas
      aria-hidden="true"
      tabIndex={-1}
      // Behind `#desktop` (which is transparent on purpose) and above `body`'s ground
      // fill; not `pointer-events` — with `eventSource` set, R3F already makes this
      // wrapper `pointer-events: none`. Inline, because R3F's own inline
      // `position: relative` would beat a class.
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        visibility: active ? 'visible' : 'hidden',
      }}
      dpr={[1, 1.5]}
      frameloop={active ? 'always' : 'never'}
      eventSource={desktopRef}
    >
      <GridView desktopRef={desktopRef} />
      <View.Port />
      <CrtViewPass />
    </Canvas>
  );
}
