// Procedural FPV quad built from three.js primitives, so there is no asset, loader, or
// licence to carry. Returns plain geometry with no animation; callers spin the prop
// groups themselves by finding `userData.prop === true`. Total is about 372 triangles.
import * as THREE from 'three';

/** Single material shared by every part; callers choose how it is rendered. */
const PLACEHOLDER_MATERIAL = new THREE.MeshStandardMaterial({ color: '#4a4ae0' });

const ARM_ANGLES_DEG = [45, 135, 225, 315];
const ARM_LENGTH = 0.42;

function mesh(geometry: THREE.BufferGeometry): THREE.Mesh {
  return new THREE.Mesh(geometry, PLACEHOLDER_MATERIAL);
}

/** One arm with its motor bell and prop, positioned so `angleDeg` points it outward
 * from the frame centre (X configuration). */
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

/** Two thin antennas angled outward from the back of the frame. */
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
 * Assembles the FPV quadcopter: a frame plate, four X-configuration arms each with a
 * motor bell and a spinnable prop, a canopy, a forward-tilted camera, and two rear
 * antennas, centred on the origin. Deterministic: every dimension is a literal, so two
 * calls produce identical geometry.
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

  // Canopy sits proud of the frame's top face.
  const canopy = mesh(new THREE.BoxGeometry(0.22, 0.1, 0.28));
  canopy.name = 'canopy';
  canopy.position.set(0, 0.08, -0.02);
  drone.add(canopy);

  // Camera sits forward of the canopy.
  const camera = mesh(new THREE.BoxGeometry(0.16, 0.16, 0.22));
  camera.name = 'camera';
  camera.position.set(0, 0.02, 0.3);
  // Pitched about 30 degrees down and forward.
  camera.rotation.x = -0.52;
  drone.add(camera);

  for (const antenna of buildAntennas()) {
    drone.add(antenna);
  }

  // Recentre on the bounding box: the canopy and camera sit forward and the antennas
  // back, so the individual offsets don't cancel out.
  const box = new THREE.Box3().setFromObject(drone);
  const center = box.getCenter(new THREE.Vector3());
  for (const child of drone.children) {
    child.position.sub(center);
  }

  return drone;
}
