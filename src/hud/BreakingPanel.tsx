import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { audio } from '../audio/audio'
import { speak } from '../audio/voice'
import { countryName as countryNameFromCode } from '../globe/countries'
import type { DotRecord } from '../globe/dots'

const BREAKING_COUNT = 6

function isNewsDot(d: DotRecord): boolean {
  return !d.id.startsWith('mkt:')
}

// Top-left: WORLDVIEW header + breaking-news list.
export function BreakingPanel() {
  const dots = useAppStore((s) => s.dots)
  const selected = useAppStore((s) => s.selectedEntity)
  const setSelectedEntity = useAppStore((s) => s.setSelectedEntity)
  const setFlyToTarget = useAppStore((s) => s.setFlyToTarget)
  const eventCount = useAppStore((s) => s.eventCount)

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

  return (
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
  )
}
