// The build-time drone SVG (ticket 11 § "The 3D layer, without the island"): a fixed
// three-quarter wireframe of the same procedural geometry `viewer.exe` orbits in
// Phase 12, so the linear layout, the no-JS document and the crawler all draw from one
// source instead of a second hand-drawn asset that could drift from it.
//
// This runs only at build time (`.astro` frontmatter, ticket-19 budget row: drone SVG
// ≤ 15 KB), so bytes and determinism matter more than runtime cost: every dimension is
// a literal, there is no `Math.random()` or `Date.now()` anywhere in this file or in
// `geometry.ts`, and coordinates are rounded to keep the output small.
import * as THREE from 'three';
import { buildDrone } from './geometry';

/** Matches drei's `<Edges>` default threshold (ticket 03/07's hazard: `<Edges>`, not
 * `LineBasicMaterial`, is how the wireframe survives — but this is a static build-time
 * projection, not a WebGL line, so this constant is only about matching the *look*). */
const EDGE_THRESHOLD_DEGREES = 15;

/** Fixed three-quarter view (ticket 11: "a fixed three-quarter angle"). */
const CAMERA_AZIMUTH_DEGREES = 35;
const CAMERA_ELEVATION_DEGREES = 22;
const CAMERA_FOV_DEGREES = 40;
const FIT_MARGIN = 1.15;

const COORDINATE_PRECISION = 1;

export interface RenderDroneSvgOptions {
  width: number;
  height: number;
  /** Stroke width in SVG user units. Colour is always `currentColor` (never a param)
   * so a caller's CSS custom properties/tokens colour the wireframe via inheritance. */
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

/** A camera fixed at the given spherical offset from the origin, backed off far enough
 * that `bounds`'s bounding sphere fits inside `width`x`height` with margin. */
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

/** NDC (`Vector3.project`'s output, y-up, [-1, 1]) to SVG pixel space (y-down). */
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
 * Renders the procedural drone as a single-path SVG wireframe, viewed from a fixed
 * three-quarter angle. Deterministic: identical `options` always produce byte-identical
 * output (Task 6.2's test relies on this), since neither this function nor `buildDrone`
 * reads the clock or a random source.
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
