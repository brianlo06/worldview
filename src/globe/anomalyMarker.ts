import * as THREE from 'three'
import { EARTH_RADIUS, latLonToVec3 } from './coords'
import {
  anomalyMarkerVertexShader,
  anomalyMarkerFragmentShader,
} from './shaders/anomalyMarker'

const MAX_ANOMALIES = 64

export interface AnomalyPin {
  lat: number
  lon: number
}

export interface AnomalyMarkerHandle {
  mesh: THREE.InstancedMesh
  setAnomalies(pins: AnomalyPin[]): void
  update(elapsed: number): void
}

export function createAnomalyMarkers(): AnomalyMarkerHandle {
  // Quad in [-0.5, 0.5] — the vertex shader handles billboarding.
  const geometry = new THREE.PlaneGeometry(1, 1)

  const uniforms = {
    uTime: { value: 0 },
    uScale: { value: 0.45 },          // ~30× a dot — unmistakable
    uColor: { value: new THREE.Color('#ff5a4a') },
  }

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: anomalyMarkerVertexShader,
    fragmentShader: anomalyMarkerFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  const mesh = new THREE.InstancedMesh(geometry, material, MAX_ANOMALIES)
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.renderOrder = 50  // draw after dots so it's visually on top
  mesh.name = 'anomaly-markers'

  const tmpMatrix = new THREE.Matrix4()
  const tmpQuat = new THREE.Quaternion()
  const tmpScale = new THREE.Vector3(1, 1, 1)

  function setAnomalies(pins: AnomalyPin[]) {
    const n = Math.min(pins.length, MAX_ANOMALIES)
    for (let i = 0; i < n; i++) {
      // Float well above the dot cloud (which sits near 1.012 radius)
      const p = latLonToVec3(pins[i].lat, pins[i].lon, EARTH_RADIUS * 1.05)
      tmpMatrix.compose(p, tmpQuat, tmpScale)
      mesh.setMatrixAt(i, tmpMatrix)
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
  }

  return {
    mesh,
    setAnomalies,
    update(elapsed) {
      uniforms.uTime.value = elapsed
    },
  }
}
