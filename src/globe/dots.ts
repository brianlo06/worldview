import * as THREE from 'three'
import { EARTH_RADIUS, latLonToVec3 } from './coords'
import { dotVertexShader, dotFragmentShader } from './shaders/dot'
import { colorFor } from './colorFor'
import type { Category } from './categories'

export interface DotRecord {
  id: string
  lat: number
  lon: number
  title: string
  importance?: number
  category?: Category
  breaking?: boolean
  summary?: string | null
  imageUrl?: string | null
  url?: string | null
  sourceOutlet?: string | null
  occurredAt?: string | null
  /** Hex color override that wins over the category color. Used by markets. */
  color?: string | null
  /** Number of source articles in this cluster (clusters only). */
  eventCount?: number | null
  /** ISO 3166-1 alpha-2 country code (e.g. "US", "DE"). */
  countryCode?: string | null
  /** City / locality name from GKG, when known. */
  city?: string | null
  /** How precise the coordinate actually is — drives a dimmed render for
   * country-centroid dots so they don't look like real point events. */
  geoPrecision?: 'point' | 'city' | 'state' | 'country' | null
}

export interface DotsHandle {
  mesh: THREE.InstancedMesh
  setDots(records: DotRecord[]): void
  records(): DotRecord[]
  positionAt(instanceId: number): THREE.Vector3 | null
  update(elapsed: number): void
}

const MAX_DOTS = 50_000

export function createDots(): DotsHandle {
  const geometry = new THREE.SphereGeometry(0.014, 10, 10)
  geometry.setAttribute(
    'aPhase',
    new THREE.InstancedBufferAttribute(new Float32Array(MAX_DOTS), 1),
  )
  geometry.setAttribute(
    'aImportance',
    new THREE.InstancedBufferAttribute(new Float32Array(MAX_DOTS), 1),
  )
  geometry.setAttribute(
    'aColor',
    new THREE.InstancedBufferAttribute(new Float32Array(MAX_DOTS * 3), 3),
  )

  const uniforms = {
    uTime: { value: 0 },
  }

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: dotVertexShader,
    fragmentShader: dotFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  const mesh = new THREE.InstancedMesh(geometry, material, MAX_DOTS)
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.name = 'dots'

  let current: DotRecord[] = []
  const tmpMatrix = new THREE.Matrix4()
  const tmpScale = new THREE.Vector3(1, 1, 1)
  const tmpQuat = new THREE.Quaternion()
  const positions: THREE.Vector3[] = []

  function setDots(records: DotRecord[]) {
    current = records.slice(0, MAX_DOTS)
    positions.length = 0
    const phaseAttr = geometry.getAttribute('aPhase') as THREE.InstancedBufferAttribute
    const impAttr = geometry.getAttribute('aImportance') as THREE.InstancedBufferAttribute
    const colorAttr = geometry.getAttribute('aColor') as THREE.InstancedBufferAttribute

    for (let i = 0; i < current.length; i++) {
      const r = current[i]
      const p = latLonToVec3(r.lat, r.lon, EARTH_RADIUS * 1.012)
      positions.push(p.clone())
      tmpMatrix.compose(p, tmpQuat, tmpScale)
      mesh.setMatrixAt(i, tmpMatrix)
      phaseAttr.setX(i, Math.random() * Math.PI * 2)
      // Country-precision dots are at the country centroid — visually de-
      // emphasise them so they don't look like real point events. Shrink to
      // ~55% size by scaling the importance attribute the shader uses, and
      // halve the color brightness.
      const isApprox = r.geoPrecision === 'country'
      const imp = (r.importance ?? 0.5) * (isApprox ? 0.55 : 1.0)
      impAttr.setX(i, imp)
      const c = r.color ? new THREE.Color(r.color) : colorFor(r.category)
      if (isApprox) c.multiplyScalar(0.5)
      colorAttr.setXYZ(i, c.r, c.g, c.b)
    }
    mesh.count = current.length
    mesh.instanceMatrix.needsUpdate = true
    phaseAttr.needsUpdate = true
    impAttr.needsUpdate = true
    colorAttr.needsUpdate = true
  }

  return {
    mesh,
    setDots,
    records: () => current,
    positionAt: (id) => positions[id]?.clone() ?? null,
    update(elapsed) {
      uniforms.uTime.value = elapsed
    },
  }
}
