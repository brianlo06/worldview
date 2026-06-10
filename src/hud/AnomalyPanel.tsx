import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { audio } from '../audio/audio'

// Right column: anomaly cards only. Markets live in the top ticker now.
// The top offset scales with the viewport (clamp) so it always clears
// the fluid-sized clock + status + button row + tier filter above,
// rather than a fixed value that breaks when the text scales up. The
// list scrolls when it can't fit, with a fade hinting there's more.
export function AnomalyPanel() {
  const anomalyListRef = useRef<HTMLDivElement>(null)
  const [anomaliesOverflow, setAnomaliesOverflow] = useState(false)
  const anomalies = useAppStore((s) => s.anomalies)
  const setFlyToTarget = useAppStore((s) => s.setFlyToTarget)

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
  )
}
