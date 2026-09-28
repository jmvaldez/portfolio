/* eslint-disable react-hooks/immutability -- three.js objects (uniforms, transforms, the
   renderer) are mutated in effects and frame callbacks by design; that is R3F's model. */
// `viewer.exe`'s 3D half: a `<View>` on the shared canvas showing the procedural drone as
// drei `<Edges>` (fat lines, since `LineBasicMaterial.linewidth` is ignored) in `--ink` over
// a near-black fill. Orbitable by pointer and touch only, with a slow idle rotation.
// Imported only via `React.lazy` from `Viewer.tsx`.
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Edges, OrbitControls, PerspectiveCamera, View } from '@react-three/drei';
import { buildDrone } from '~/drone/geometry';
import { useShellStore } from '../store';
import { cssVar } from './theme';

/** The camera starts where `src/drone/svg.ts`'s fixed three-quarter view sits, so the
 * fallback SVG and the live view agree at rest. */
const START_AZIMUTH_DEG = 35;
const START_ELEVATION_DEG = 22;
const CAMERA_DISTANCE = 2.6;
const FOV = 40;

/** Prop spin at full arm, in rad/s, and how long spin-up and spin-down take. */
const PROP_SPIN = 60;
const SPIN_RAMP_S = 0.6;

const FILL = '#050703';

interface Props {
  windowId: string;
  onOrbit: (degrees: number) => void;
}

function startPosition(): [number, number, number] {
  const az = (START_AZIMUTH_DEG * Math.PI) / 180;
  const el = (START_ELEVATION_DEG * Math.PI) / 180;
  return [
    CAMERA_DISTANCE * Math.cos(el) * Math.sin(az),
    CAMERA_DISTANCE * Math.sin(el),
    CAMERA_DISTANCE * Math.cos(el) * Math.cos(az),
  ];
}

/** Mirrors the built `THREE.Group` as JSX so every mesh can carry its own `<Edges>`, keeping
 * the `userData.prop` flag for the spin. Geometry is reused (and disposed by `Drone`), so
 * `svg.ts` and this view draw from the same source. */
function mirror(object: THREE.Object3D, ink: string): ReactNode {
  const transform = {
    position: object.position,
    rotation: object.rotation,
    scale: object.scale,
  };
  if (object instanceof THREE.Mesh) {
    return (
      <mesh
        key={object.uuid}
        name={object.name}
        geometry={object.geometry as THREE.BufferGeometry}
        {...transform}
      >
        <meshBasicMaterial color={FILL} polygonOffset polygonOffsetFactor={1} />
        <Edges color={ink} threshold={15} lineWidth={1.5} />
      </mesh>
    );
  }
  return (
    <group key={object.uuid} name={object.name} userData={object.userData} {...transform}>
      {object.children.map((child) => mirror(child, ink))}
    </group>
  );
}

function Drone() {
  const drone = useMemo(() => buildDrone(), []);
  const ink = useMemo(() => cssVar('--ink'), []);
  const root = useRef<THREE.Group>(null);
  const props = useRef<THREE.Object3D[]>([]);
  const spin = useRef(0);

  useEffect(() => {
    const found: THREE.Object3D[] = [];
    root.current?.traverse((child) => {
      if (child.userData['prop'] === true) found.push(child);
    });
    props.current = found;
  }, []);

  useEffect(
    () => () => {
      drone.traverse((child) => {
        if (child instanceof THREE.Mesh) (child.geometry as THREE.BufferGeometry).dispose();
      });
    },
    [drone],
  );

  // Armed: props spin up over `SPIN_RAMP_S` and hold; disarmed: they spin down. Read from
  // the store inside the frame so arming never re-renders the scene.
  useFrame((_, delta) => {
    const target = useShellStore.getState().effects.armed ? 1 : 0;
    const step = delta / SPIN_RAMP_S;
    spin.current =
      target > spin.current
        ? Math.min(target, spin.current + step)
        : Math.max(target, spin.current - step);
    if (spin.current === 0) return;
    for (const prop of props.current) prop.rotation.y += PROP_SPIN * spin.current * delta;
  });

  return <group ref={root}>{drone.children.map((child) => mirror(child, ink))}</group>;
}

function Orbit({ container, onOrbit }: { container: HTMLElement; onOrbit: Props['onOrbit'] }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const lastDegrees = useRef(-1);

  useFrame(() => {
    const azimuth = controls.current?.getAzimuthalAngle();
    if (azimuth === undefined) return;
    const degrees = (Math.round((azimuth * 180) / Math.PI) + 360) % 360;
    if (degrees === lastDegrees.current) return;
    lastDegrees.current = degrees;
    onOrbit(degrees);
  });

  return (
    <OrbitControls
      ref={controls}
      // Explicit: drei's `View` re-points `events.connected` at each tracked element,
      // so the default would follow whichever view mounted last.
      domElement={container}
      enablePan={false}
      enableZoom={false}
      autoRotate
      autoRotateSpeed={0.8}
    />
  );
}

export default function ViewerView({ windowId, onOrbit }: Props) {
  // A minimised window hides its view rather than freezing it to a bitmap, since the canvas
  // is shared. Dragging and resizing keep rendering live.
  const minimised = useShellStore(
    (state) => state.windows.find((w) => w.id === windowId)?.minimised ?? false,
  );
  const [container, setContainer] = useState<HTMLElement | null>(null);

  return (
    <View
      ref={(el) => setContainer(el instanceof HTMLElement ? el : null)}
      className="viewer-view"
      style={{ width: '100%', height: '100%' }}
      visible={!minimised}
    >
      <PerspectiveCamera makeDefault position={startPosition()} fov={FOV} />
      <Drone />
      {container && <Orbit container={container} onOrbit={onOrbit} />}
    </View>
  );
}
