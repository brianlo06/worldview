// Briefing constellation: animated great-circle arcs connecting the story
// locations, drawn during the outro — "here's the whole picture" — then
// cleared with the soft reset. Arcs draw on point-by-point with a stagger,
// shimmer while alive, and sit just above the dot layer so the earth still
// occludes the far side.

import * as THREE from 'three'
import { EARTH_RADIUS, latLonToVec3 } from './coords'

export interface ConstellationHandle {
  set(points: { lat: number; lon: number }[] | null, elapsed: number): void
  update(elapsed: number): void
}

const SEGMENTS = 96
const ARC_DRAW_S = 1.1 // per-arc draw-on duration
const ARC_STAGGER_S = 0.5 // delay between consecutive arcs starting
const BASE_RADIUS = EARTH_RADIUS * 1.014
// Arc apex altitude scales with how far apart the endpoints are, capped so
// antipodal-ish hops don't leave the frame.
const PEAK_ALTITUDE = EARTH_RADIUS * 0.16

interface Arc {
  line: THREE.Line
  mat: THREE.LineBasicMaterial
  startAt: number
  count: number
}

function slerpUnit(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  const angle = a.angleTo(b)
  if (angle < 1e-4) return a.clone()
  const sin = Math.sin(angle)
  return a
    .clone()
    .multiplyScalar(Math.sin((1 - t) * angle) / sin)
    .add(b.clone().multiplyScalar(Math.sin(t * angle) / sin))
}

export function createConstellation(scene: THREE.Scene): ConstellationHandle {
  const group = new THREE.Group()
  group.name = 'constellation'
  scene.add(group)
  let arcs: Arc[] = []

  function clear() {
    for (const a of arcs) {
      a.line.geometry.dispose()
      a.mat.dispose()
    }
    group.clear()
    arcs = []
  }

  return {
    set(points, elapsed) {
      clear()
      if (!points || points.length < 2) return
      const units = points.map((p) =>
        latLonToVec3(p.lat, p.lon, 1).normalize(),
      )
      for (let i = 0; i < units.length - 1; i++) {
        const a = units[i]
        const b = units[i + 1]
        const angle = a.angleTo(b)
        if (angle < 1e-3) continue // co-located stories — no arc to draw
        const positions = new Float32Array((SEGMENTS + 1) * 3)
        for (let s = 0; s <= SEGMENTS; s++) {
          const t = s / SEGMENTS
          const v = slerpUnit(a, b, t)
          const alt =
            BASE_RADIUS +
            PEAK_ALTITUDE * Math.sin(Math.PI * t) * Math.min(1, angle / 1.4)
          v.multiplyScalar(alt)
          positions[s * 3] = v.x
          positions[s * 3 + 1] = v.y
          positions[s * 3 + 2] = v.z
        }
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setDrawRange(0, 0)
        const mat = new THREE.LineBasicMaterial({
          color: 0x7be0ff,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
        const line = new THREE.Line(geometry, mat)
        group.add(line)
        arcs.push({
          line,
          mat,
          startAt: elapsed + i * ARC_STAGGER_S,
          count: SEGMENTS + 1,
        })
      }
    },
    update(elapsed) {
      for (const a of arcs) {
        const t = (elapsed - a.startAt) / ARC_DRAW_S
        const drawn = t <= 0 ? 0 : t >= 1 ? a.count : Math.floor(t * a.count)
        ;(a.line.geometry as THREE.BufferGeometry).setDrawRange(0, drawn)
        // Shimmer once fully drawn; steady-bright while drawing on.
        a.mat.opacity =
          t < 1 ? 0.85 : 0.55 + 0.25 * Math.sin(elapsed * 2.4 + a.startAt * 7)
      }
    },
  }
}
