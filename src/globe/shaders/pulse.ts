export const pulseVertexShader = /* glsl */ `
  attribute float aSpawnTime;
  attribute vec3  aColor;
  uniform float uTime;
  uniform float uLifetime;
  uniform float uMaxRadius;

  varying vec2  vUv;
  varying float vAge;
  varying vec3  vColor;

  void main() {
    vUv = uv;
    vColor = aColor;
    vAge = (uTime - aSpawnTime) / uLifetime;

    // Inactive slots (very negative spawn time) collapse to nothing
    if (aSpawnTime < -100.0 || vAge > 1.0 || vAge < 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // off-screen
      return;
    }

    // Instance origin in world space
    vec4 origin = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec4 originView = viewMatrix * modelMatrix * origin;

    // Quad grows outward as age advances. Quad must be big enough for the ring.
    float scale = mix(0.04, uMaxRadius, vAge);
    originView.xy += position.xy * scale;

    gl_Position = projectionMatrix * originView;
  }
`

export const pulseFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2  vUv;
  varying float vAge;
  varying vec3  vColor;

  void main() {
    if (vAge > 1.0 || vAge < 0.0) discard;

    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    if (r > 1.0) discard;

    // A ring centered at the expanding radius (which itself maps from 0 to 1)
    float ringR = vAge;
    float ringW = 0.10;
    float ring =
      smoothstep(ringR - ringW, ringR - ringW * 0.4, r) -
      smoothstep(ringR + ringW * 0.4, ringR + ringW, r);

    float fade = 1.0 - vAge;
    float alpha = ring * fade;
    if (alpha < 0.01) discard;

    gl_FragColor = vec4(vColor * (1.0 + fade), alpha);
  }
`
