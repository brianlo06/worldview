import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export interface TourHandle {
  setEnabled(b: boolean): void
  isEnabled(): boolean
  /** Called every frame with the dt in seconds. */
  step(dt: number): void
  /** Hint that the user just interacted; tour pauses briefly. */
  bump(): void
}

const RESUME_AFTER_MS = 3000
const ANGULAR_SPEED = 0.06 // radians/second

export function createTour(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
): TourHandle {
  let enabled = false
  let pausedUntil = 0
  const spherical = new THREE.Spherical()

  // Pause whenever OrbitControls reports user input
  controls.addEventListener('start', () => {
    pausedUntil = performance.now() + RESUME_AFTER_MS
  })
  controls.addEventListener('end', () => {
    pausedUntil = performance.now() + RESUME_AFTER_MS
  })

  function step(dt: number) {
    if (!enabled) return
    if (performance.now() < pausedUntil) return
    spherical.setFromVector3(camera.position.clone().sub(controls.target))
    spherical.theta += ANGULAR_SPEED * dt
    const v = new THREE.Vector3().setFromSpherical(spherical).add(controls.target)
    camera.position.copy(v)
  }

  return {
    setEnabled(b) {
      enabled = b
      if (b) pausedUntil = 0
    },
    isEnabled: () => enabled,
    step,
    bump() {
      pausedUntil = performance.now() + RESUME_AFTER_MS
    },
  }
}
