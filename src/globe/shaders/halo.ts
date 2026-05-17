export const haloVertexShader = /* glsl */ `
  attribute float aPhase;
  attribute float aImportance;
  attribute vec3  aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uBaseSize;

  varying vec3  vColor;
  varying float vAlphaFactor;

  void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPos;

    float pulse = 0.65 + 0.35 * sin(uTime * 1.2 + aPhase);
    float sizePx = uBaseSize * mix(0.5, 1.6, aImportance) * pulse * uPixelRatio;
    gl_PointSize = sizePx / max(0.0001, -mvPos.z);

    vColor = aColor;
    vAlphaFactor = pulse * mix(0.18, 0.55, aImportance);
  }
`

export const haloFragmentShader = /* glsl */ `
  precision highp float;
  varying vec3  vColor;
  varying float vAlphaFactor;

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float r = length(p) * 2.0;
    if (r > 1.0) discard;

    float fall = exp(-r * 2.6);
    vec3 col = vColor * fall;
    gl_FragColor = vec4(col, fall * vAlphaFactor);
  }
`
