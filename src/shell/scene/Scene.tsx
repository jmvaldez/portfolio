// The lazy chunk's root: one `<Canvas>` for the shell's lifetime, fixed behind `#desktop`.
// The grid is a `<View>` tracking the desktop; each `viewer.exe` adds a `<View>` through
// drei's tunnel rather than a second WebGL context.
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
   * on mid-session: the canvas stays mounted but stops. */
  active: boolean;
}

export default function Scene({ desktopRef, active }: Props) {
  // Drives the taskbar's `VEC` gauge.
  useEffect(() => {
    useShellStore.getState().setEffects({ vector: active ? 'running' : 'standby' });
    return () => useShellStore.getState().setEffects({ vector: 'standby' });
  }, [active]);

  return (
    <Canvas
      aria-hidden="true"
      tabIndex={-1}
      // Behind the transparent `#desktop` and above `body`'s ground fill. No
      // `pointer-events` here: with `eventSource` set, R3F already makes the wrapper
      // `pointer-events: none`. Inline, because R3F's inline `position: relative` beats a class.
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
