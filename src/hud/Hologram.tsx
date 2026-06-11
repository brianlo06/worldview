// Rotating "tactical hologram" for the briefing: an AI-rendered scene of the
// current story, projected JARVIS-style on the left of the screen — emitter
// base with expanding rings, light cone, 3D parallax sway, cyan duotone,
// scanlines, sweep bar, flicker and glitch slices (keyframes in index.css).
//
// The render is generated server-side after /briefing returns, so this polls
// the holo URL until it lands; the story's article photo stands in through
// the same projection (and stays, if generation never finishes).

import { useEffect, useState } from 'react'

const POLL_MS = 4000
const MAX_POLLS = 20 // ~80s — well past worst-case render time

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

// One duotoned copy of the scene. The hologram body stacks three of these at
// different depths (translateZ) so the sway reads as volume, not a flat card.
function Pane({ url, style, className }: { url: string; style?: React.CSSProperties; className?: string }) {
  return (
    <div
      className={`absolute inset-0 ${className ?? ''}`}
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
    <div className="pointer-events-none fixed left-6 top-1/2 -translate-y-1/2 z-[890] hidden md:flex w-56 flex-col">
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
            className="holo-rotor holo-flicker relative w-full aspect-[4/5]"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {url ? (
              <>
                {/* Depth ghosts behind + in front of the main pane */}
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
                <div
                  className="absolute inset-0"
                  style={{ background: '#1d9fde', mixBlendMode: 'color' }}
                />
                <div
                  className="absolute inset-0 mix-blend-screen"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(76,201,255,0.28), rgba(2,4,10,0) 40%, rgba(76,201,255,0.14))',
                  }}
                />
                {/* Glitch slice — a displaced copy that strobes rarely */}
                <Pane url={url} className="holo-glitch" style={{ opacity: 0 }} />
              </>
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
          <div
            className="relative h-3 w-28"
            style={{ perspective: '300px' }}
          >
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
