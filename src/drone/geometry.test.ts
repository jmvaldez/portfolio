import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildDrone } from './geometry';

/** Triangle count of a geometry, whether or not it is indexed. */
function triangleCount(geometry: THREE.BufferGeometry): number {
  const count = geometry.index?.count ?? geometry.attributes['position']!.count;
  return count / 3;
}

describe('buildDrone', () => {
  it('assembles roughly the ~388-triangle FPV quad the map settled on', () => {
    const drone = buildDrone();
    let total = 0;
    drone.traverse((child) => {
      // `instanceof` on the generic `THREE.Mesh` narrows to `Mesh<any, ...>`, so cast to
      // recover the real geometry type.
      if (child instanceof THREE.Mesh) {
        const mesh = child as THREE.Mesh<THREE.BufferGeometry>;
        total += triangleCount(mesh.geometry);
      }
    });
    expect(total).toBeGreaterThanOrEqual(350);
    expect(total).toBeLessThanOrEqual(430);
  });

  it('tags exactly four spinnable propeller groups', () => {
    const drone = buildDrone();
    let props = 0;
    drone.traverse((child) => {
      if (child.userData['prop'] === true) props += 1;
    });
    expect(props).toBe(4);
  });

  it('is roughly centred on the origin', () => {
    const drone = buildDrone();
    const box = new THREE.Box3().setFromObject(drone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y, size.z);
    // Only needs to be roughly centred relative to the model's own size.
    const tolerance = span * 0.1;
    expect(Math.abs(center.x)).toBeLessThan(tolerance);
    expect(Math.abs(center.y)).toBeLessThan(tolerance);
    expect(Math.abs(center.z)).toBeLessThan(tolerance);
  });
});
