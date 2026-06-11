// Rotating "tactical hologram" for the briefing: an AI-rendered scene of the
// current story, projected JARVIS-style on the right of the screen — emitter
// base with expanding rings, light cone, scanlines, flicker (keyframes in
// index.css).
//
// The projection itself is genuinely 3D: the render is resampled into a
// ~12k-point cloud whose Z displacement comes from pixel luminance (the
// renders are engineered as glowing-cyan-on-black, so brightness ≈
// structure), drawn in a small Three.js canvas with additive blending and
// rotated in real space. When pixel readback isn't allowed (article photos
// from news CDNs without CORS headers) it falls back to the flat
// parallax-pane look.
//
// The AI render is generated server-side after /briefing returns, so this
// polls the holo URL until it lands; the story's article photo stands in
// (and stays, if generation never finishes).

import { useCallback, useEffect, useRef, useState } from 'react'
// three is imported dynamically inside ParticleHolo — a static import would
// drag ~590KB into the main bundle, which otherwise only loads three via
// the lazy Globe chunk (the module instance is shared either way).
import type * as THREE from 'three'

const POLL_MS = 4000
const MAX_POLLS = 20 // ~80s — well past worst-case render time

// Point-cloud sampling. 110x138 keeps the 4:5 frame and lands around
// 8-13k visible points after the black-pixel cut — plenty for structure,
// trivial for the GPU next to the globe.
const SAMPLE_W = 110
const SAMPLE_H = 138
const WORLD_W = 4
const WORLD_H = 5
const WORLD_DEPTH = 2.4
const LUM_CUTOFF = 0.045
const MIN_POINTS = 250 // fewer than this and the cloud reads as noise

interface HologramProps {
  src: string | null // AI render URL (may not exist yet)
  fallbackSrc: string | null // article photo
  index: number
  total: number
  label: string
}

// Resolve the best available image: show the fallback immediately, keep
// probing the render URL in the background, and swap (with a resolve flash)
// the moment it exists. Retries carry a cache-buster so a polled 404 is
// never replayed from any cache layer. State holds only the landed render
// (set from load callbacks); the fallback is derived straight from props —
// the parent keys this component per story, so no reset-on-prop-change.
function useResolvedImage(src: string | null, fallbackSrc: string | null) {
  const [render, setRender] = useState<string | null>(null)

  useEffect(() => {
    if (!src) return
    let cancelled = false
    let attempts = 0
    let timer: number | undefined
    const probe = () => {
      const candidate = attempts === 0 ? src : `${src}?r=${attempts}`
      const img = new Image()
      img.onload = () => {
        if (!cancelled) setRender(candidate)
      }
      img.onerror = () => {
        attempts += 1
        if (!cancelled && attempts < MAX_POLLS) {
          timer = window.setTimeout(probe, POLL_MS)
        }
      }
      img.src = candidate
    }
    probe()
    return () => {
      cancelled = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [src])

  return { url: render ?? fallbackSrc, resolved: render !== null }
}

// Soft round particle sprite (shared per component instance).
function makeSprite(T: typeof THREE): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 32, 32)
  return new T.CanvasTexture(c)
}

// Sample the image into luminance-displaced points. Returns null when the
// canvas is CORS-tainted (readback throws) or the cloud is too sparse.
function buildCloud(img: HTMLImageElement): { positions: Float32Array; colors: Float32Array } | null {
  const cv = document.createElement('canvas')
  cv.width = SAMPLE_W
  cv.height = SAMPLE_H
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  // Cover-crop into the 4:5 frame.
  const ia = img.width / img.height
  const ta = SAMPLE_W / SAMPLE_H
  let sx = 0, sy = 0, sw = img.width, sh = img.height
  if (ia > ta) {
    sw = img.height * ta
    sx = (img.width - sw) / 2
  } else {
    sh = img.width / ta
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SAMPLE_W, SAMPLE_H)
  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data
  } catch {
    return null // tainted canvas — no CORS headers on this image
  }
  const pos: number[] = []
  const col: number[] = []
  for (let y = 0; y < SAMPLE_H; y++) {
    for (let x = 0; x < SAMPLE_W; x++) {
      const i = (y * SAMPLE_W + x) * 4
      const r = data[i] / 255
      const g = data[i + 1] / 255
      const b = data[i + 2] / 255
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
      if (lum < LUM_CUTOFF) continue
      pos.push(
        (x / SAMPLE_W - 0.5) * WORLD_W,
        (0.5 - y / SAMPLE_H) * WORLD_H,
        (Math.pow(lum, 0.85) - 0.5) * WORLD_DEPTH,
      )
      // Cyan-graded: bright pixels run white-hot, dim ones deep blue.
      const k = 0.25 + 0.75 * lum
      col.push(
        Math.min(1, lum * 0.6) * k,
        Math.min(1, 0.3 + lum * 0.9) * k,
        Math.min(1, 0.5 + lum * 1.05) * k,
      )
    }
  }
  if (pos.length / 3 < MIN_POINTS) return null
  return { positions: new Float32Array(pos), colors: new Float32Array(col) }
}

