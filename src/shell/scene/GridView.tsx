// The ambient grid (ticket 07 § Answers; Task 12.2): a `<View>` tracking `#desktop`, so
// the one shared canvas draws Commodore-blue vector floor across the whole desktop. Lives
// inside the `<Canvas>` (drei's `View` only honours `track` there; from the DOM side it
// tracks its own div). Grid and camera are still — only the drone moves (ticket 07).
import { useEffect, useMemo, type RefObject } from 'react';
import * as THREE from 'three';
import { PerspectiveCamera, View } from '@react-three/drei';
import { useShellStore } from '../store';
import { cssVar } from './theme';

interface Props {
  desktopRef: RefObject<HTMLElement | null>;
}

const FLOOR_SIZE = 60;
const FLOOR_Y = -1.2;

export default function GridView({ desktopRef }: Props) {
  const tint = useShellStore((state) => state.effects.gridTint);

  // `--grid` is read from computed style once per tint; the Konami tint swaps it for
  // `--accent`. A `GridHelper` bakes its colour into a vertex attribute, so a tint
  // change rebuilds it rather than mutating a material.
  const { grid, fog } = useMemo(() => {
    const color = cssVar(tint === 'amber' ? '--accent' : '--grid');
    const helper = new THREE.GridHelper(FLOOR_SIZE, FLOOR_SIZE, color, color);
    helper.position.y = FLOOR_Y;
    const material = helper.material;
    material.transparent = true;
    material.opacity = 0.55;
    return { grid: helper, fog: cssVar('--bg') };
  }, [tint]);

  useEffect(
    () => () => {
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
    },
    [grid],
  );

  return (
    <View track={desktopRef as RefObject<HTMLElement>}>
      <PerspectiveCamera makeDefault position={[0, 1.4, 4]} fov={55} />
      <primitive object={grid} />
      <fog attach="fog" args={[fog, 8, 34]} />
    </View>
  );
}
