import * as THREE from 'three'
import { EARTH_RADIUS } from './coords'

export interface CloudsHandle {
  mesh: THREE.Mesh
  update(elapsed: number): void
}

export function createClouds(cloudTexture: THREE.Texture): CloudsHandle {
  const geometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.008, 64, 64)
  const material = new THREE.MeshLambertMaterial({
    map: cloudTexture,
    alphaMap: cloudTexture,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'clouds'

  return {
    mesh,
    update() {
      // Slow westward drift (Earth turns east relative to weather systems)
      mesh.rotation.y += 0.00015
    },
  }
}
