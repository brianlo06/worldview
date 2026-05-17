import * as THREE from 'three'
import { EARTH_RADIUS, latLonToVec3 } from './coords'

export function createGrid(): THREE.LineSegments {
  const positions: number[] = []
  const r = EARTH_RADIUS * 1.001

  // Parallels every 15° latitude
  for (let lat = -75; lat <= 75; lat += 15) {
    for (let lon = -180; lon < 180; lon += 2) {
      const a = latLonToVec3(lat, lon, r)
      const b = latLonToVec3(lat, lon + 2, r)
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }
  }

  // Meridians every 15° longitude
  for (let lon = -180; lon < 180; lon += 15) {
    for (let lat = -90; lat < 90; lat += 2) {
      const a = latLonToVec3(lat, lon, r)
      const b = latLonToVec3(lat + 2, lon, r)
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )

  const material = new THREE.LineBasicMaterial({
    color: 0x4cc9ff,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  })

  const lines = new THREE.LineSegments(geometry, material)
  lines.name = 'grid'
  return lines
}
