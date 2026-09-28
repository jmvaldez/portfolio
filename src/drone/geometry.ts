// The procedural FPV quad (ticket 03 § (c): "build it procedurally from three.js
// primitives", the map's settled route — no asset, no loader, no licence obligation).
// Ported from the throwaway prototype's `Drone.jsx` (branch `prototype/07-webgl-scene`,
// `src/shared/Drone.jsx`), stripped of its React wrapper and `useFrame` spin: this file
// hands back plain geometry, and Phase 12's animation loop spins the returned prop
// groups itself by finding `userData.prop === true`.
//
// Deviations from the prototype, both required by this phase's spec rather than
// invented: the prototype's motor cylinders use 12 radial segments, this uses 8 (the
// spec calls for 8-segment cylinders); the prototype has landing skids and a lens
// detail instead of a canopy and antennas, so those two parts are new geometry sized
// to sit naturally on the frame rather than ported from anywhere. Total triangle count
// is ≈372, inside the ticket's ~388 target and this phase's 350–430 test range.
import * as THREE from 'three';

/** Shared placeholder material (spec: "no materials beyond a single shared placeholder
 * material" — real rendering, wireframe or otherwise, is chosen by the callers in this
 * phase's `svg.ts` and Phase 12's WebGL scene). */
const PLACEHOLDER_MATERIAL = new THREE.MeshStandardMaterial({ color: '#4a4ae0' });

const ARM_ANGLES_DEG = [45, 135, 225, 315];
const ARM_LENGTH = 0.42;

function mesh(geometry: THREE.BufferGeometry): THREE.Mesh {
  return new THREE.Mesh(geometry, PLACEHOLDER_MATERIAL);
}

/** One arm, its motor bell and its spinning prop, built already rotated and positioned
 * so `angleDeg` points it outward from the frame centre (X configuration, matching the
 * prototype's `armAngles`). */
function buildArm(angleDeg: number): THREE.Group {
  const rad = (angleDeg * Math.PI) / 180;
  const armGroup = new THREE.Group();
  armGroup.name = `arm-${angleDeg}`;
  armGroup.position.set(Math.cos(rad) * ARM_LENGTH, 0, Math.sin(rad) * ARM_LENGTH);
  armGroup.rotation.y = -rad;

  const arm = mesh(new THREE.BoxGeometry(ARM_LENGTH - 0.04, 0.04, 0.06));
  arm.position.set(-ARM_LENGTH / 2 + 0.02, 0, 0);
  arm.rotation.y = Math.PI / 2;
  armGroup.add(arm);

  const motor = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8));
  motor.position.set(0, 0.05, 0);
  armGroup.add(motor);

  const prop = new THREE.Group();
  prop.name = `prop-${angleDeg}`;
  prop.userData['prop'] = true;
  prop.position.set(0, 0.11, 0);

  const bladeA = mesh(new THREE.BoxGeometry(0.34, 0.006, 0.03));
  const bladeB = mesh(new THREE.BoxGeometry(0.34, 0.006, 0.03));
  bladeB.rotation.y = Math.PI / 2;
  prop.add(bladeA, bladeB);

  armGroup.add(prop);
  return armGroup;
}

/** Two antennas angled outward from the back of the frame — new geometry (the
 * prototype has none), sized to read as thin whips rather than structural parts. */
function buildAntennas(): THREE.Mesh[] {
  return [-1, 1].map((side) => {
    const antenna = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 8));
    antenna.name = `antenna-${side}`;
    // Stand the cylinder up along the back edge, then tip it outward and backward.
    antenna.position.set(side * 0.12, 0.08, -0.22);
    antenna.rotation.z = side * 0.35;
    antenna.rotation.x = -0.3;
    return antenna;
  });
}

/**
 * Assembles the ≈372-triangle FPV quadcopter: a frame plate, four X-configuration
 * arms each carrying a motor bell and a spinnable prop, a canopy, a forward-tilted
 * camera and two rear antennas. Pure and deterministic — every dimension is a literal,
 * so two calls produce identical geometry (Task 6.2's SVG determinism depends on this).
 */
export function buildDrone(): THREE.Group {
  const drone = new THREE.Group();
  drone.name = 'drone';

  const frame = mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5));
  frame.name = 'frame';
  drone.add(frame);

  for (const angle of ARM_ANGLES_DEG) {
    drone.add(buildArm(angle));
  }

  // Canopy: a small shaped box sitting proud of the frame's top face.
  const canopy = mesh(new THREE.BoxGeometry(0.22, 0.1, 0.28));
  canopy.name = 'canopy';
  canopy.position.set(0, 0.08, -0.02);
  drone.add(canopy);

  // Camera: forward of the canopy, pitched down/forward ~30deg, FPV racing style.
  const camera = mesh(new THREE.BoxGeometry(0.16, 0.16, 0.22));
  camera.name = 'camera';
  camera.position.set(0, 0.02, 0.3);
  // ~30deg forward pitch (spec: "FPV racing style"), steeper than the prototype's -0.35
  // rad camera-pod tilt since this phase's spec calls for approximately 30deg.
  camera.rotation.x = -0.52;
  drone.add(camera);

  for (const antenna of buildAntennas()) {
    drone.add(antenna);
  }

  // Recentre on the origin (spec: "roughly centred on the origin"). The frame/arms are
  // already origin-symmetric, but the canopy/camera sit forward and the antennas sit
  // back, so measure the true bounding box and shift the whole assembly by its centre
  // rather than trust the individual offsets to cancel out.
  const box = new THREE.Box3().setFromObject(drone);
  const center = box.getCenter(new THREE.Vector3());
  for (const child of drone.children) {
    child.position.sub(center);
  }

  return drone;
}
