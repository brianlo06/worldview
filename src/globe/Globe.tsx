import { useEffect, useMemo, useRef, useState } from 'react'
import { createScene, type SceneHandle } from './scene'
import { loadEarthTextures } from './textures'
import { useAppStore } from '../store/useAppStore'
import {
  fetchAnomalies,
  fetchClusters,
  fetchMarkets,
  fetchRecentEvents,
} from '../api/client'
import { audio } from '../audio/audio'
import { speak } from '../audio/voice'
import { countryName } from './countries'
import type { DotRecord } from './dots'
import { passesTier } from './tiers'

// Fallback set used when the API is unreachable, so the page still demos.
const SEED_DOTS: DotRecord[] = [
  { id: 'nyc', lat: 40.71, lon: -74.0, title: 'New York', importance: 0.9, category: 'business' },
  { id: 'lon', lat: 51.51, lon: -0.13, title: 'London', importance: 0.85, category: 'business' },
  { id: 'tok', lat: 35.68, lon: 139.69, title: 'Tokyo', importance: 0.88, category: 'business' },
  { id: 'syd', lat: -33.87, lon: 151.21, title: 'Sydney', importance: 0.55, category: 'weather' },
  { id: 'rio', lat: -22.9, lon: -43.21, title: 'Rio de Janeiro', importance: 0.7, category: 'social' },
  { id: 'cai', lat: 30.04, lon: 31.24, title: 'Cairo', importance: 0.65, category: 'politics' },
  { id: 'del', lat: 28.61, lon: 77.21, title: 'Delhi', importance: 0.75, category: 'politics' },
  { id: 'sfo', lat: 37.77, lon: -122.42, title: 'San Francisco', importance: 0.7, category: 'business' },
  { id: 'mos', lat: 55.75, lon: 37.62, title: 'Moscow', importance: 0.72, category: 'politics' },
  { id: 'kyiv', lat: 50.45, lon: 30.52, title: 'Kyiv', importance: 0.92, category: 'conflict', breaking: true },
  { id: 'gaza', lat: 31.5, lon: 34.47, title: 'Gaza', importance: 0.9, category: 'conflict', breaking: true },
  { id: 'taipei', lat: 25.03, lon: 121.57, title: 'Taipei Strait', importance: 0.78, category: 'conflict' },
  { id: 'manila', lat: 14.6, lon: 120.98, title: 'Typhoon track · Luzon', importance: 0.7, category: 'weather' },
  { id: 'lima', lat: -12.05, lon: -77.04, title: 'Earthquake aftershocks · Peru', importance: 0.65, category: 'quake', breaking: true },
  { id: 'tehran', lat: 35.7, lon: 51.42, title: 'Protests · Tehran', importance: 0.72, category: 'social' },
]

const REFRESH_INTERVAL_MS = 60_000

