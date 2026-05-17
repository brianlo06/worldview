import * as THREE from 'three'
import { pulseVertexShader, pulseFragmentShader } from './shaders/pulse'

const POOL_SIZE = 64
const LIFETIME_SECONDS = 1.6
const MAX_RADIUS = 0.18

export interface PulsesHandle {
  mesh: THREE.InstancedMesh
  spawn(position: THREE.Vector3, color: THREE.Color, elapsed: number): void
  update(elapsed: number): void
}

export function createPulses(): PulsesHandle {
  const geometry = new THREE.PlaneGeometry(1, 1)
  const spawnArr = new Float32Array(POOL_SIZE).fill(-9999)
  const colorArr = new Float32Array(POOL_SIZE * 3)
  geometry.setAttribute(
    'aSpawnTime',
    new THREE.InstancedBufferAttribute(spawnArr, 1),
  )
  geometry.setAttribute(
    'aColor',
    new THREE.InstancedBufferAttribute(colorArr, 3),
  )

  const uniforms = {
    uTime: { value: 0 },
    uLifetime: { value: LIFETIME_SECONDS },
    uMaxRadius: { value: MAX_RADIUS },
  }

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: pulseVertexShader,
    fragmentShader: pulseFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  const mesh = new THREE.InstancedMesh(geometry, material, POOL_SIZE)
  mesh.count = POOL_SIZE
  mesh.frustumCulled = false
  mesh.name = 'pulses'

  const tmpMatrix = new THREE.Matrix4()
  const tmpQuat = new THREE.Quaternion()
  const tmpScale = new THREE.Vector3(1, 1, 1)

  let cursor = 0
  const spawnAttr = geometry.getAttribute('aSpawnTime') as THREE.InstancedBufferAttribute
  const colorAttr = geometry.getAttribute('aColor') as THREE.InstancedBufferAttribute

  function spawn(position: THREE.Vector3, color: THREE.Color, elapsed: number) {
    const slot = cursor
    cursor = (cursor + 1) % POOL_SIZE
    tmpMatrix.compose(position, tmpQuat, tmpScale)
    mesh.setMatrixAt(slot, tmpMatrix)
    spawnAttr.setX(slot, elapsed)
    colorAttr.setXYZ(slot, color.r, color.g, color.b)
    mesh.instanceMatrix.needsUpdate = true
    spawnAttr.needsUpdate = true
    colorAttr.needsUpdate = true
  }

  return {
    mesh,
    spawn,
    update(elapsed) {
      uniforms.uTime.value = elapsed
    },
  }
}
