import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { scanLineShader } from './shaders/scanLine'

export interface PostProcessHandle {
  composer: EffectComposer
  setSize(w: number, h: number): void
  update(elapsed: number): void
}

export function createPostProcess(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
): PostProcessHandle {
  const composer = new EffectComposer(renderer)
  composer.setSize(width, height)

  composer.addPass(new RenderPass(scene, camera))

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    0.5,   // strength
    0.45,  // radius
    0.78,  // threshold
  )
  composer.addPass(bloom)

  const scan = new ShaderPass(scanLineShader)
  composer.addPass(scan)

  composer.addPass(new OutputPass())

  return {
    composer,
    setSize(w, h) {
      composer.setSize(w, h)
      bloom.setSize(w, h)
    },
    update(elapsed) {
      scan.uniforms.uTime.value = elapsed
    },
  }
}