export function Globe() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<SceneHandle | null>(null)
  const setSelectedEntity = useAppStore((s) => s.setSelectedEntity)
  const setApiStatus = useAppStore((s) => s.setApiStatus)
  const setEventCount = useAppStore((s) => s.setEventCount)
  const setDotsInStore = useAppStore((s) => s.setDots)
  const setLastUpdated = useAppStore((s) => s.setLastUpdated)
  const setMarkets = useAppStore((s) => s.setMarkets)
  const setCameraTelemetry = useAppStore((s) => s.setCameraTelemetry)
  const tourMode = useAppStore((s) => s.tourMode)
  const autoPulse = useAppStore((s) => s.autoPulse)
  const flyToTarget = useAppStore((s) => s.flyToTarget)
  const setFlyToTarget = useAppStore((s) => s.setFlyToTarget)
  const layerMode = useAppStore((s) => s.layerMode)
  const searchResults = useAppStore((s) => s.searchResults)
  const allDots = useAppStore((s) => s.dots)
  const anomalies = useAppStore((s) => s.anomalies)
  const setAnomalies = useAppStore((s) => s.setAnomalies)
  const disabledCategories = useAppStore((s) => s.disabledCategories)
  const significanceTier = useAppStore((s) => s.significanceTier)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // Boot
  useEffect(() => {
    let cancelled = false
    const abort = new AbortController()

    ;(async () => {
      try {
        // Load textures + events (clusters or raw, by mode) + markets in parallel
        const newsFetch =
          layerMode === 'clusters'
            ? fetchClusters({ hours: 48, minEvents: 1, limit: 2000, signal: abort.signal })
            : fetchRecentEvents({
                hours: 48,
                limit: 2000,
                minImportance: 0.3,
                signal: abort.signal,
              })

        const [textures, eventsResult, marketsResult] = await Promise.all([
          loadEarthTextures((loaded, total) => {
            if (!cancelled) setProgress(Math.round((loaded / total) * 100))
          }),
          newsFetch
            .then((dots) => ({ ok: true as const, dots }))
            .catch((e) => ({ ok: false as const, error: e })),
          fetchMarkets(abort.signal)
            .then((dots) => ({ ok: true as const, dots }))
            .catch((e) => ({ ok: false as const, error: e })),
        ])
        if (cancelled || !containerRef.current) return

        let initialDots: DotRecord[]
        const events = eventsResult.ok ? eventsResult.dots : []
        const markets = marketsResult.ok ? marketsResult.dots : []

        if (events.length > 0 || markets.length > 0) {
          // News only — markets/currencies live in their own HUD panel now
          initialDots = events
          setApiStatus('connected')
          setEventCount(events.length)
          setLastUpdated(Date.now())
        } else {
          initialDots = SEED_DOTS
          setApiStatus('offline')
          setEventCount(SEED_DOTS.length)
          if (!eventsResult.ok) {
            console.warn('worldview-api events fetch failed:', eventsResult.error)
          }
        }
        setDotsInStore(initialDots)
        setMarkets(markets)

        const handle = createScene(containerRef.current, {
          textures,
          initialDots,
          initialTourMode: tourMode,
          onTelemetry: setCameraTelemetry,
        })
        handle.onPick((rec) => {
          if (rec) {
            setSelectedEntity({
              type: 'event',
              id: rec.id,
              title: rec.title,
              summary: rec.summary,
              imageUrl: rec.imageUrl,
              url: rec.url,
              sourceOutlet: rec.sourceOutlet,
              occurredAt: rec.occurredAt,
              category: rec.category,
              countryCode: rec.countryCode,
              city: rec.city,
              geoPrecision: rec.geoPrecision,
            })
          } else {
            setSelectedEntity(null)
          }
        })
        sceneRef.current = handle
        setReady(true)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load globe')
        }
      }
    })()

    return () => {
      cancelled = true
      abort.abort()
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [setSelectedEntity, setApiStatus, setEventCount])

  useEffect(() => {
    sceneRef.current?.setTourMode(tourMode)
    if (tourMode) speak('Tour engaged.')
  }, [tourMode])

  useEffect(() => {
    sceneRef.current?.setAutoPulse(autoPulse)
  }, [autoPulse])

  // When search is active, render only the matching clusters. Markets/currencies
  // are no longer dots — they live in the right-side HUD panel.
  const sceneDots = useMemo(() => {
    const base: DotRecord[] = searchResults ?? allDots
    return base.filter((d) => {
      if (!passesTier(d, significanceTier)) return false
      // "Breaking" toggle filters on the boolean breaking flag — there is no
      // primary category named "breaking"; it's a tag layered on top of others.
      if (disabledCategories.has('breaking') && d.breaking) return false
      if (d.category && disabledCategories.has(d.category)) return false
      return true
    })
  }, [allDots, searchResults, disabledCategories, significanceTier])

  useEffect(() => {
    sceneRef.current?.setDots(sceneDots)
  }, [sceneDots])

  // Poll anomalies every 60s; on first arrival of a new anomaly id, chime once.
  // seenIds lives in a ref (not effect deps) so setAnomalies → re-render does
  // NOT tear down and rebuild the interval — that would reset the poll cadence,
  // fire an extra fetch every cycle, and defeat the new-anomaly dedup.
  const seenAnomalyIds = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!ready) return
    let cancelled = false

    const tick = async () => {
      try {
        const fresh = await fetchAnomalies()
        if (cancelled) return
        const seen = seenAnomalyIds.current
        if (seen === null) {
          // First poll primes the baseline — don't chime for what's already live
          seenAnomalyIds.current = new Set(fresh.map((a) => a.id))
        } else {
          const newOnes = fresh.filter((a) => !seen.has(a.id))
          if (newOnes.length > 0) {
            audio.chime()
            // JARVIS calls out the region for the first new anomaly each round
            const first = newOnes[0]
            const place = countryName(first.region_code) ?? first.region_code
            speak(`Anomaly detected in ${place}.`)
          }
          for (const a of fresh) seen.add(a.id)
        }
        setAnomalies(fresh)
      } catch (e) {
        if (!cancelled) console.warn('anomaly fetch failed', e)
      }
    }
    void tick()
    const id = setInterval(tick, 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [ready, setAnomalies])

  // Push active anomaly pins to the sonar-ring marker layer — these are big,
  // persistent rings that float above the dot cloud, unlike the small one-shot
  // breaking-news pulses
  useEffect(() => {
    if (!ready) return
    const pins = anomalies
      .filter((a) => a.pulse_lat !== null && a.pulse_lon !== null)
      .map((a) => ({ lat: a.pulse_lat!, lon: a.pulse_lon! }))
    sceneRef.current?.setAnomalyPins(pins)
  }, [ready, anomalies])

  // FlyTo action signal — applied once then cleared
  useEffect(() => {
    if (!flyToTarget || !sceneRef.current) return
    sceneRef.current.flyTo(flyToTarget.lat, flyToTarget.lon)
    setFlyToTarget(null)
  }, [flyToTarget, setFlyToTarget])

  // Auto-refresh every REFRESH_INTERVAL_MS, also triggers when layerMode changes
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const tick = async () => {
      try {
        const newsFetch =
          layerMode === 'clusters'
            ? fetchClusters({ hours: 48, minEvents: 1, limit: 2000 })
            : fetchRecentEvents({ hours: 48, limit: 2000, minImportance: 0.3 })
        const [events, markets] = await Promise.all([newsFetch, fetchMarkets()])
        if (cancelled) return
        setDotsInStore(events)
        setMarkets(markets)
        setEventCount(events.length)
        setApiStatus('connected')
        setLastUpdated(Date.now())
        sceneRef.current?.setDots(events)
      } catch (e) {
        if (!cancelled) {
          setApiStatus('offline')
          console.warn('refresh failed:', e)
        }
      }
    }
    // Fetch immediately when layerMode changes, then on interval
    void tick()
    const id = setInterval(tick, REFRESH_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [ready, layerMode, setDotsInStore, setEventCount, setApiStatus, setLastUpdated, setMarkets])

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />
      {!ready && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[#4cc9ff] text-xs tracking-[0.3em]">
          INITIALIZING · {progress}%
        </div>
      )}
      {error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[#ff8888] text-xs tracking-[0.2em]">
          ERROR · {error}
        </div>
      )}
    </>
  )
}
