export const dotVertexShader = /* glsl */ `
  attribute float aPhase;
  attribute float aImportance;
  attribute vec3  aColor;
  uniform float uTime;
  uniform float uZoomFactor;

  varying float vPulse;
  varying vec3  vColor;
  varying vec3  vWorldPos;
  varying vec3  vWorldNormal;

  void main() {
    float pulse = 0.75 + 0.25 * sin(uTime * 2.0 + aPhase);
    float impScale = mix(0.55, 1.35, aImportance);
    vPulse = pulse;
    vColor = aColor;

    vec3 scaled = position * pulse * impScale * uZoomFactor;
    vec4 wp = modelMatrix * instanceMatrix * vec4(scaled, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

export const dotFragmentShader = /* glsl */ `
  precision highp float;

  varying float vPulse;
  varying vec3  vColor;
  varying vec3  vWorldPos;
  varying vec3  vWorldNormal;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float rim = 1.0 - max(dot(viewDir, vWorldNormal), 0.0);
    rim = pow(rim, 1.4);

    vec3 col = vColor * (1.0 + rim * 0.9) * vPulse;
    float alpha = (0.7 + rim * 0.4) * vPulse;
    gl_FragColor = vec4(col, alpha);
  }
`
