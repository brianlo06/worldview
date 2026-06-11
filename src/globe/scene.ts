import * as THREE from 'three'
import { createEarth } from './earth'
import { createAtmosphere } from './atmosphere'
import { createGrid } from './grid'
import { createDots, type DotRecord } from './dots'
import { createClouds } from './clouds'
import { createSelectionMarker } from './selectionMarker'
import { createControls } from './controls'
import { createPostProcess } from './postprocess'
import { createAnomalyMarkers, type AnomalyPin } from './anomalyMarker'
import { createBorders } from './borders'
import { createHalos } from './halos'
import { createPulses } from './pulses'
import { createTour } from './tour'
import { colorFor } from './colorFor'
import type { EarthTextures } from './textures'
import { EARTH_RADIUS, computeSunDirection, latLonToVec3, vec3ToLatLon } from './coords'
import { createConstellation } from './constellation'
import { audio } from '../audio/audio'

export interface SceneHandle {
  dispose(): void
  setDots(records: DotRecord[]): void
  onPick(handler: (record: DotRecord | null) => void): void
  flyTo(
    lat: number,
    lon: number,
    durationMs?: number,
    opts?: { distance?: number; marker?: boolean },
  ): void
  setTourMode(b: boolean): void
  setAutoPulse(b: boolean): void
  spawnBreakingPulse(record?: DotRecord): void
  /** Spawn a pulse at an arbitrary lat/lon — used by anomaly visualization. */
  spawnPulseAt(lat: number, lon: number, color?: string): void
  /** Set the active anomalies — renders sonar-ring markers floating above. */
  setAnomalyPins(pins: AnomalyPin[]): void
  /** Draw (or clear, with null) the briefing constellation — animated arcs
   *  connecting the narrated story locations. */
  setConstellation(points: { lat: number; lon: number }[] | null): void
}

export interface CameraTelemetry {
  lat: number
  lon: number
  altitude: number
  azimuth: number
  fps: number
}

export interface SceneOptions {
  textures: EarthTextures
  initialDots?: DotRecord[]
  /** Start tour mode silently on init — used so we don't whoosh twice right
   *  after the boot screen dismisses (which already plays one). */
  initialTourMode?: boolean
  /** Receives camera lat/lon/alt/azimuth/fps at ~10 Hz. */
  onTelemetry?: (t: CameraTelemetry) => void
}

