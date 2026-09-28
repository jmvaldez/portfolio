// Build-time wireframe SVG of the same procedural geometry `viewer.exe` orbits, from a
// fixed three-quarter view, so the linear layout, the no-JS page, and crawlers share one
// source. Output must be small (drone SVG <= 15 KB) and deterministic: no clock or random
// source is used here or in `geometry.ts`, and coordinates are rounded.
import * as THREE from 'three';
import { buildDrone } from './geometry';

/** Edge-detection angle, matching drei's `<Edges>` default so the look matches. */
const EDGE_THRESHOLD_DEGREES = 15;

/** Fixed three-quarter camera view. */
const CAMERA_AZIMUTH_DEGREES = 35;
const CAMERA_ELEVATION_DEGREES = 22;
const CAMERA_FOV_DEGREES = 40;
const FIT_MARGIN = 1.15;

const COORDINATE_PRECISION = 1;

export interface RenderDroneSvgOptions {
  width: number;
  height: number;
  /** Stroke width in SVG user units. Colour is always `currentColor`, so callers colour
   * the wireframe through CSS inheritance. */
  stroke?: number;
}

interface Segment {
  a: THREE.Vector2;
  b: THREE.Vector2;
}

function round(n: number): number {
  const factor = 10 ** COORDINATE_PRECISION;
  return Math.round(n * factor) / factor;
}

/** Every mesh's edges, in world space, as one flat list of line segments. */
function worldEdgeSegments(drone: THREE.Group): { a: THREE.Vector3; b: THREE.Vector3 }[] {
  const segments: { a: THREE.Vector3; b: THREE.Vector3 }[] = [];

  drone.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    child.updateWorldMatrix(true, false);
    const edges = new THREE.EdgesGeometry(child.geometry, EDGE_THRESHOLD_DEGREES);
    const position = edges.attributes['position'];
    if (!position) return;

    for (let i = 0; i < position.count; i += 2) {
      const a = new THREE.Vector3()
        .fromBufferAttribute(position, i)
        .applyMatrix4(child.matrixWorld);
      const b = new THREE.Vector3()
        .fromBufferAttribute(position, i + 1)
        .applyMatrix4(child.matrixWorld);
      segments.push({ a, b });
    }

    edges.dispose();
  });

  return segments;
}

/** A camera at the fixed view angle, backed off until `bounds`'s bounding sphere fits
 * inside `width` by `height` with margin. */
function buildFittedCamera(
  bounds: THREE.Box3,
  width: number,
  height: number,
): THREE.PerspectiveCamera {
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const aspect = width / height;

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEGREES, aspect, 0.01, 1000);

  const halfVertical = Math.tan((CAMERA_FOV_DEGREES * Math.PI) / 180 / 2);
  const halfHorizontal = halfVertical * aspect;
  // The tighter of the two axes is what a sphere of `sphere.radius` must clear.
  const limitingHalfAngle = Math.min(halfVertical, halfHorizontal);
  const distance = (sphere.radius / limitingHalfAngle) * FIT_MARGIN;

  const azimuth = (CAMERA_AZIMUTH_DEGREES * Math.PI) / 180;
  const elevation = (CAMERA_ELEVATION_DEGREES * Math.PI) / 180;
  camera.position.set(
    sphere.center.x + distance * Math.cos(elevation) * Math.sin(azimuth),
    sphere.center.y + distance * Math.sin(elevation),
    sphere.center.z + distance * Math.cos(elevation) * Math.cos(azimuth),
  );
  camera.far = distance * 10;
  camera.lookAt(sphere.center);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  return camera;
}

/** Converts NDC (y-up, [-1, 1]) to SVG pixel space (y-down). */
function toPixel(
  point: THREE.Vector3,
  camera: THREE.Camera,
  width: number,
  height: number,
): THREE.Vector2 {
  const ndc = point.clone().project(camera);
  return new THREE.Vector2(round(((ndc.x + 1) / 2) * width), round(((1 - ndc.y) / 2) * height));
}

function projectSegments(
  segments: { a: THREE.Vector3; b: THREE.Vector3 }[],
  camera: THREE.Camera,
  width: number,
  height: number,
): Segment[] {
  return segments.map(({ a, b }) => ({
    a: toPixel(a, camera, width, height),
    b: toPixel(b, camera, width, height),
  }));
}

function pathData(segments: Segment[]): string {
  return segments.map((s) => `M${s.a.x},${s.a.y} L${s.b.x},${s.b.y}`).join(' ');
}

/**
 * Renders the procedural drone as a single-path SVG wireframe from a fixed three-quarter
 * angle. Deterministic: identical `options` produce byte-identical output.
 */
export function renderDroneSvg({ width, height, stroke = 1.5 }: RenderDroneSvgOptions): string {
  const drone = buildDrone();
  const bounds = new THREE.Box3().setFromObject(drone);
  const camera = buildFittedCamera(bounds, width, height);

  const worldSegments = worldEdgeSegments(drone);
  const pixelSegments = projectSegments(worldSegments, camera, width, height);
  const d = pathData(pixelSegments);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}" role="img">` +
    `<title>Wireframe model of a 5-inch FPV quadcopter</title>` +
    `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${stroke}" ` +
    `stroke-linecap="round" vector-effect="non-scaling-stroke"/>` +
    `</svg>`
  );
}
