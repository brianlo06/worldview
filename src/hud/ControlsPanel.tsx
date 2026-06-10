import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { audio } from '../audio/audio'
import { TIERS } from '../globe/tiers'
import { useCurrentTime } from './hooks'

function formatUTC(d: Date) {
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

function relativeTime(t: number | null, now: number): string {
  if (!t) return '—'
  const secs = Math.max(0, Math.round((now - t) / 1000))
  if (secs < 60) return `${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  return `${hrs}h ago`
}

// Top-right: clock, feed status, mode toggles, and the significance-tier filter.
export function ControlsPanel({
  briefingActive,
  onStartBriefing,
}: {
  briefingActive: boolean
  onStartBriefing: () => void
}) {
  const now = useCurrentTime()
  const [muted, setMuted] = useState(() => audio.isMuted())
  const layers = useAppStore((s) => s.activeLayers)
  const apiStatus = useAppStore((s) => s.apiStatus)
  const eventCount = useAppStore((s) => s.eventCount)
  const lastUpdated = useAppStore((s) => s.lastUpdated)
  const tourMode = useAppStore((s) => s.tourMode)
  const setTourMode = useAppStore((s) => s.setTourMode)
  const autoPulse = useAppStore((s) => s.autoPulse)
  const setAutoPulse = useAppStore((s) => s.setAutoPulse)
  const layerMode = useAppStore((s) => s.layerMode)
  const setLayerMode = useAppStore((s) => s.setLayerMode)
  const significanceTier = useAppStore((s) => s.significanceTier)
  const setSignificanceTier = useAppStore((s) => s.setSignificanceTier)

  function toggleMute() {
    const next = !muted
    audio.setMuted(next)
    setMuted(next)
  }

  return (
    <div className="absolute top-[2.25rem] right-4 text-right text-[#4cc9ff]/90 flex flex-col items-end gap-1">
      <div>{formatUTC(now)}</div>
      <div className="text-hud-xs opacity-60">
        <span
          className={
            apiStatus === 'connected'
              ? 'text-[#9affb2]'
              : apiStatus === 'offline'
                ? 'text-[#ff8888]'
                : 'text-[#4cc9ff]/60'
          }
        >
          {apiStatus === 'connected'
            ? '● API'
            : apiStatus === 'offline'
              ? '○ DEMO'
              : '◌ …'}
        </span>
        {'  '}·{'  '}{eventCount} EVENTS{'  '}·{'  '}L{layers.size}
      </div>
      <div className="text-hud-xs opacity-50">
        UPDATED {relativeTime(lastUpdated, now.getTime())}
      </div>
      <div className="pointer-events-auto mt-1 flex gap-1">
        <button
          type="button"
          onClick={() => setLayerMode(layerMode === 'clusters' ? 'events' : 'clusters')}
          className={`border px-2 py-1 text-hud-xs transition ${
            layerMode === 'clusters'
              ? 'border-[#7be0ff] bg-[#4cc9ff]/15 text-[#cfe6ff]'
              : 'border-[#4cc9ff]/40 text-[#4cc9ff]/90 hover:bg-[#4cc9ff]/10'
          }`}
          aria-pressed={layerMode === 'clusters'}
          title={layerMode === 'clusters' ? 'Showing clusters · click for raw events' : 'Showing raw events · click for clusters'}
        >
          {layerMode === 'clusters' ? '◉ CLUSTERS' : '◯ EVENTS'}
        </button>
        <button
          type="button"
          onClick={onStartBriefing}
          disabled={briefingActive}
          className={`border px-2 py-1 text-hud-xs transition ${
            briefingActive
              ? 'border-[#7be0ff] bg-[#4cc9ff]/15 text-[#cfe6ff] cursor-not-allowed'
              : 'border-[#4cc9ff]/40 text-[#4cc9ff]/90 hover:bg-[#4cc9ff]/10'
          }`}
          title="JARVIS reads the top 5 stories while the globe flies to each"
        >
          {briefingActive ? '◐ BRIEFING · LIVE' : '◯ BRIEFING'}
        </button>
        <button
          type="button"
          onClick={() => setTourMode(!tourMode)}
          className={`border px-2 py-1 text-hud-xs transition ${
            tourMode
              ? 'border-[#7be0ff] bg-[#4cc9ff]/15 text-[#cfe6ff]'
              : 'border-[#4cc9ff]/40 text-[#4cc9ff]/90 hover:bg-[#4cc9ff]/10'
          }`}
          aria-pressed={tourMode}
        >
          {tourMode ? '◐ TOUR · ON' : '◯ TOUR'}
        </button>
        <button
          type="button"
          onClick={() => setAutoPulse(!autoPulse)}
          className={`border px-2 py-1 text-hud-xs transition ${
            autoPulse
              ? 'border-[#ff8e5a] bg-[#ff8e5a]/15 text-[#ffb59a]'
              : 'border-[#4cc9ff]/40 text-[#4cc9ff]/90 hover:bg-[#4cc9ff]/10'
          }`}
          aria-pressed={autoPulse}
        >
          {autoPulse ? '◉ PULSE · ON' : '◯ PULSE'}
        </button>
        <button
          type="button"
          onClick={toggleMute}
          className="border border-[#4cc9ff]/40 px-2 py-1 text-hud-xs text-[#4cc9ff]/90 hover:bg-[#4cc9ff]/10 transition"
          aria-pressed={!muted}
        >
          {muted ? '✕ SND' : '◉ SND'}
        </button>
      </div>

      {/* Significance tier — segmented control */}
      <div className="pointer-events-auto mt-1 flex items-stretch border border-[#4cc9ff]/30">
        {TIERS.map((t, i) => {
          const active = significanceTier === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSignificanceTier(t.id)}
              title={t.description}
              aria-pressed={active}
              className={`px-2 py-[3px] text-hud-2xs tracking-[0.18em] transition ${
                active
                  ? 'bg-[#4cc9ff]/15 text-[#dfeeff]'
                  : 'text-[#4cc9ff]/55 hover:bg-[#4cc9ff]/8 hover:text-[#cfe6ff]'
              } ${i > 0 ? 'border-l border-[#4cc9ff]/15' : ''}`}
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