// The volumetric projection: a luminance-relief point cloud slowly turning
// in real 3D. Calls onFallback when this image can't be read or is too dark
// to make a cloud from.
function ParticleHolo({ url, onFallback }: { url: string; onFallback: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false
    let raf = 0
    let renderer: THREE.WebGLRenderer | null = null
    let geometry: THREE.BufferGeometry | null = null
    let material: THREE.PointsMaterial | null = null
    let sprite: THREE.Texture | null = null

    void (async () => {
      const T = await import('three')
      if (disposed) return
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (disposed) return
        const cloud = buildCloud(img)
        if (!cloud) {
          onFallback()
          return
        }
        const w = mount.clientWidth
        const h = mount.clientHeight
        renderer = new T.WebGLRenderer({ alpha: true, antialias: false })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setSize(w, h)
        renderer.domElement.style.position = 'absolute'
        renderer.domElement.style.inset = '0'
        mount.appendChild(renderer.domElement)

        const scene = new T.Scene()
        const camera = new T.PerspectiveCamera(36, w / h, 0.1, 50)
        camera.position.z = 8.2

        geometry = new T.BufferGeometry()
        geometry.setAttribute('position', new T.BufferAttribute(cloud.positions, 3))
        geometry.setAttribute('color', new T.BufferAttribute(cloud.colors, 3))
        sprite = makeSprite(T)
        material = new T.PointsMaterial({
          size: 0.06,
          map: sprite,
          vertexColors: true,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          blending: T.AdditiveBlending,
          sizeAttenuation: true,
        })
        const points = new T.Points(geometry, material)
        const group = new T.Group()
        group.add(points)
        scene.add(group)

        const clock = new T.Clock()
        const animate = () => {
          if (disposed) return
          const t = clock.getElapsedTime()
          // Turntable sway: far enough to show real parallax, never edge-on.
          group.rotation.y = Math.sin(t * 0.32) * 0.85
          group.rotation.x = Math.sin(t * 0.21) * 0.07
          group.position.y = Math.sin(t * 0.5) * 0.06
          // Projection instability — brief random dropouts.
          const target = Math.random() < 0.012 ? 0.4 + Math.random() * 0.3 : 0.95
          material!.opacity += (target - material!.opacity) * 0.5
          renderer!.render(scene, camera)
          raf = requestAnimationFrame(animate)
        }
        animate()
      }
      img.onerror = () => {
        if (!disposed) onFallback()
      }
      img.src = url
    })()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      geometry?.dispose()
      material?.dispose()
      sprite?.dispose()
      if (renderer) {
        renderer.dispose()
        renderer.domElement.remove()
      }
    }
  }, [url, onFallback])

  return <div ref={mountRef} className="absolute inset-0" />
}

// One duotoned copy of the scene — the flat-mode fallback stacks three at
// different depths so the CSS sway still reads as volume.
function Pane({ url, style }: { url: string; style?: React.CSSProperties }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `url("${url}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'grayscale(1) brightness(1.05) contrast(1.1)',
        ...style,
      }}
    />
  )
}

// Flat parallax-pane projection, used when the image's pixels can't be read
// (no CORS) so the point cloud can't be built.
function FlatPanes({ url }: { url: string }) {
  return (
    <div className="holo-rotor absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
      <Pane
        url={url}
        style={{
          transform: 'translateZ(-16px) scale(1.05)',
          opacity: 0.22,
          filter: 'grayscale(1) brightness(1.2) blur(3px)',
        }}
      />
      <Pane url={url} style={{ opacity: 0.95 }} />
      <Pane
        url={url}
        style={{
          transform: 'translateZ(16px)',
          opacity: 0.16,
          filter: 'grayscale(1) brightness(1.5) blur(1px)',
        }}
      />
      {/* Cyan grade: duotone color + additive glow */}
      <div className="absolute inset-0" style={{ background: '#1d9fde', mixBlendMode: 'color' }} />
      <div
        className="absolute inset-0 mix-blend-screen"
        style={{
          background:
            'linear-gradient(180deg, rgba(76,201,255,0.28), rgba(2,4,10,0) 40%, rgba(76,201,255,0.14))',
        }}
      />
      {/* Glitch slice — a displaced copy that strobes rarely */}
      <div
        className="holo-glitch absolute inset-0"
        style={{
          backgroundImage: `url("${url}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0,
        }}
      />
    </div>
  )
}

// Per-image projection: try the 3D point cloud first, drop to flat panes if
// the pixels can't be read. Keyed by url from the parent, so a newly landed
// AI render (which is CORS-readable) re-attempts 3D even after an article
// photo forced flat mode.
function Projection({ url }: { url: string }) {
  const [flat, setFlat] = useState(false)
  const fail = useCallback(() => setFlat(true), [])
  if (flat) return <FlatPanes url={url} />
  return <ParticleHolo url={url} onFallback={fail} />
}

