export const scanLineShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uScanIntensity: { value: 0.07 },
    uScanFreq: { value: 700.0 },
    uChromaticAmt: { value: 0.0025 },
    uVignette: { value: 0.7 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uScanIntensity;
    uniform float uScanFreq;
    uniform float uChromaticAmt;
    uniform float uVignette;
    varying vec2 vUv;

    void main() {
      float dist = length(vUv - 0.5);

      // Chromatic aberration intensifying at the edges
      float ca = uChromaticAmt * (0.3 + dist);
      vec3 rgb;
      rgb.r = texture2D(tDiffuse, vUv + vec2(ca, 0.0)).r;
      rgb.g = texture2D(tDiffuse, vUv).g;
      rgb.b = texture2D(tDiffuse, vUv - vec2(ca, 0.0)).b;

      // Horizontal scan lines
      float scan = sin(vUv.y * uScanFreq + uTime * 1.5);
      rgb *= 1.0 - uScanIntensity * (0.5 - 0.5 * scan);

      // Vignette
      float v = smoothstep(1.0, 0.25, dist);
      rgb *= mix(1.0, v, uVignette);

      // Slight cyan lift in shadows for the HUD feel
      rgb = mix(rgb, rgb + vec3(0.0, 0.02, 0.04), 0.4);

      gl_FragColor = vec4(rgb, 1.0);
    }
  `,
}
