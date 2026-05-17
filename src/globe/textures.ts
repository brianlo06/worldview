import * as THREE from 'three'

export interface EarthTextures {
  day: THREE.Texture
  night: THREE.Texture
  specular: THREE.Texture
  normal: THREE.Texture
  clouds: THREE.Texture
}

const PATHS: Record<keyof EarthTextures, string> = {
  day: '/textures/earth_atmos_2048.jpg',
  night: '/textures/earth_lights_2048.png',
  specular: '/textures/earth_specular_2048.jpg',
  normal: '/textures/earth_normal_2048.jpg',
  clouds: '/textures/earth_clouds_1024.png',
}

export function loadEarthTextures(
  onProgress?: (loaded: number, total: number) => void,
): Promise<EarthTextures> {
  const loader = new THREE.TextureLoader()
  const entries = Object.entries(PATHS) as [keyof EarthTextures, string][]
  const total = entries.length
  let loaded = 0

  return Promise.all(
    entries.map(
      ([key, path]) =>
        new Promise<[keyof EarthTextures, THREE.Texture]>((resolve, reject) => {
          loader.load(
            path,
            (tex) => {
              loaded += 1
              onProgress?.(loaded, total)
              resolve([key, tex])
            },
            undefined,
            (err) => reject(err),
          )
        }),
    ),
  ).then((pairs) => {
    const result = {} as EarthTextures
    for (const [key, tex] of pairs) {
      result[key] = tex
    }
    result.day.colorSpace = THREE.SRGBColorSpace
    result.night.colorSpace = THREE.SRGBColorSpace
    result.specular.colorSpace = THREE.NoColorSpace
    result.normal.colorSpace = THREE.NoColorSpace
    result.clouds.colorSpace = THREE.NoColorSpace
    for (const t of Object.values(result) as THREE.Texture[]) {
      t.anisotropy = 8
    }
    return result
  })
}
