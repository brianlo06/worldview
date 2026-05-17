import * as THREE from 'three'
import { EARTH_RADIUS, latLonToVec3 } from './coords'
import { haloVertexShader, haloFragmentShader } from './shaders/halo'
import { colorFor } from './colorFor'
import type { DotRecord } from './dots'

const MAX_HALOS = 5_000
const IMPORTANCE_THRESHOLD = 0.6

export interface HalosHandle {
  points: THREE.Points
  setDots(records: DotRecord[]): void
  update(elapsed: number, pixelRatio: number): void
}

export function createHalos(): HalosHandle {
  const positions = new Float32Array(MAX_HALOS * 3)
  const phases = new Float32Array(MAX_HALOS)
  const importance = new Float32Array(MAX_HALOS)
  const colors = new Float32Array(MAX_HALOS * 3)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1))
  geometry.setAttribute(
    'aImportance',
    new THREE.Float32BufferAttribute(importance, 1),
  )
  geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setDrawRange(0, 0)

  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: window.devicePixelRatio },
    uBaseSize: { value: 64.0 },
  }

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: haloVertexShader,
    fragmentShader: haloFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  points.name = 'halos'

  function setDots(records: DotRecord[]) {
    let n = 0
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    const phaseAttr = geometry.getAttribute('aPhase') as THREE.BufferAttribute
    const impAttr = geometry.getAttribute('aImportance') as THREE.BufferAttribute
    const colorAttr = geometry.getAttribute('aColor') as THREE.BufferAttribute

    for (const r of records) {
      if ((r.importance ?? 0) < IMPORTANCE_THRESHOLD && !r.breaking) continue
      // Don't halo country-centroid dots — they're approximate locations and
      // a big bloom around a wrong-but-confident point reads as misleading.
      if (r.geoPrecision === 'country') continue
      if (n >= MAX_HALOS) break
      const p = latLonToVec3(r.lat, r.lon, EARTH_RADIUS * 1.013)
      posAttr.setXYZ(n, p.x, p.y, p.z)
      phaseAttr.setX(n, Math.random() * Math.PI * 2)
      impAttr.setX(n, r.importance ?? 0.7)
      const c = r.color ? new THREE.Color(r.color) : colorFor(r.category)
      colorAttr.setXYZ(n, c.r, c.g, c.b)
      n++
    }
    geometry.setDrawRange(0, n)
    posAttr.needsUpdate = true
    phaseAttr.needsUpdate = true
    impAttr.needsUpdate = true
    colorAttr.needsUpdate = true
  }

  return {
    points,
    setDots,
    update(elapsed, pixelRatio) {
      uniforms.uTime.value = elapsed
      uniforms.uPixelRatio.value = pixelRatio
    },
  }
}