export function Hologram({ src, fallbackSrc, index, total, label }: HologramProps) {
  const { url, resolved } = useResolvedImage(src, fallbackSrc)
  const num = String(index + 1).padStart(2, '0')
  const totalStr = String(total).padStart(2, '0')
  const status = resolved
    ? 'RECONSTRUCTION ACTIVE'
    : src
      ? 'RENDERING RECONSTRUCTION'
      : 'ARCHIVE PROJECTION'

  return (
    {/* Anchored below the top-right controls stack (clock/toggles/tier
        filter end ~13-16rem down) so the projection never overlaps it. */}
    <div className="pointer-events-none fixed right-6 top-[58%] -translate-y-1/2 z-[890] hidden md:flex w-64 flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 text-hud-2xs tracking-[0.3em] text-[#4cc9ff]/80">
        <span className="text-[#7be0ff]">◢</span>
        <span>HOLO RECON</span>
        <span className="ml-auto tabular-nums text-[#7be0ff]">
          {num}/{totalStr}
        </span>
      </div>

      {/* Projection volume */}
      <div className="mt-2 w-full" style={{ perspective: '850px' }}>
        <div className="holo-bob" style={{ transformStyle: 'preserve-3d' }}>
          <div
            key={url ?? 'empty'}
            className="holo-flicker-still relative w-full aspect-[4/5]"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {url ? (
              <Projection key={url} url={url} />
            ) : (
              /* No imagery at all yet: wireframe rendering grid */
              <div className="absolute inset-0 holo-grid flex items-center justify-center">
                <span className="text-hud-2xs tracking-[0.3em] text-[#7be0ff]/70">
                  COMPILING
                </span>
              </div>
            )}

            {/* Scanlines + moving sweep */}
            <div
              className="absolute inset-0 mix-blend-screen opacity-30"
              style={{
                background:
                  'repeating-linear-gradient(0deg, transparent 0 2px, rgba(124,224,255,0.22) 2px 3px)',
              }}
            />
            <div className="holo-sweep absolute inset-x-0 h-10 mix-blend-screen" />

            {/* Edge vignette so the projection fades into black */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(2,4,10,0) 55%, rgba(2,4,10,0.65) 100%)',
              }}
            />

            {/* Targeting corner brackets */}
            <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#7be0ff]/90" />
            <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#7be0ff]/90" />
            <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#7be0ff]/90" />
            <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#7be0ff]/90" />

            {/* Resolve flash when the AI render lands */}
            {resolved && (
              <div
                className="holo-resolve absolute inset-0 mix-blend-screen"
                style={{ background: 'rgba(124,224,255,0.9)' }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Light cone from emitter up into the projection */}
      <div className="relative h-10 w-full overflow-visible">
        <div
          className="holo-cone absolute inset-x-4 -top-1 bottom-0"
          style={{
            clipPath: 'polygon(2% 0, 98% 0, 56% 100%, 44% 100%)',
            background:
              'linear-gradient(180deg, rgba(124,224,255,0.05), rgba(124,224,255,0.3))',
            filter: 'blur(2px)',
          }}
        />
        {/* Emitter base: disc + expanding rings */}
        <div className="absolute inset-x-0 bottom-0 flex justify-center">
          <div className="relative h-3 w-28" style={{ perspective: '300px' }}>
            <div
              className="absolute inset-0 rounded-[50%] border border-[#7be0ff]/80"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(124,224,255,0.5), rgba(124,224,255,0.05) 70%)',
                boxShadow: '0 0 16px rgba(124,224,255,0.6)',
              }}
            />
            <div className="holo-ring absolute inset-0 rounded-[50%] border border-[#4cc9ff]/70" />
            <div
              className="holo-ring absolute inset-0 rounded-[50%] border border-[#4cc9ff]/70"
              style={{ animationDelay: '1.1s' }}
            />
          </div>
        </div>
      </div>

      {/* Status + caption */}
      <div className="mt-1.5 flex items-center gap-1.5 text-hud-2xs tracking-[0.25em] text-[#4cc9ff]/75">
        <span
          className="inline-block w-1 h-1 rounded-full flex-shrink-0"
          style={{
            background: resolved ? '#7be0ff' : '#ffb84c',
            boxShadow: resolved ? '0 0 6px #7be0ff' : '0 0 6px #ffb84c',
            animation: resolved ? undefined : 'pulse 1.2s ease-in-out infinite',
          }}
        />
        <span>{status}</span>
      </div>
      <div className="mt-0.5 text-hud-2xs tracking-[0.2em] text-[#cfe6ff]/55 uppercase truncate">
        {label}
      </div>
    </div>
  )
}
