import * as THREE from 'three'

export const EARTH_RADIUS = 1.0

export function latLonToVec3(
  lat: number,
  lon: number,
  radius: number = EARTH_RADIUS,
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

export function vec3ToLatLon(v: THREE.Vector3): { lat: number; lon: number } {
  const r = v.length()
  if (r === 0) return { lat: 0, lon: 0 }
  const lat = 90 - (Math.acos(v.y / r) * 180) / Math.PI
  const lon = ((Math.atan2(v.z, -v.x) * 180) / Math.PI) - 180
  return { lat, lon: ((lon + 540) % 360) - 180 }
}

export function computeSunDirection(date: Date = new Date()): THREE.Vector3 {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - start) / 86_400_000)
  const declination =
    23.45 * Math.sin(((360 / 365) * (dayOfYear - 81) * Math.PI) / 180)
  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const subsolarLon = -15 * (utcHours - 12)
  return latLonToVec3(declination, subsolarLon, 1).normalize()
}
