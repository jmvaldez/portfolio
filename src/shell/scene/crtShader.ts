// The canvas half of the CRT treatment (ticket 07 § The post-process finding; ticket 06's
// soft-edged scanline ramp). A fullscreen quad shader: cheap bloom, then scanlines matched
// to the DOM's `--scan-alpha` / `--scan-period` so the canvas reads as the same material
// as the chrome around it. Built per mount by `CrtViewPass` rather than at module scope —
// a module-level material is a Fast Refresh hazard (research 01, pitfall 6).
import * as THREE from 'three';

export function createCrtMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
      scanAlpha: { value: 0.32 },
      // In device pixels: `--scan-period` is CSS px, so the pass multiplies by DPR.
      scanPeriod: { value: 3 },
    },
    // Opaque overwrite of the (already transparent-cleared) canvas: the target's
    // premultiplied-style colour and alpha pass straight through.
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      uniform float scanAlpha;
      uniform float scanPeriod;
      varying vec2 vUv;

      void main() {
        vec4 base = texture2D(tDiffuse, vUv);

        // cheap bloom: a few offset taps, brighter pixels smear further
        vec2 px = 1.0 / resolution;
        vec4 bloom = base;
        bloom += texture2D(tDiffuse, vUv + vec2(px.x * 1.5, 0.0)) * 0.5;
        bloom += texture2D(tDiffuse, vUv - vec2(px.x * 1.5, 0.0)) * 0.5;
        bloom += texture2D(tDiffuse, vUv + vec2(0.0, px.y * 1.5)) * 0.5;
        bloom += texture2D(tDiffuse, vUv - vec2(0.0, px.y * 1.5)) * 0.5;
        bloom /= 3.0;
        vec3 color = max(base.rgb, bloom.rgb * 0.6);

        // Soft-edged bands matching the CSS ramp (transparent 0, dark at 34%,
        // transparent at 68%): a ramp, not a hard stop, so it cannot beat against
        // device pixels at fractional DPR (ticket 06).
        float y = mod(gl_FragCoord.y, scanPeriod) / scanPeriod;
        float band = smoothstep(0.0, 0.34, y) - smoothstep(0.34, 0.68, y);
        color *= (1.0 - scanAlpha * band);

        // The target holds premultiplied linear colour (blended in linear space); the
        // default framebuffer wants premultiplied sRGB. Encoding premultiplied values
        // directly would lift every translucent line (the fogged grid) too bright, so
        // un-premultiply, encode, premultiply again.
        float alpha = max(base.a, bloom.a * 0.6);
        gl_FragColor = vec4(color / max(alpha, 0.0001), alpha);
        #include <colorspace_fragment>
        gl_FragColor.rgb *= gl_FragColor.a;
      }
    `,
  });
}