export function createScene(
  container: HTMLElement,
  options: SceneOptions,
): SceneHandle {
  const {
    textures,
    initialDots = [],
    initialTourMode = false,
    onTelemetry,
  } = options

  // Renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setClearColor(0x02040a, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  container.appendChild(renderer.domElement)

  // Scene + camera
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    100,
  )
  // Cinematic Stark angle: slightly elevated, slightly offset to the east,
  // ~3.3 units out. Looks like a hologram on Tony's lab table rather than a
  // flat map. Tour mode rotates around Y so the elevation is preserved.
  camera.position.set(1.4, 1.4, 2.5)

  // Lighting (only clouds use lights; the Earth shader does its own)
  const ambient = new THREE.AmbientLight(0x223344, 0.6)
  scene.add(ambient)
  const sunLight = new THREE.DirectionalLight(0xffeacc, 1.6)
  sunLight.position.copy(computeSunDirection()).multiplyScalar(5)
  scene.add(sunLight)

  // Starfield
  const starGeom = new THREE.BufferGeometry()
  const starCount = 1800
  const starPositions = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    const r = 50 + Math.random() * 20
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    starPositions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta)
    starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    starPositions[i * 3 + 2] = r * Math.cos(phi)
  }
  starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3))
  const stars = new THREE.Points(
    starGeom,
    new THREE.PointsMaterial({ color: 0xa8d8ff, size: 0.07, sizeAttenuation: true }),
  )
  scene.add(stars)

  // Core layers
  const earth = createEarth(textures)
  const atmosphere = createAtmosphere()
  const clouds = createClouds(textures.clouds)
  const grid = createGrid()
  const dots = createDots()
  const halos = createHalos()
  const pulses = createPulses()
  const marker = createSelectionMarker()
  const anomalyMarkers = createAnomalyMarkers()
  const constellation = createConstellation(scene)

  scene.add(earth.mesh)
  scene.add(atmosphere)
  scene.add(clouds.mesh)
  scene.add(grid)
  scene.add(dots.mesh)
  scene.add(halos.points)
  scene.add(pulses.mesh)
  scene.add(anomalyMarkers.mesh)
  scene.add(marker.mesh)

  // Borders load async; insert when ready
  let borders: THREE.LineSegments | null = null
  createBorders()
    .then((b) => {
      borders = b
      scene.add(b)
    })
    .catch((err) => console.warn('Borders failed to load:', err))

  dots.setDots(initialDots)
  halos.setDots(initialDots)

  // Controls + tour
  const controls = createControls(camera, renderer.domElement)
  const tour = createTour(camera, controls.controls)
  if (initialTourMode) {
    // Pre-enable so the subsequent setTourMode(true) call from React is a no-op
    // and doesn't fire the audio whoosh on top of the boot screen's dismiss whoosh
    tour.setEnabled(true)
  }

  // Post-processing
  const post = createPostProcess(
    renderer,
    scene,
    camera,
    container.clientWidth,
    container.clientHeight,
  )

  // Raycasting
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let pickHandler: ((r: DotRecord | null) => void) | null = null
  let pointerDownAt: { x: number; y: number; t: number } | null = null
  let audioStarted = false

  function onPointerDown(e: PointerEvent) {
    pointerDownAt = { x: e.clientX, y: e.clientY, t: performance.now() }
    if (!audioStarted) {
      audioStarted = true
      audio.start()
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!pointerDownAt) return
    const dx = e.clientX - pointerDownAt.x
    const dy = e.clientY - pointerDownAt.y
    const dt = performance.now() - pointerDownAt.t
    pointerDownAt = null
    if (Math.hypot(dx, dy) > 4 || dt > 400) return

    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)

    const hits = raycaster.intersectObject(dots.mesh, false)
    if (hits.length > 0 && hits[0].instanceId !== undefined) {
      const id = hits[0].instanceId
      const rec = dots.records()[id]
      const pos = dots.positionAt(id)
      if (rec && pos) {
        marker.setTarget(pos, elapsedNow())
        audio.click()
        pickHandler?.(rec)
        return
      }
    }
    marker.setTarget(null)
    pickHandler?.(null)
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointerup', onPointerUp)

  // Resize
  function onResize() {
    const w = container.clientWidth
    const h = container.clientHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    post.setSize(w, h)
  }
  const resizeObs = new ResizeObserver(onResize)
  resizeObs.observe(container)

  // Ambient pulses on breaking dots: fire one every 4-8s while autoPulse is on
  let nextAmbientPulse = performance.now() + 4000
  let autoPulseEnabled = false

  function spawnBreakingPulse(rec?: DotRecord) {
    const list = dots.records()
    const candidates = rec ? [rec] : list.filter((r) => r.breaking || (r.importance ?? 0) > 0.75)
    if (candidates.length === 0) return
    const chosen = candidates[Math.floor(Math.random() * candidates.length)]
    const id = list.indexOf(chosen)
    const pos = dots.positionAt(id)
    if (!pos) return
    pulses.spawn(pos, colorFor(chosen.category), elapsedNow())
    audio.chime()
  }

  // Animation loop
  const startMs = performance.now()
  let lastFrameMs = startMs
  let raf = 0
  // FPS smoothing + telemetry throttling
  let fpsAvg = 60
  let nextTelemetryMs = 0
  function elapsedNow() {
    return (performance.now() - startMs) / 1000
  }
  function tick() {
    raf = requestAnimationFrame(tick)
    const nowMs = performance.now()
    const dt = (nowMs - lastFrameMs) / 1000
    lastFrameMs = nowMs
    const elapsed = (nowMs - startMs) / 1000
    const now = new Date()

    earth.update(elapsed, now)
    clouds.update(elapsed)
    // Distance to origin works because controls.target is locked at (0,0,0)
    // (enablePan = false in controls.ts); if panning is ever enabled, switch
    // to camera.position.distanceTo(controls.target).
    const cameraDistance = camera.position.length()
    dots.update(elapsed, cameraDistance)
    halos.update(elapsed, renderer.getPixelRatio())
    pulses.update(elapsed)
    anomalyMarkers.update(elapsed)
    constellation.update(elapsed)
    marker.update(elapsed, camera)

    const sunDir = computeSunDirection(now)
    sunLight.position.copy(sunDir).multiplyScalar(5)

    tour.step(dt)
    controls.update()

    // Push camera telemetry at ~10 Hz — the camera barely moves between frames
    if (onTelemetry && nowMs >= nextTelemetryMs) {
      nextTelemetryMs = nowMs + 100
      // Exponentially smoothed FPS so the readout doesn't jitter every frame
      const instFps = dt > 0 ? 1 / dt : 60
      fpsAvg = fpsAvg * 0.85 + instFps * 0.15
      const { lat, lon } = vec3ToLatLon(camera.position)
      const altitude = camera.position.length() - EARTH_RADIUS
      // Azimuth: where the camera is, projected to longitude (0..360 east)
      const azimuth = ((lon % 360) + 360) % 360
      onTelemetry({
        lat,
        lon,
        altitude,
        azimuth,
        fps: fpsAvg,
      })
    }

    if (autoPulseEnabled && nowMs >= nextAmbientPulse) {
      spawnBreakingPulse()
      nextAmbientPulse = nowMs + 4000 + Math.random() * 4000
    }

    post.update(elapsed)
    post.composer.render()
  }
  tick()

  return {
    dispose() {
      cancelAnimationFrame(raf)
      resizeObs.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      controls.dispose()
      renderer.dispose()
      if (borders) scene.remove(borders)
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mat = m.material
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else if (mat) (mat as THREE.Material).dispose()
      })
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    },
    setDots(records) {
      dots.setDots(records)
      halos.setDots(records)
    },
    onPick(handler) {
      pickHandler = handler
    },
    flyTo: (lat, lon, durationMs, opts) => {
      audio.whoosh(0.4)
      // Place the selection marker at the destination — clicks from the
      // BREAKING / SEARCH panels feed in here and the user expects the same
      // visual highlight they'd get from clicking the dot directly.
      // The marker sits at the same radius as dots (1.012× Earth radius),
      // then the marker module lifts itself another 2% so it floats just
      // above the dot to avoid Z-fighting. Camera-only moves (the briefing's
      // end-of-show reset to the home view) pass marker: false — a marker in
      // the open ocean would be noise.
      if (opts?.marker !== false) {
        const pos = latLonToVec3(lat, lon, EARTH_RADIUS * 1.012)
        marker.setTarget(pos, elapsedNow())
      }
      // controls.flyTo signature: (lat, lon, distance?, durationMs?)
      controls.flyTo(lat, lon, opts?.distance, durationMs)
    },
    setTourMode(b) {
      if (tour.isEnabled() === b) return  // no-op + no whoosh on redundant set
      tour.setEnabled(b)
      if (b) audio.whoosh(0.25)
    },
    setAutoPulse(b) {
      const was = autoPulseEnabled
      autoPulseEnabled = b
      if (b && !was) {
        // Fire one immediately so the user gets visual confirmation
        spawnBreakingPulse()
        nextAmbientPulse = performance.now() + 4000 + Math.random() * 4000
      }
    },
    spawnBreakingPulse,
    spawnPulseAt(lat, lon, color = '#ff5a4a') {
      const pos = latLonToVec3(lat, lon, EARTH_RADIUS * 1.012)
      pulses.spawn(pos, new THREE.Color(color), elapsedNow())
    },
    setAnomalyPins(pins) {
      anomalyMarkers.setAnomalies(pins)
    },
    setConstellation(points) {
      constellation.set(points, elapsedNow())
    },
  }
}
