import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { latLonToVec3 } from './coords'

export interface ControlsHandle {
  controls: OrbitControls
  update(): void
  flyTo(lat: number, lon: number, distance?: number, durationMs?: number): void
  dispose(): void
}

export function createControls(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
): ControlsHandle {
  const controls = new OrbitControls(camera, domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.rotateSpeed = 0.4
  controls.zoomSpeed = 0.6
  controls.enablePan = false
  controls.minDistance = 1.4
  controls.maxDistance = 6.0
  controls.minPolarAngle = 0.05
  controls.maxPolarAngle = Math.PI - 0.05

  let tween: {
    start: number
    duration: number
    fromPos: THREE.Vector3
    toPos: THREE.Vector3
    fromTarget: THREE.Vector3
    toTarget: THREE.Vector3
  } | null = null

  function easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  function flyTo(lat: number, lon: number, distance = 2.2, durationMs = 1000) {
    const target = latLonToVec3(lat, lon, 1).normalize()
    const toPos = target.clone().multiplyScalar(distance)
    tween = {
      start: performance.now(),
      duration: durationMs,
      fromPos: camera.position.clone(),
      toPos,
      fromTarget: controls.target.clone(),
      toTarget: new THREE.Vector3(0, 0, 0),
    }
  }

  function update() {
    if (tween) {
      const t = Math.min(1, (performance.now() - tween.start) / tween.duration)
      const k = easeInOutCubic(t)
      camera.position.lerpVectors(tween.fromPos, tween.toPos, k)
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, k)
      if (t >= 1) tween = null
    }
    controls.update()
  }

  return {
    controls,
    update,
    flyTo,
    dispose: () => controls.dispose(),
  }
}
