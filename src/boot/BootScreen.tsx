import { useEffect, useState, type CSSProperties } from 'react'
import { audio } from '../audio/audio'
import { speak } from '../audio/voice'

interface BootLine {
  label: string
  status: string
  delay: number // ms after previous line
}

// The labels are real (most of these *are* the modules we built), the status
// strings are mostly genuine, a few flavored — it's a Stark boot, not a build log.
const BOOT_LINES: BootLine[] = [
  { label: 'System BIOS',                       status: 'v2.4.7',          delay: 120 },
  { label: 'Quantum Encryption Handshake',      status: 'VERIFIED',        delay: 80 },
  { label: 'Earth Texture Atlas',               status: '6 / 6 LOADED',    delay: 110 },
  { label: 'Custom Three.js Shaders',           status: 'COMPILED',        delay: 80 },
  { label: 'PostGIS Spatial Engine',            status: '3.6.0',           delay: 70 },
  { label: 'pgvector HNSW Index',               status: 'READY',           delay: 70 },
  { label: 'GDELT Global Events Feed',          status: 'ESTABLISHED',     delay: 110 },
  { label: 'GDELT GKG Stream',                  status: 'SUBSCRIBED',      delay: 80 },
  { label: 'NOAA NWS Alert Channel',            status: 'MONITORING',      delay: 80 },
  { label: 'Stooq Market Quotes',               status: 'LIVE',            delay: 75 },
  { label: 'Frankfurter FX Rates',              status: 'SYNCED',          delay: 85 },
  { label: 'Anthropic Claude API',              status: 'AUTHENTICATED',   delay: 130 },
  { label: 'fastembed Inference (bge-small)',   status: 'WARM',            delay: 90 },
  { label: 'Cluster Assignment Worker',         status: 'ARMED',           delay: 90 },
  { label: 'Anomaly Detection Pipeline',        status: 'ARMED',           delay: 100 },
  { label: 'Semantic Search Engine',            status: 'ONLINE',          delay: 80 },
  { label: 'Tactical HUD Overlay',              status: 'CALIBRATED',      delay: 90 },
  { label: 'Geographic Coordinate Lock',        status: 'ACQUIRED',        delay: 80 },
]

const LABEL_COLUMN_WIDTH = 36

function dotsFor(label: string): string {
  return '.'.repeat(Math.max(3, LABEL_COLUMN_WIDTH - label.length))
}

