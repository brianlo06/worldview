// Tony-Stark-style "TOP STORIES" briefing: JARVIS reads N top headlines
// while the globe flies to each location and the selection card displays
// the current story. Click BRIEFING (HUD) to start, ABORT to stop.
//
// Sequencing is linear async — speak() now returns a Promise, flyTo accepts
// a duration, and we sleep() between phases for breathing room.

import { useEffect, useRef, useState } from 'react'
import { fetchClusters } from '../api/client'
import { useAppStore } from '../store/useAppStore'
import { audio } from '../audio/audio'
import { speak, silence } from '../audio/voice'
import { countryName } from './../globe/countries'
import type { DotRecord } from '../globe/dots'

const STORY_COUNT = 5
const FLY_DURATION_MS = 2500
const POST_SPEECH_PAUSE_MS = 1800

interface BriefingProps {
  onClose: () => void
}

type Phase = 'loading' | 'intro' | 'story' | 'outro' | 'done' | 'aborted' | 'error'

function fmtCoord(value: number, posChar: string, negChar: string): string {
  const c = value >= 0 ? posChar : negChar
  return `${Math.abs(value).toFixed(2)}°${c}`
}

function locationLabel(d: DotRecord): string {
  if (d.city) return d.city.toUpperCase()
  const c = d.countryCode ? countryName(d.countryCode) : null
  return (c ?? 'UNKNOWN REGION').toUpperCase()
}

function firstSentence(s: string | null | undefined, maxChars = 220): string {
  if (!s) return ''
  // Trim to first sentence (or maxChars), strip newlines.
  const cleaned = s.replace(/\s+/g, ' ').trim()
  const m = cleaned.match(/^.{20,}?[.!?](?=\s|$)/)
  const sentence = m ? m[0] : cleaned.slice(0, maxChars)
  return sentence.length > maxChars ? sentence.slice(0, maxChars).trim() + '…' : sentence
}

function composeScript(index: number, total: number, d: DotRecord): string {
  const where = d.city
    ? `In ${d.city}`
    : d.countryCode
      ? `In ${countryName(d.countryCode) ?? 'an unknown region'}`
      : null
  const ord = `Story ${index + 1} of ${total}.`
  const hdr = where ? `${where}.` : ''
  const summary = firstSentence(d.summary)
  return [ord, hdr, d.title + '.', summary].filter(Boolean).join(' ')
}

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(t)
      resolve()
    }, { once: true })
  })

