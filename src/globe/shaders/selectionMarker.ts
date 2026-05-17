export const selectionMarkerVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying float vLock;
  uniform float uTime;
  uniform float uPlacedAt;

  void main() {
    vUv = uv;
    // 0 → 1 over 350ms after a target is set. Brackets zoom in from 1.6×
    // and fade in — Stark targeting-reticle lock-on.
    float age = uTime - uPlacedAt;
    vLock = clamp(age / 0.35, 0.0, 1.0);
    float scale = mix(1.6, 1.0, vLock * vLock); // ease-in
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position * scale, 1.0);
  }
`

export const selectionMarkerFragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  varying float vLock;
  uniform float uTime;
  uniform vec3  uColor;

  void main() {
    vec2 p = vUv - 0.5;

    // Subtle slow rotation
    float a = sin(uTime * 0.4) * 0.12;
    float c = cos(a), s = sin(a);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);

    vec2 ap = abs(p);
    float outer  = 0.45;
    float thick  = 0.025;
    float armLen = 0.16;

    float horizArm = step(outer - thick, ap.y) * step(ap.y, outer)
                   * step(outer - armLen, ap.x) * step(ap.x, outer);
    float vertArm  = step(outer - thick, ap.x) * step(ap.x, outer)
                   * step(outer - armLen, ap.y) * step(ap.y, outer);
    float bracket = clamp(horizArm + vertArm, 0.0, 1.0);

    // Inner thin ring
    float r = length(p);
    float ring = smoothstep(0.30, 0.295, r) - smoothstep(0.295, 0.29, r);

    // Pulse
    float pulse = 0.7 + 0.3 * sin(uTime * 5.0);

    float alpha = max(bracket, ring * 0.6) * pulse;
    vec3 col = uColor * (1.2 + 0.4 * pulse);

    // Ease in the lock — combined fade-in with the zoom-in from the vertex shader
    alpha *= vLock;
    col   *= mix(0.4, 1.0, vLock);

    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
  }
`
