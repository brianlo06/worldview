import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { audio } from '../audio/audio'
import { speak } from '../audio/voice'
import { CATEGORIES } from '../globe/categories'
import { countryName as countryNameFromCode, locationLabel } from '../globe/countries'
import type { DotRecord } from '../globe/dots'
import { TIERS } from '../globe/tiers'
import { MarketsPanel } from './MarketsPanel'
import { CenterCrosshair, TelemetryReadout } from './Telemetry'
import { Briefing } from './Briefing'
import { Ask } from './Ask'
import { ShareButton } from './ShareButton'

const SELECTION_TOP_OFFSET = '5.5rem'
const BREAKING_COUNT = 6

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

function isNewsDot(d: DotRecord): boolean {
  return !d.id.startsWith('mkt:')
}

export function Hud() {
  const [now, setNow] = useState(() => new Date())
  const [muted, setMuted] = useState(() => audio.isMuted())
  const [briefingActive, setBriefingActive] = useState(false)
  const anomalyListRef = useRef<HTMLDivElement>(null)
  const [anomaliesOverflow, setAnomaliesOverflow] = useState(false)
  const anomalies = useAppStore((s) => s.anomalies)

  useEffect(() => {
    const el = anomalyListRef.current
    if (!el) return
    const check = () => setAnomaliesOverflow(el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    window.addEventListener('resize', check)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', check)
    }
  }, [anomalies])
  const selected = useAppStore((s) => s.selectedEntity)
  const setSelectedEntity = useAppStore((s) => s.setSelectedEntity)
  const layers = useAppStore((s) => s.activeLayers)
  const apiStatus = useAppStore((s) => s.apiStatus)
  const eventCount = useAppStore((s) => s.eventCount)
  const lastUpdated = useAppStore((s) => s.lastUpdated)
  const tourMode = useAppStore((s) => s.tourMode)
  const setTourMode = useAppStore((s) => s.setTourMode)
  const autoPulse = useAppStore((s) => s.autoPulse)
  const setAutoPulse = useAppStore((s) => s.setAutoPulse)
  const dots = useAppStore((s) => s.dots)
  const setFlyToTarget = useAppStore((s) => s.setFlyToTarget)
  const layerMode = useAppStore((s) => s.layerMode)
  const setLayerMode = useAppStore((s) => s.setLayerMode)
  const disabledCategories = useAppStore((s) => s.disabledCategories)
  const toggleCategory = useAppStore((s) => s.toggleCategory)
  const significanceTier = useAppStore((s) => s.significanceTier)
  const setSignificanceTier = useAppStore((s) => s.setSignificanceTier)

  const breakingItems = useMemo<DotRecord[]>(() => {
    return [...dots]
      .filter(isNewsDot)
      .filter((d) => d.breaking === true)
      .sort((a, b) => {
        // Sort by importance first so the most consequential breaking story is
        // at the top, then by recency as a tiebreaker
        const ai = a.importance ?? 0
        const bi = b.importance ?? 0
        if (bi !== ai) return bi - ai
        const at = a.occurredAt ? Date.parse(a.occurredAt) : 0
        const bt = b.occurredAt ? Date.parse(b.occurredAt) : 0
        return bt - at
      })
      .slice(0, BREAKING_COUNT)
  }, [dots])

  function onBreakingClick(d: DotRecord) {
    audio.click()
    setSelectedEntity({
      type: 'event',
      id: d.id,
      title: d.title,
      summary: d.summary,
      imageUrl: d.imageUrl,
      url: d.url,
      sourceOutlet: d.sourceOutlet,
      occurredAt: d.occurredAt,
      category: d.category,
      countryCode: d.countryCode,
      city: d.city,
      geoPrecision: d.geoPrecision,
      lat: d.lat,
      lon: d.lon,
    })
    setFlyToTarget({ lat: d.lat, lon: d.lon, id: d.id })
    // JARVIS announces the destination (city / country only — title would be too noisy)
    const place =
      [d.city, countryNameFromCode(d.countryCode)].filter(Boolean).join(', ')
    if (place) speak(place)
  }

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  function toggleMute() {
    const next = !muted
    audio.setMuted(next)
    setMuted(next)
  }

  return (
    <div className="pointer-events-none absolute inset-0 text-hud-sm tracking-widest uppercase">
      {/* Center reticle — always-on Stark crosshair */}
      <CenterCrosshair />

      {/* Top-edge markets ticker — always-on horizontal strip (28px tall) */}
      <MarketsPanel />

      {/* Top-center: offline banner (only when API is unreachable).
          top-[2.25rem] sits just below the markets ticker. */}
      {apiStatus === 'offline' && (
        <div className="absolute top-[2.25rem] left-1/2 -translate-x-1/2 w-[30rem] max-w-[calc(100vw-14rem)] pointer-events-none">
          <div
            className="border border-[#ffb84c]/55 bg-[#02040a]/80 backdrop-blur-sm px-3 py-1.5 flex items-center gap-2 text-hud-xs tracking-[0.22em] text-[#ffb84c]/95"
            role="status"
            aria-live="polite"
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{
                background: '#ffb84c',
                boxShadow: '0 0 6px #ffb84c, 0 0 12px #ffb84c80',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
            <span>FEED OFFLINE</span>
            <span className="opacity-50">·</span>
            <span className="opacity-80">SHOWING SAMPLE EVENTS</span>
          </div>
        </div>
      )}

      {/* Top-center: ASK THE GLOBE. Anchored to CENTER WITHIN THE GAP between
          the left column (WORLDVIEW/breaking, ~26rem) and the right controls
          (clusters/briefing/tour…, ~33rem) so the answer card can't overlap
          either — screen-centering would collide with the controls. On narrow
          desktops the panel shrinks to the gap; on wide ones it caps at 34rem. */}
      <div
        className={`absolute left-[26rem] right-[33rem] flex justify-center ${
          apiStatus === 'offline' ? 'top-[5.5rem]' : 'top-[2.25rem]'
        }`}
      >
        <div className="w-full max-w-[34rem]">
          <Ask />
        </div>
      </div>

      {/* Bottom-center: camera telemetry */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
        <TelemetryReadout />
      </div>

      {/* Top-left */}
      <div className="absolute top-[2.25rem] left-4 text-[#4cc9ff]/90 max-w-[22rem]">
        <div className="text-hud-md tracking-[0.3em]">WORLDVIEW</div>
        <div className="text-hud-xs opacity-60 mt-1">Situational Awareness // Phase 1</div>

        <div className="mt-4">
          <div className="text-hud-xs opacity-70 tracking-[0.25em] flex items-center gap-1.5">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{
                background: '#ff5a4a',
                boxShadow: '0 0 6px #ff5a4a, 0 0 12px #ff5a4a80',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
            <span className="text-[#ffb59a]">BREAKING</span>
            <span className="opacity-50 ml-auto text-[#4cc9ff]">
              {breakingItems.length}/{eventCount}
            </span>
          </div>
          {breakingItems.length > 0 ? (
            <ul className="mt-2 space-y-1 pointer-events-auto max-h-[calc(100vh-21rem)] overflow-y-auto pr-1">
              {breakingItems.map((b, i) => {
                const isSelected = selected?.id === b.id
                return (
                  <li
                    key={b.id}
                    onClick={() => onBreakingClick(b)}
                    style={{ animationDelay: `${i * 45}ms` }}
                    className={`hud-row-in group flex items-start gap-2 cursor-pointer px-1.5 py-1 border border-transparent transition ${
                      isSelected
                        ? 'border-[#ff5a4a]/40 bg-[#ff5a4a]/10'
                        : 'hover:border-[#ff5a4a]/30 hover:bg-[#ff5a4a]/6'
                    }`}
                  >
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full mt-[6px] flex-shrink-0"
                      style={{
                        background: '#ff5a4a',
                        boxShadow: '0 0 7px #ff5a4a, 0 0 14px #ff5a4a80',
                      }}
                    />
                    <div className="min-w-0">
                      <div
                        className="normal-case tracking-normal text-hud-sm leading-snug text-[#ffd9d2]/95 group-hover:text-[#ffe9e4] line-clamp-2"
                        title={b.title}
                      >
                        {b.title}
                      </div>
                      {b.sourceOutlet && (
                        <div className="text-hud-2xs opacity-50 normal-case tracking-wide mt-0.5">
                          {b.sourceOutlet}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="mt-2 text-hud-xs tracking-[0.18em] text-[#4cc9ff]/40 px-1.5 py-2">
              ◯ NO ACTIVE BREAKING EVENTS
            </div>
          )}
        </div>
      </div>

      {/* Top-right */}
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
            onClick={() => setBriefingActive(true)}
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

      {/* Right column: anomaly cards only. Markets live in the top ticker now.
          The top offset scales with the viewport (clamp) so it always clears
          the fluid-sized clock + status + button row + tier filter above,
          rather than a fixed value that breaks when the text scales up. The
          list scrolls when it can't fit, with a fade hinting there's more. */}
      <div className="absolute right-4 top-[clamp(13rem,10rem+3vw,16rem)] w-[22rem] max-w-[calc(100vw-2rem)] pointer-events-none flex flex-col gap-1.5">
        {anomalies.length > 0 && (
          <>
            <div className="pointer-events-none flex items-center gap-1.5 text-hud-xs tracking-[0.22em] text-[#ffb59a]/90 px-0.5">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{
                  background: '#ff5a4a',
                  boxShadow: '0 0 6px #ff5a4a, 0 0 12px #ff5a4a80',
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              />
              <span>ANOMALIES</span>
              <span className="opacity-50 ml-auto text-[#4cc9ff]">
                {anomalies.length}
              </span>
            </div>
            <div
              ref={anomalyListRef}
              className="space-y-1.5 pointer-events-auto overflow-y-auto pr-1"
              style={{
                maxHeight: 'calc(100vh - 22rem)',
                maskImage: anomaliesOverflow
                  ? 'linear-gradient(180deg, #000 0, #000 calc(100% - 24px), transparent 100%)'
                  : undefined,
                WebkitMaskImage: anomaliesOverflow
                  ? 'linear-gradient(180deg, #000 0, #000 calc(100% - 24px), transparent 100%)'
                  : undefined,
              }}
            >
            {anomalies.map((a, ai) => {
            const pulse = 0.5 + Math.min(0.5, (a.sigma_above ?? 0) / 10)
            return (
              <div
                key={a.id}
                onClick={() => {
                  if (a.pulse_lat !== null && a.pulse_lon !== null) {
                    audio.click()
                    setFlyToTarget({ lat: a.pulse_lat, lon: a.pulse_lon })
                  }
                }}
                style={{ animationDelay: `${ai * 60}ms` }}
                className="hud-panel-in border border-[#ff5a4a]/60 bg-[#02040a]/80 backdrop-blur-sm px-3 py-2 cursor-pointer hover:bg-[#ff5a4a]/8 transition"
              >
                <div className="flex items-center gap-2 text-hud-xs tracking-[0.18em] uppercase">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{
                      background: '#ff5a4a',
                      boxShadow: `0 0 ${6 * pulse}px #ff5a4a, 0 0 ${14 * pulse}px #ff5a4a80`,
                    }}
                  />
                  <span className="text-[#ffb59a]">ANOMALY · {a.region_code}</span>
                  <span className="opacity-50 ml-auto">
                    {(a.peak_rate / Math.max(a.baseline_rate, 0.1)).toFixed(1)}× baseline
                  </span>
                </div>
                {a.driver_titles.slice(0, 2).map((t, i) => (
                  <div
                    key={i}
                    className="text-hud-sm normal-case tracking-normal leading-snug mt-1 opacity-85 line-clamp-2"
                  >
                    {t}
                  </div>
                ))}
              </div>
            )
          })}
            </div>
          </>
        )}
      </div>

      {/* Bottom-left: category legend (interactive toggles) + control hint.
          Width is capped to stay clear of the centered telemetry readout at the
          bottom edge — without this, on a wide-but-short viewport the legend +
          hint stretch across the middle and overlap it. */}
      <div className="absolute bottom-4 left-4 text-[#4cc9ff]/70 space-y-2 pointer-events-auto max-w-[calc(50vw-11rem)]">
        <div className="flex flex-wrap gap-x-2 gap-y-1 max-w-md">
          {CATEGORIES.map((c) => {
            const off = disabledCategories.has(c.id)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCategory(c.id)}
                className={`flex items-center gap-1.5 text-hud-xs tracking-widest px-1.5 py-0.5 transition ${
                  off
                    ? 'opacity-35 hover:opacity-65'
                    : 'opacity-100 hover:bg-[#4cc9ff]/8'
                }`}
                title={off ? `Show ${c.label}` : `Hide ${c.label}`}
                aria-pressed={!off}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{
                    background: off ? '#3a4458' : c.color,
                    boxShadow: off ? 'none' : `0 0 6px ${c.color}`,
                  }}
                />
                <span className={off ? 'line-through' : ''}>{c.label}</span>
              </button>
            )
          })}
        </div>
        <div className="opacity-60 text-hud-xs">
          DRAG · SCROLL · CLICK A DOT
        </div>
      </div>

      {/* Bottom-right: selection */}
      {selected && (
        <div
          className="pointer-events-auto border border-[#4cc9ff]/50 bg-[#02040a]/80 backdrop-blur-sm text-[#cfe6ff] holo-frame flex flex-col"
          style={{
            position: 'absolute',
            right: '1rem',
            bottom: '1rem',
            width: '26rem',
            maxWidth: 'calc(100vw - 2rem)',
            maxHeight: `calc(100vh - ${SELECTION_TOP_OFFSET})`,
          }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setSelectedEntity(null)}
            className="absolute top-1 right-1 z-10 w-6 h-6 flex items-center justify-center text-[#4cc9ff]/80 hover:text-[#7be0ff] hover:bg-[#4cc9ff]/10 text-hud-xs"
          >
            ✕
          </button>

          {selected.imageUrl && (
            <div className="relative overflow-hidden border-b border-[#4cc9ff]/30 flex-shrink-0">
              <img
                src={selected.imageUrl}
                alt=""
                className="w-full h-32 object-cover"
                style={{ filter: 'saturate(0.55) brightness(0.85) contrast(1.05) hue-rotate(-8deg)' }}
                onError={(e) => {
                  const img = e.target as HTMLImageElement
                  const wrapper = img.parentElement
                  if (wrapper) wrapper.style.display = 'none'
                }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(76,201,255,0.18), rgba(2,4,10,0) 40%, rgba(2,4,10,0.55))',
                }}
              />
              <div
                className="absolute inset-0 pointer-events-none opacity-30 mix-blend-screen"
                style={{
                  background:
                    'repeating-linear-gradient(0deg, transparent 0 2px, rgba(124,224,255,0.18) 2px 3px)',
                }}
              />
            </div>
          )}
          <div className="p-3 overflow-y-auto min-h-0">
            <div className="text-hud-xs opacity-60 tracking-[0.18em] uppercase flex items-center justify-between pr-6">
              <span className="truncate">
                {selected.sourceOutlet
                  ? `SOURCE · ${selected.sourceOutlet.toUpperCase()}`
                  : `SELECTED · ${selected.type.toUpperCase()}`}
              </span>
              {selected.category && (
                <span className="opacity-70 flex-shrink-0 ml-2">
                  · {selected.category.toUpperCase()}
                </span>
              )}
            </div>
            <div className="text-hud-md normal-case tracking-normal mt-1 font-medium leading-snug text-[#dfeeff]">
              {selected.title ?? selected.id}
            </div>
            {locationLabel(selected.city, selected.countryCode) && (
              <div className="text-hud-xs tracking-[0.18em] mt-2 text-[#7be0ff]/85 flex items-center gap-1.5">
                <span>◎</span>
                <span>{locationLabel(selected.city, selected.countryCode)}</span>
                {selected.geoPrecision === 'country' && (
                  <span
                    className="ml-2 px-1.5 py-0.5 text-hud-3xs tracking-[0.2em] border border-[#ffb84c]/40 text-[#ffb84c]/85 rounded-sm"
                    title="Coordinates are a country centroid, not a specific point"
                  >
                    ◌ APPROX
                  </span>
                )}
              </div>
            )}
            {selected.summary && (
              <div className="text-hud-sm normal-case tracking-normal mt-2 opacity-80 leading-relaxed">
                {selected.summary}
              </div>
            )}
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              {selected.url && (
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-hud-xs tracking-[0.18em] uppercase text-[#4cc9ff] hover:text-[#7be0ff]"
                >
                  OPEN ARTICLE →
                </a>
              )}
              {/* Share this exact event — any clicked dot is shareable */}
              <ShareButton
                build={() => ({
                  kind: 'cluster',
                  params: ((): Record<string, string> => {
                    if (selected.id.startsWith('cl:'))
                      return { cluster: selected.id.replace(/^cl:/, '') }
                    if (selected.lat != null && selected.lon != null)
                      return { focus: `${selected.lat},${selected.lon}` }
                    return {}
                  })(),
                  title: selected.title ?? null,
                  place:
                    locationLabel(selected.city, selected.countryCode) ||
                    selected.city ||
                    null,
                  answer: selected.summary ?? null,
                  flyLat: selected.lat ?? null,
                  flyLon: selected.lon ?? null,
                  stats: {},
                })}
              />
            </div>
          </div>
        </div>
      )}

      {/* JARVIS top-stories briefing overlay — token-fired by the BRIEFING button.
          Self-contained: fetches, sequences, dispatches flyTo/setSelectedEntity. */}
      {briefingActive && <Briefing onClose={() => setBriefingActive(false)} />}
    </div>
  )
}