export function Briefing({ onClose }: BriefingProps) {
  const setFlyToTarget = useAppStore((s) => s.setFlyToTarget)
  const setSelectedEntity = useAppStore((s) => s.setSelectedEntity)
  const [phase, setPhase] = useState<Phase>('loading')
  const [stories, setStories] = useState<DotRecord[]>([])
  const [index, setIndex] = useState(0)
  const abortRef = useRef(new AbortController())

  // Run the briefing sequence once on mount. Cancellation is via the abort
  // controller — both speak() (cancelled via silence()) and sleep() honor it.
  useEffect(() => {
    const ctrl = abortRef.current
    const aborted = () => ctrl.signal.aborted

    async function run() {
      let top: DotRecord[]
      try {
        const all = await fetchClusters({
          hours: 24,
          minEvents: 2,
          limit: 200,
          signal: ctrl.signal,
        })
        // Sort by importance, take top N with a valid location.
        top = all
          .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lon))
          .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
          .slice(0, STORY_COUNT)
      } catch {
        if (!aborted()) setPhase('error')
        return
      }
      if (aborted()) return
      if (top.length === 0) {
        setPhase('error')
        return
      }
      setStories(top)
      setPhase('intro')

      // Intro
      audio.whoosh(0.5)
      await speak(
        `Good evening. Top ${top.length} stories at this hour.`,
        { rate: 0.95 },
      )
      if (aborted()) return
      await sleep(400, ctrl.signal)
      if (aborted()) return

      // Stories
      setPhase('story')
      for (let i = 0; i < top.length; i++) {
        if (aborted()) return
        const d = top[i]
        setIndex(i)

        // Fly the globe + push the story into the selection card.
        setFlyToTarget({ lat: d.lat, lon: d.lon, id: d.id, durationMs: FLY_DURATION_MS })
        setSelectedEntity({
          type: 'cluster',
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
        })

        // Let the camera settle before JARVIS starts talking.
        await sleep(FLY_DURATION_MS * 0.6, ctrl.signal)
        if (aborted()) return
        audio.chime()
        await sleep(250, ctrl.signal)
        if (aborted()) return

        await speak(composeScript(i, top.length, d), { rate: 0.95 })
        if (aborted()) return
        await sleep(POST_SPEECH_PAUSE_MS, ctrl.signal)
      }

      // Outro
      if (aborted()) return
      setPhase('outro')
      audio.whoosh(0.4)
      await speak('End of briefing.', { rate: 0.95 })
      if (aborted()) return
      setSelectedEntity(null)
      setPhase('done')
      // Brief settle then close
      await sleep(800, ctrl.signal)
      if (aborted()) return
      onClose()
    }

    void run()

    return () => {
      // Abort on unmount or re-run.
      ctrl.abort()
      silence()
      // Don't wipe selectedEntity on abort — user may want to keep it.
    }
    // onClose is stable from parent; intentionally not in deps to avoid re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleAbort() {
    abortRef.current.abort()
    silence()
    setPhase('aborted')
    onClose()
  }

  const total = stories.length
  const current = stories[index]
  const num = String(index + 1).padStart(2, '0')
  const totalStr = String(total).padStart(2, '0')

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[900] flex flex-col items-center pt-[5.5rem]">
      {/* Top-center holo banner */}
      <div
        className="pointer-events-auto holo-frame border border-[#7be0ff]/40 bg-[#02040a]/85 backdrop-blur-sm px-6 py-3 min-w-[26rem] text-center"
        style={{ boxShadow: '0 0 24px rgba(124,224,255,0.25)' }}
      >
        <div className="text-hud-xs tracking-[0.42em] text-[#4cc9ff]/80 flex items-center justify-center gap-2">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{
              background: '#7be0ff',
              boxShadow: '0 0 6px #7be0ff, 0 0 12px #4cc9ff80',
              animation: 'pulse 1.4s ease-in-out infinite',
            }}
          />
          <span>TOP STORIES BRIEFING</span>
          <span className="opacity-60">·</span>
          <span className="text-[#7be0ff] tabular-nums">{num} / {totalStr || '—'}</span>
        </div>

        <div
          className="mt-1.5 text-[#7be0ff] text-hud-md tracking-[0.32em] tabular-nums leading-tight min-h-[1.4em]"
          style={{ textShadow: '0 0 10px rgba(124,224,255,0.55)' }}
        >
          {phase === 'loading' && 'ACQUIRING SIGNAL'}
          {phase === 'intro' && 'INITIALIZING BRIEFING'}
          {phase === 'story' && current && locationLabel(current)}
          {phase === 'outro' && 'BRIEFING COMPLETE'}
          {phase === 'done' && 'BRIEFING COMPLETE'}
          {phase === 'error' && 'NO DATA AVAILABLE'}
          {phase === 'aborted' && 'ABORTED'}
        </div>

        {phase === 'story' && current && (
          <div className="mt-1 text-hud-xs tracking-[0.3em] text-[#cfe6ff]/70 tabular-nums">
            {fmtCoord(current.lat, 'N', 'S')} · {fmtCoord(current.lon, 'E', 'W')}
            {current.countryCode ? ` · ${current.countryCode.toUpperCase()}` : ''}
          </div>
        )}

        {/* Segmented progress dots */}
        {total > 0 && (
          <div className="mt-2.5 flex justify-center gap-1.5">
            {stories.map((_, i) => (
              <span
                key={i}
                className="h-0.5 w-8 transition-all duration-300"
                style={{
                  background: i < index ? '#4cc9ff80' : i === index ? '#7be0ff' : '#4cc9ff20',
                  boxShadow: i === index ? '0 0 8px #7be0ff' : undefined,
                }}
              />
            ))}
          </div>
        )}

        <button
          onClick={handleAbort}
          className="pointer-events-auto mt-3 text-hud-xs tracking-[0.3em] text-[#ff8f6b]/80 hover:text-[#ffb59a] border border-[#ff8f6b]/30 hover:border-[#ff8f6b]/60 px-3 py-1"
        >
          ◢ ABORT
        </button>
      </div>
    </div>
  )
}
