import * as THREE from 'three'
import { EARTH_RADIUS, latLonToVec3 } from './coords'

interface Feature {
  type: 'Feature'
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] }
    | { type: string; coordinates: unknown }
  properties: Record<string, unknown>
}

interface FeatureCollection {
  type: 'FeatureCollection'
  features: Feature[]
}

export async function createBorders(): Promise<THREE.LineSegments> {
  const res = await fetch('/data/countries-110m.json')
  if (!res.ok) throw new Error(`Failed to load borders: ${res.status}`)
  const data = (await res.json()) as FeatureCollection

  const positions: number[] = []
  const r = EARTH_RADIUS * 1.0017

  function addRing(ring: number[][]) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i]
      const b = ring[i + 1]
      const va = latLonToVec3(a[1], a[0], r)
      const vb = latLonToVec3(b[1], b[0], r)
      positions.push(va.x, va.y, va.z, vb.x, vb.y, vb.z)
    }
  }

  for (const f of data.features) {
    const g = f.geometry
    if (g.type === 'Polygon') {
      for (const ring of g.coordinates as number[][][]) addRing(ring)
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates as number[][][][]) {
        for (const ring of poly) addRing(ring)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  const material = new THREE.LineBasicMaterial({
    color: 0x6ad5ff,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const lines = new THREE.LineSegments(geometry, material)
  lines.name = 'borders'
  return lines
}