export function BootScreen({ onComplete }: { onComplete: () => void }) {
  const [linesShown, setLinesShown] = useState(0)
  const [fading, setFading] = useState(false)

  const allDone = linesShown >= BOOT_LINES.length

  // Stream lines in one at a time
  useEffect(() => {
    if (allDone) return
    const t = setTimeout(
      () => setLinesShown((n) => n + 1),
      BOOT_LINES[linesShown]?.delay ?? 80,
    )
    return () => clearTimeout(t)
  }, [linesShown, allDone])

  function dismiss() {
    if (fading) return
    setFading(true)
    // First user gesture — boot the audio context here, then whoosh out
    audio.start()
    audio.whoosh(0.4)
    // JARVIS-style hello — fires after a brief beat so the whoosh sits first
    setTimeout(() => speak('Good evening. Worldview is online.'), 350)
    setTimeout(onComplete, 550)
  }

  // After the log finishes, any click or keypress dismisses
  useEffect(() => {
    if (!allDone) return
    const onAny = () => dismiss()
    window.addEventListener('keydown', onAny)
    window.addEventListener('click', onAny)
    return () => {
      window.removeEventListener('keydown', onAny)
      window.removeEventListener('click', onAny)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone])

  // Boot-screen-only type scale: drives off viewport HEIGHT so the whole
  // splash (header + 18 boot lines + footer + credit) always fits without
  // scrolling, however short the window. Scoped here via CSS-variable
  // overrides — the globe HUD keeps the shared width-based scale from :root.
  const compactType: CSSProperties = {
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    ['--text-hud-3xs' as string]: 'clamp(0.5rem, 1.3vh, 0.8rem)',
    ['--text-hud-2xs' as string]: 'clamp(0.54rem, 1.4vh, 0.85rem)',
    ['--text-hud-xs' as string]: 'clamp(0.58rem, 1.5vh, 0.95rem)',
    ['--text-hud-sm' as string]: 'clamp(0.56rem, 1.7vh, 1.0rem)',
    ['--text-hud-md' as string]: 'clamp(0.68rem, 1.9vh, 1.1rem)',
    ['--text-hud-title' as string]: 'clamp(1.3rem, 5.5vh, 3.2rem)',
  }

  return (
    <div
      className={`fixed inset-0 z-[1000] bg-[#02040a] transition-opacity duration-500 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
      style={compactType}
    >
      {/* Faint horizontal scan-line texture across the whole screen */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent 0 2px, rgba(76,201,255,0.45) 2px 3px)',
        }}
      />
      {/* Subtle vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(2,4,10,0) 35%, rgba(2,4,10,0.6) 100%)',
        }}
      />

      {/* Glowing corner brackets */}
      <BootCorner pos="top-6 left-6" sides="border-l border-t" />
      <BootCorner pos="top-6 right-6" sides="border-r border-t" />
      <BootCorner pos="bottom-6 left-6" sides="border-l border-b" />
      <BootCorner pos="bottom-6 right-6" sides="border-r border-b" />

      {/* Timestamp stays in the top-right corner */}
      <div className="absolute top-7 right-12 text-[#4cc9ff]/40 text-hud-xs tracking-widest tabular-nums">
        {nowStamp()}
      </div>

      {/* Scrollable, vertically-centered content. min-h-full keeps it centered
          when it fits and lets it scroll (never overlap) when it doesn't —
          everything below is in normal flow, so the top label and author credit
          can't collide with the boot log on a short viewport. */}
      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full flex flex-col items-center justify-center px-4 py-[2.5vh] relative z-10">
          {/* Top label */}
          <div className="text-[#4cc9ff]/60 text-hud-xs tracking-[0.3em] mb-[1.5vh]">
            SYSTEM INITIALIZATION
          </div>

          {/* Title */}
          <div
            className="text-[#7be0ff] text-hud-title tracking-[0.45em] mb-2 leading-none"
            style={{ textShadow: '0 0 14px rgba(124,224,255,0.7), 0 0 28px rgba(76,201,255,0.4)' }}
          >
            WORLDVIEW
          </div>
          <div className="text-[#4cc9ff]/60 text-hud-xs tracking-[0.45em] mb-[2vh]">
            SITUATIONAL AWARENESS // v0.1
          </div>

          {/* Boot log */}
          <div className="text-hud-sm w-[42rem] max-w-[calc(100vw-4rem)] space-y-0.5">
            {BOOT_LINES.slice(0, linesShown).map((line, i) => (
              <div key={i} className="flex items-baseline">
                <span className="text-[#9affb2]" style={{ textShadow: '0 0 6px rgba(154,255,178,0.5)' }}>
                  [OK]
                </span>
                <span className="ml-2 text-[#cfe6ff] whitespace-nowrap">{line.label}</span>
                <span className="text-[#4cc9ff]/30 mx-1.5 truncate">{dotsFor(line.label)}</span>
                <span
                  className="text-[#7be0ff] ml-auto whitespace-nowrap tabular-nums"
                  style={{ textShadow: '0 0 6px rgba(124,224,255,0.5)' }}
                >
                  {line.status}
                </span>
              </div>
            ))}
          </div>

          {/* Reserved area below so the layout doesn't jump when "all systems nominal" appears */}
          <div className="mt-[2vh] h-[7vh] flex flex-col items-center justify-start">
            {allDone && (
              <>
                <div
                  className="text-[#9affb2] text-hud-md tracking-[0.32em]"
                  style={{ textShadow: '0 0 10px rgba(154,255,178,0.7)' }}
                >
                  ◉ ALL SYSTEMS NOMINAL
                </div>
                <div className="text-[#4cc9ff]/70 text-hud-xs tracking-[0.3em] mt-4 animate-pulse">
                  CLICK OR PRESS ANY KEY TO CONTINUE
                </div>
              </>
            )}
          </div>

          {/* Author credit + contact, in normal flow at the bottom of the column
              so it can never be overlapped by the boot log above it. */}
          <div
            className="mt-[3vh] flex flex-col items-center gap-1.5 text-[#4cc9ff]/50 text-hud-xs"
            style={{ textShadow: '0 0 6px rgba(76,201,255,0.35)' }}
          >
            <span className="tracking-[0.4em]">MADE BY BRIAN LO</span>
            <a
              href="mailto:brianlo200017@gmail.com"
              className="tracking-[0.15em] text-[#4cc9ff]/40 hover:text-[#7be0ff] transition-colors"
            >
              brianlo200017@gmail.com
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function BootCorner({ pos, sides }: { pos: string; sides: string }) {
  return (
    <div
      className={`absolute ${pos} w-5 h-5 ${sides} border-[#7be0ff]`}
      style={{ boxShadow: '0 0 8px rgba(124,224,255,0.4)' }}
    />
  )
}

function nowStamp(): string {
  const d = new Date()
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}
