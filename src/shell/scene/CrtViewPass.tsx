/* eslint-disable react-hooks/immutability -- three.js objects (uniforms, transforms, the
   renderer) are mutated in effects and frame callbacks by design; that is R3F's model. */
// The bracketed CRT pass (ticket 07 § The post-process finding). drei's `<View>` only sets
// viewport and scissor and calls `gl.render()`; it never binds a render target. So the
// pass brackets `View.Port` by `useFrame` priority instead of replacing it:
//
//   0.5   bind the offscreen target, clear it
//   1     the <View>s scissor-render into it, untouched (their default index)
//   10    unbind, RESET THE VIEWPORT, draw the fullscreen CRT quad
//
// Enabled iff `html[data-crt="on"]` (observed, so the taskbar's toggle takes effect live).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createCrtMaterial } from './crtShader';
import { cssVar } from './theme';

function crtOn(): boolean {
  return document.documentElement.dataset['crt'] === 'on';
}

export default function CrtViewPass() {
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);

  const [enabled, setEnabled] = useState(crtOn);
  // Both frame callbacks of one frame must agree, even if the attribute flips between
  // them: the bind at 0.5 records what the resolve at 10 must do.
  const boundRef = useRef(false);

  const target = useMemo(() => new THREE.WebGLRenderTarget(1, 1), []);
  const material = useMemo(() => createCrtMaterial(), []);
  const quadScene = useMemo(() => new THREE.Scene(), []);
  const quadCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  const quad = useMemo(() => new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material), [material]);

  useEffect(() => {
    quadScene.add(quad);
    return () => {
      quadScene.remove(quad);
      quad.geometry.dispose();
      material.dispose();
      target.dispose();
    };
  }, [quad, quadScene, material, target]);

  useEffect(() => {
    const observer = new MutationObserver(() => setEnabled(crtOn()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-crt'] });
    return () => observer.disconnect();
  }, []);

  // The target is in device pixels (drei's `setViewport` calls are multiplied by the
  // pixel ratio); a canvas resize or a DPR change both land here.
  useEffect(() => {
    const width = Math.max(1, Math.round(size.width * dpr));
    const height = Math.max(1, Math.round(size.height * dpr));
    target.setSize(width, height);
    material.uniforms['resolution']!.value = new THREE.Vector2(width, height);
    material.uniforms['scanPeriod']!.value = (parseFloat(cssVar('--scan-period')) || 3) * dpr;
  }, [size.width, size.height, dpr, target, material]);

  useEffect(() => {
    material.uniforms['scanAlpha']!.value = parseFloat(cssVar('--scan-alpha')) || 0.32;
  }, [material, enabled]);

  useFrame(() => {
    boundRef.current = enabled;
    if (!enabled) return;
    gl.setRenderTarget(target);
    gl.clear(true, true, true);
  }, 0.5);

  useFrame(() => {
    if (!boundRef.current) return;
    gl.setRenderTarget(null);
    // drei's `finishSkissor` turns the scissor test off but leaves the VIEWPORT on the
    // last view's rect; without this the composite is squashed into that rect.
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    material.uniforms['tDiffuse']!.value = target.texture;
    gl.render(quadScene, quadCamera);
  }, 10);

  return null;
}
