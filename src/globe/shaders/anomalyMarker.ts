export const anomalyMarkerVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  varying vec2 vLocal;

  void main() {
    vLocal = position.xy;
    // Instance origin in view space, then billboard-offset the quad
    vec4 origin = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec4 mvOrigin = viewMatrix * modelMatrix * origin;
    mvOrigin.xy += position.xy * uScale;
    gl_Position = projectionMatrix * mvOrigin;
  }
`

export const anomalyMarkerFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vLocal;
  uniform float uTime;
  uniform vec3  uColor;

  void main() {
    vec2 p = vLocal;             // already in [-0.5, 0.5]
    float r = length(p) * 2.0;   // 0 at center, 1 at edge
    if (r > 1.0) discard;

    // Three concentric sonar rings expanding outward at offset phases
    float total = 0.0;
    const float speed   = 0.32;
    const float ringW   = 0.055;
    for (int i = 0; i < 3; i++) {
      float phase = fract(uTime * speed + float(i) / 3.0);
      float ring  = smoothstep(phase - ringW, phase - ringW * 0.4, r)
                  - smoothstep(phase + ringW * 0.4, phase + ringW, r);
      // Newer (smaller-radius) rings are brighter; older rings fade
      float fade  = 1.0 - phase;
      total += ring * fade;
    }

    // Soft center glow so the marker is anchored visually
    float center = exp(-r * 5.5) * 0.55;
    total = max(total, center);

    if (total < 0.01) discard;
    vec3 col = uColor * (total * 1.4 + 0.3);
    gl_FragColor = vec4(col, total * 1.5);
  }
`
