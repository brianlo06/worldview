export const atmosphereVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

export const atmosphereFragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3  uColor;
  uniform float uIntensity;
  uniform float uPower;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    // BackSide rendering: normals point outward; high dot near rim, low near center
    float rim = pow(1.0 - abs(dot(viewDir, vWorldNormal)), uPower);
    vec3 color = uColor * rim * uIntensity;
    gl_FragColor = vec4(color, rim);
  }
`
