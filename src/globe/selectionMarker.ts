import * as THREE from 'three'
import {
  selectionMarkerVertexShader,
  selectionMarkerFragmentShader,
} from './shaders/selectionMarker'

export interface SelectionMarkerHandle {
  mesh: THREE.Mesh
  setTarget(pos: THREE.Vector3 | null, elapsed?: number): void
  update(elapsed: number, camera: THREE.Camera): void
}

export function createSelectionMarker(): SelectionMarkerHandle {
  const geometry = new THREE.PlaneGeometry(0.12, 0.12)
  const uniforms = {
    uTime: { value: 0 },
    uPlacedAt: { value: -10 }, // far in the past — past the lock animation window
    uColor: { value: new THREE.Color('#7be0ff') },
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: selectionMarkerVertexShader,
    fragmentShader: selectionMarkerFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.visible = false
  mesh.renderOrder = 999
  mesh.name = 'selection-marker'

  return {
    mesh,
    setTarget(pos, elapsed) {
      if (pos) {
        // Push slightly outward along the surface normal so the bracket
        // sits in front of the dot rather than intersecting the surface.
        const dir = pos.clone().normalize()
        mesh.position.copy(dir.multiplyScalar(pos.length() * 1.02))
        mesh.visible = true
        // Stamp the placement time so the shader can run the lock-in animation.
        // Fall back to current uTime if caller didn't pass one.
        uniforms.uPlacedAt.value = elapsed ?? uniforms.uTime.value
      } else {
        mesh.visible = false
      }
    },
    update(elapsed, camera) {
      uniforms.uTime.value = elapsed
      if (mesh.visible) {
        mesh.lookAt(camera.position)
      }
    },
  }
}
