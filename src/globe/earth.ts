import * as THREE from 'three'
import { EARTH_RADIUS, computeSunDirection } from './coords'
import { earthVertexShader, earthFragmentShader } from './shaders/earth'
import type { EarthTextures } from './textures'

export interface EarthHandle {
  mesh: THREE.Mesh
  update(elapsed: number, now: Date): void
}

export function createEarth(textures: EarthTextures): EarthHandle {
  const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 128, 128)

  const uniforms = {
    uTime: { value: 0 },
    uSunDirection: { value: computeSunDirection() },
    uDayMap: { value: textures.day },
    uNightMap: { value: textures.night },
    uSpecularMap: { value: textures.specular },
    uNormalMap: { value: textures.normal },
    uColorRim: { value: new THREE.Color('#4cc9ff') },
    uColorGrid: { value: new THREE.Color('#7be0ff') },
    uGridStrength: { value: 0.18 },
    uHoloTint: { value: new THREE.Color('#cbe9ff') },
    uHoloTintStrength: { value: 0.18 },
  }

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: earthVertexShader,
    fragmentShader: earthFragmentShader,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'earth'

  return {
    mesh,
    update(elapsed, now) {
      uniforms.uTime.value = elapsed
      uniforms.uSunDirection.value.copy(computeSunDirection(now))
    },
  }
}
