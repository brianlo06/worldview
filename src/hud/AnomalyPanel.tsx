import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { audio } from '../audio/audio'
import { fetchCluster, type AnomalyDriverStory } from '../api/client'
import { countryName } from '../globe/countries'

function began(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000))
  if (mins < 60) return `${mins}M AGO`
  return `${Math.round(mins / 60)}H AGO`
}

// Right column: anomaly cards. Collapsed: region, spike, one-line synopsis.
// Expanded (click): baseline gauge + the driver stories, each clickable —
// flies to the cluster and opens it in the selection card.
export function AnomalyPanel() {
  const anomalyListRef = useRef<HTMLDivElement>(null)
  const [anomaliesOverflow, setAnomaliesOverflow] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const anomalies = useAppStore((s) => s.anomalies)
  const setFlyToTarget = useAppStore((s) => s.setFlyToTarget)
  const setSelectedEntity = useAppStore((s) => s.setSelectedEntity)

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
  }, [anomalies, expandedId])

  function onCardClick(a: (typeof anomalies)[number]) {
    audio.click()
    const expanding = expandedId !== a.id
    setExpandedId(expanding ? a.id : null)
    if (expanding && a.pulse_lat !== null && a.pulse_lon !== null) {
      setFlyToTarget({ lat: a.pulse_lat, lon: a.pulse_lon })
    }
  }

  async function openStory(s: AnomalyDriverStory) {
    audio.click()
    const dot = await fetchCluster(s.cluster_id)
    if (!dot) return
    setFlyToTarget({ lat: dot.lat, lon: dot.lon, id: dot.id })
    setSelectedEntity({
      type: 'cluster',
      id: dot.id,
      title: dot.title,
      summary: dot.summary,
      imageUrl: dot.imageUrl,
      url: dot.url,
      sourceOutlet: dot.sourceOutlet,
      occurredAt: dot.occurredAt,
      category: dot.category,
      countryCode: dot.countryCode,
      city: dot.city,
      geoPrecision: dot.geoPrecision,
      lat: dot.lat,
      lon: dot.lon,
    })
  }

  return (
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
            const region = countryName(a.region_code) ?? a.region_code
            const mult = a.peak_rate / Math.max(a.baseline_rate, 0.1)
            const expanded = expandedId === a.id
            const stories = a.driver_stories ?? []
            return (
              <div
                key={a.id}
                style={{ animationDelay: `${ai * 60}ms` }}
                className={`hud-panel-in border bg-[#02040a]/80 backdrop-blur-sm transition ${
                  expanded
                    ? 'border-[#ff5a4a] bg-[#ff5a4a]/6'
                    : 'border-[#ff5a4a]/60 hover:bg-[#ff5a4a]/8'
                }`}
              >
                {/* Header — click to expand + fly to the region */}
                <div
                  onClick={() => onCardClick(a)}
                  className="px-3 py-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-hud-xs tracking-[0.18em] uppercase">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{
                        background: '#ff5a4a',
                        boxShadow: `0 0 ${6 * pulse}px #ff5a4a, 0 0 ${14 * pulse}px #ff5a4a80`,
                      }}
                    />
                    <span className="text-[#ffb59a] truncate">ANOMALY · {region}</span>
                    <span className="opacity-60 ml-auto flex-shrink-0 tabular-nums">
                      {mult.toFixed(1)}×
                    </span>
                    <span className="text-[#ff5a4a]/80 flex-shrink-0">
                      {expanded ? '▾' : '▸'}
                    </span>
                  </div>
                  <div className="mt-1 text-hud-2xs tracking-[0.2em] text-[#cfe6ff]/55 tabular-nums uppercase">
                    Activity {mult.toFixed(1)}× normal · began {began(a.started_at)}
                  </div>
                  {!expanded && (
                    <div className="text-hud-sm normal-case tracking-normal leading-snug mt-1 opacity-85 line-clamp-2">
                      {a.synopsis ?? stories[0]?.title ?? ''}
                    </div>
                  )}
                </div>

                {/* Expanded: gauge + synopsis + clickable driver stories */}
                {expanded && (
                  <div className="px-3 pb-2.5">
                    {/* Baseline vs now gauge */}
                    <div className="flex justify-between text-hud-2xs tracking-[0.18em] text-[#cfe6ff]/60 tabular-nums">
                      <span>NORMAL {a.baseline_rate.toFixed(1)}/HR</span>
                      <span className="text-[#ffb59a]">NOW {a.peak_rate.toFixed(0)}/HR</span>
                    </div>
                    <div className="relative h-1.5 mt-1 bg-[#4cc9ff]/10 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 w-full"
                        style={{
                          background:
                            'linear-gradient(90deg, #ffb84c66, #ff5a4a)',
                        }}
                      />
                      {/* Baseline tick — where "normal" sits on this scale */}
                      <div
                        className="absolute -inset-y-0.5 w-[2px] bg-[#7be0ff]"
                        style={{
                          left: `${Math.min(95, (a.baseline_rate / Math.max(a.peak_rate, 0.1)) * 100)}%`,
                          boxShadow: '0 0 6px #7be0ff',
                        }}
                      />
                    </div>

                    {a.synopsis && (
                      <div className="text-hud-sm normal-case tracking-normal leading-snug mt-2 text-[#dfeeff]/90">
                        {a.synopsis}
                      </div>
                    )}

                    {stories.length > 0 && (
                      <ul className="mt-2 border-t border-[#ff5a4a]/20 pt-1.5 space-y-0.5">
                        {stories.map((s) => (
                          <li
                            key={s.cluster_id}
                            onClick={(e) => {
                              e.stopPropagation()
                              void openStory(s)
                            }}
                            className="group flex items-start gap-1.5 px-1 py-1 cursor-pointer hover:bg-[#4cc9ff]/8 transition"
                          >
                            <span className="text-[#4cc9ff]/70 mt-px flex-shrink-0">▸</span>
                            <span className="text-hud-sm normal-case tracking-normal leading-snug text-[#cfe6ff]/90 group-hover:text-[#eaf4ff]">
                              {s.title}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          </div>
        </>
      )}
    </div>
  )
}
