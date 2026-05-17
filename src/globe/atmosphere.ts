import * as THREE from 'three'
import { EARTH_RADIUS } from './coords'
import {
  atmosphereVertexShader,
  atmosphereFragmentShader,
} from './shaders/atmosphere'

export function createAtmosphere(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.06, 64, 64)

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#4cc9ff') },
      uIntensity: { value: 1.4 },
      uPower: { value: 3.0 },
    },
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'atmosphere'
  return mesh
}
