export const earthVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

export const earthFragmentShader = /* glsl */ `
  precision highp float;

  uniform float     uTime;
  uniform vec3      uSunDirection;
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uSpecularMap;
  uniform sampler2D uNormalMap;
  uniform vec3      uColorRim;
  uniform vec3      uColorGrid;
  uniform float     uGridStrength;
  uniform vec3      uHoloTint;
  uniform float     uHoloTintStrength;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  // Screen-space tangent reconstruction (no precomputed tangents needed)
  vec3 perturbNormal(vec3 wn, sampler2D nMap, vec2 uv, vec3 wp) {
    vec2 dx = dFdx(uv);
    vec2 dy = dFdy(uv);
    vec3 dpx = dFdx(wp);
    vec3 dpy = dFdy(wp);
    vec3 t = normalize(dpx * dy.y - dpy * dx.y);
    vec3 b = -normalize(cross(wn, t));
    mat3 tbn = mat3(t, b, wn);
    vec3 ns = texture2D(nMap, uv).xyz * 2.0 - 1.0;
    ns.xy *= 0.4;
    return normalize(tbn * ns);
  }

  void main() {
    vec3 n   = normalize(vWorldNormal);
    vec3 nn  = perturbNormal(n, uNormalMap, vUv, vWorldPos);
    vec3 sun = normalize(uSunDirection);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    vec3 dayColor   = texture2D(uDayMap, vUv).rgb;
    vec3 nightColor = texture2D(uNightMap, vUv).rgb;
    float specMask  = texture2D(uSpecularMap, vUv).r;

    float lambert = dot(nn, sun);
    float terminator = smoothstep(-0.18, 0.28, lambert);

    // Brighten city lights slightly so they read on the night side
    vec3 base = mix(nightColor * 1.8, dayColor * (0.3 + 0.7 * terminator), terminator);

    // Ocean specular highlight
    vec3 r = reflect(-sun, nn);
    float spec = pow(max(dot(r, viewDir), 0.0), 28.0);
    base += vec3(1.0, 0.92, 0.7) * spec * specMask * terminator * 0.55;

    // Holographic cyan tint
    base = mix(base, base * uHoloTint, uHoloTintStrength);

    // Rim glow (Fresnel)
    float rim = 1.0 - max(dot(viewDir, n), 0.0);
    rim = pow(rim, 2.5);
    base += uColorRim * rim * 0.45;

    // 15° lat/lon grid overlay
    float lonBand = abs(fract(vUv.x * 24.0) - 0.5);
    float latBand = abs(fract(vUv.y * 12.0) - 0.5);
    float grid = smoothstep(0.485, 0.5, max(lonBand, latBand));
    base += uColorGrid * grid * uGridStrength * (0.5 + 0.5 * terminator);

    gl_FragColor = vec4(base, 1.0);
  }
`
