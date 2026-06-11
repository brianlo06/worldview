// Tony-Stark-style "TOP STORIES" briefing: JARVIS reads N top headlines
// while the globe flies to each location and the selection card displays
// the current story. Click BRIEFING (HUD) to start, ABORT to stop.
//
// Sequencing is linear async — speak() now returns a Promise, flyTo accepts
// a duration, and we sleep() between phases for breathing room.

import { useEffect, useRef, useState } from 'react'
import {
  fetchBriefing,
  fetchClusterImages,
  fetchClusters,
  type BriefingScript,
} from '../api/client'
import { useAppStore } from '../store/useAppStore'
import { audio } from '../audio/audio'
import { speak, silence } from '../audio/voice'
import { countryName } from './../globe/countries'
import { Hologram } from './Hologram'
import type { DotRecord } from '../globe/dots'

const STORY_COUNT = 5
const FLY_DURATION_MS = 2500
const POST_SPEECH_PAUSE_MS = 1800

// End-of-show "soft reset": glide back to the boot framing before handing
// the camera to the tour. Derived from scene.ts camera.position.set(1.4,
// 1.4, 2.5) → lat/lon/distance of the wide Atlantic view the app opens on.
const HOME_LAT = 26.0
const HOME_LON = -60.8
const HOME_DISTANCE = 3.19
const HOME_RESET_MS = 2800

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

// Primary narration comes from the server (POST /briefing), which rewrites the
// stories into conversational speech. The helpers below are only used by the
// client-side fallback that kicks in if that endpoint is unreachable — a
// lightweight version of the server's clean-up so playback still works.

// Strip feed codes / markup / separator runs so TTS doesn't read them aloud.
function cleanSpeech(s: string | null | undefined, maxChars = 220): string {
  if (!s) return ''
  let t = s.replace(/\s+/g, ' ').trim()
  t = t.replace(/^[A-Z]{4,}\d*\b[\s:.-]*/, '') // leading wire code, e.g. "SVRTOP "
  // NWS title tail: "... issued June 9 at 11:13PM CDT until ... by NWS Topeka"
  t = t.replace(/\s+issued\s+\w+\s+\d{1,2}\s+at\s+\d{1,2}:\d{2}\s*[AP]M\b.*$/i, '')
  t = t.replace(/\s*(?:\.{2,}|…)+\s*/g, ', ') // dotted separators
  t = t.replace(/\s*\*+\s*/g, ' ') // asterisk bullets
  t = t.replace(/\s+/g, ' ').replace(/^[\s,.]+|[\s,]+$/g, '')
  const m = t.match(/^.{20,}?[.!?](?=\s|$)/)
  const sentence = m ? m[0] : t.slice(0, maxChars)
  return sentence.length > maxChars ? sentence.slice(0, maxChars).trim() + '…' : sentence
}

function fallbackNarration(d: DotRecord): string {
  const place = d.city ?? (d.countryCode ? countryName(d.countryCode) : null)
  const title = cleanSpeech(d.title, 160)
  const hdr = title && !/[.!?]$/.test(title) ? `${title}.` : title
  const summary = cleanSpeech(d.summary)
  const body = summary && summary.toLowerCase() !== title.toLowerCase() ? summary : ''
  // "In Topeka: ..." reads as one phrase; "In Topeka. ..." makes TTS deliver
  // the place as its own clipped sentence.
  const lead = place && hdr ? `In ${place}: ${hdr}` : place ? `In ${place}.` : hdr
  return [lead, body].filter(Boolean).join(' ')
}

// Client-side fallback: if POST /briefing is unreachable, fall back to the old
// behavior — fetch clusters directly and build a cleaned-up script locally.
async function clientFallbackScript(signal: AbortSignal): Promise<BriefingScript> {
  const all = await fetchClusters({ hours: 24, minEvents: 2, limit: 200, signal })
  const dots = all
    .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lon))
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
    .slice(0, STORY_COUNT)
  return {
    intro: "The world's been busy — here's what's happening right now.",
    stories: dots.map((d) => ({ dot: d, narration: fallbackNarration(d), holoUrl: null })),
    outro: "That's the picture for now. I'll keep watch.",
    source: 'fallback',
  }
}

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(t)
      resolve()
    }, { once: true })
  })

// Caption text that materializes word by word (each word staggers in with a
// blur-fade), lights up karaoke-style as JARVIS actually speaks each word
// (spoken = highest spoken word index), then blur-fades out as a block once
// the narration is done. Keyed per story by the parent so the stagger
// restarts.
function Caption({ text, spoken }: { text: string; spoken: number }) {
  return (
    <div className="mt-1.5 text-hud-sm normal-case tracking-normal leading-relaxed text-[#dfeeff]/90">
      {text.split(/\s+/).map((w, i) => (
        <span
          key={i}
          className={`briefing-word ${i <= spoken ? 'briefing-word-spoken' : ''}`}
          style={{ animationDelay: `${Math.min(i * 32, 1400)}ms` }}
        >
          {w + ' '}
        </span>
      ))}
    </div>
  )
}

export function Briefing({ onClose }: BriefingProps) {
  const setFlyToTarget = useAppStore((s) => s.setFlyToTarget)
  const setSelectedEntity = useAppStore((s) => s.setSelectedEntity)
  const setBriefingPin = useAppStore((s) => s.setBriefingPin)
  const [phase, setPhase] = useState<Phase>('loading')
  const [stories, setStories] = useState<DotRecord[]>([])
  const [narrations, setNarrations] = useState<string[]>([])
  const [holos, setHolos] = useState<(string | null)[]>([])
  const [introText, setIntroText] = useState('')
  const [outroText, setOutroText] = useState('')
  const [index, setIndex] = useState(0)
  const [images, setImages] = useState<string[]>([])
  const [imgIdx, setImgIdx] = useState(0)
  // True once the current caption has been fully spoken — drives the
  // transition-out so finished captions don't just sit there (or vanish).
  const [captionDone, setCaptionDone] = useState(false)
  // Highest word index spoken so far in the current segment (karaoke sync).
  const [spokenWord, setSpokenWord] = useState(-1)
  const abortRef = useRef(new AbortController())

  // Visual carousel: while a story is narrated, cycle through its cluster's
  // member images like JARVIS shuffling surveillance feeds.
  useEffect(() => {
    if (phase !== 'story' || images.length < 2) return
    const id = setInterval(() => setImgIdx((i) => i + 1), 3200)
    return () => clearInterval(id)
  }, [phase, images])

  // Run the briefing sequence once on mount. Cancellation is via the abort
  // controller — both speak() (cancelled via silence()) and sleep() honor it.
  useEffect(() => {
    const ctrl = abortRef.current
    const aborted = () => ctrl.signal.aborted

    // The tour and the briefing fight over the camera — the tour keeps
    // rotating away from the story the globe just flew to. It stays on
    // through loading + the intro line (the globe keeps its idle spin while
    // JARVIS sets the scene), pauses right before the first story flight,
    // and is restored on any exit path (cleanup runs on all of them).
    const tourWasOn = useAppStore.getState().tourMode

    async function run() {
      // Primary: server-narrated briefing. Fall back to a local script built
      // from /clusters only if the briefing endpoint itself is unreachable.
      let script: BriefingScript
      try {
        script = await fetchBriefing(ctrl.signal)
      } catch {
        try {
          script = await clientFallbackScript(ctrl.signal)
        } catch {
          if (!aborted()) setPhase('error')
          return
        }
      }
      if (aborted()) return
      if (script.stories.length === 0) {
        setPhase('error')
        return
      }
      const dots = script.stories.map((s) => s.dot)
      setStories(dots)
      setNarrations(script.stories.map((s) => s.narration))
      setHolos(script.stories.map((s) => s.holoUrl))
      setIntroText(script.intro)
      setOutroText(script.outro)
      setPhase('intro')

      // Intro
      audio.whoosh(0.5)
      audio.startBed() // open-channel hum under the whole briefing
      setCaptionDone(false)
      setSpokenWord(-1)
      await speak(
        script.intro || `Here are the top ${dots.length} stories at this hour.`,
        { rate: 0.95, onWord: setSpokenWord },
      )
      if (aborted()) return
      setCaptionDone(true) // intro caption fades during the handoff
      await sleep(400, ctrl.signal)
      if (aborted()) return

      // Intro's done — take the camera from the tour for the story flights.
      if (tourWasOn) useAppStore.getState().setTourMode(false)

      // Stories
      setPhase('story')
      for (let i = 0; i < script.stories.length; i++) {
        if (aborted()) return
        const { dot: d, narration } = script.stories[i]
        setIndex(i)
        setCaptionDone(false)
        setSpokenWord(-1)

        // Visual feed: start with the story's own image, then pull the
        // cluster's member images in the background for the carousel.
        setImages(d.imageUrl ? [d.imageUrl] : [])
        setImgIdx(0)
        if (d.id.startsWith('cl:')) {
          void fetchClusterImages(d.id, ctrl.signal).then((urls) => {
            if (!ctrl.signal.aborted && urls.length > 0) setImages(urls)
          })
        }

        // Sonar ring on the globe at the narrated location.
        setBriefingPin({ lat: d.lat, lon: d.lon })

        // Fly the globe. The lower-third carries the story visuals/text now —
        // the selection card stays out of the way so the globe (and the ring)
        // are visible at screen center during playback.
        setFlyToTarget({ lat: d.lat, lon: d.lon, id: d.id, durationMs: FLY_DURATION_MS })

        // Let the camera settle before JARVIS starts talking.
        await sleep(FLY_DURATION_MS * 0.6, ctrl.signal)
        if (aborted()) return
        audio.chime()
        await sleep(250, ctrl.signal)
        if (aborted()) return

        await speak(narration || fallbackNarration(d), {
          rate: 0.95,
          onWord: setSpokenWord,
        })
        if (aborted()) return
        // Caption's been read — let it transition out during the pause.
        setCaptionDone(true)
        await sleep(POST_SPEECH_PAUSE_MS, ctrl.signal)
      }

      // Outro
      if (aborted()) return
      setBriefingPin(null)
      setImages([])
      setPhase('outro')
      setCaptionDone(false)
      setSpokenWord(-1)
      audio.whoosh(0.4)
      await speak(script.outro || 'End of briefing.', {
        rate: 0.95,
        onWord: setSpokenWord,
      })
      if (aborted()) return
      audio.stopBed()
      setCaptionDone(true) // the whole lower-third sinks away after the outro
      // Soft reset: glide back to the wide home view before the cleanup
      // hands the camera to the tour, so it resumes its idle spin from the
      // framing the app opened on instead of wherever story 5 happened.
      if (tourWasOn) {
        setFlyToTarget({
          lat: HOME_LAT,
          lon: HOME_LON,
          distance: HOME_DISTANCE,
          durationMs: HOME_RESET_MS,
          marker: false,
        })
        await sleep(HOME_RESET_MS, ctrl.signal)
        if (aborted()) return
      }
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
      audio.stopBed()
      // Clear the story ring and hand the camera back to the tour if we
      // borrowed it. Runs on every exit path: done, abort, error, unmount.
      useAppStore.getState().setBriefingPin(null)
      if (tourWasOn) useAppStore.getState().setTourMode(true)
      // Don't wipe selectedEntity on abort — user may want to keep it.
    }
    // onClose is stable from parent; intentionally not in deps to avoid re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleAbort() {
    abortRef.current.abort()
    silence()
    // Hand the aborted story to the selection card so the user can keep
    // exploring it (article link, share) after the briefing UI is gone.
    const d = stories[index]
    if (d) {
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
    }
    setPhase('aborted')
    onClose()
  }

  const total = stories.length
  const current = stories[index]
  const num = String(index + 1).padStart(2, '0')
  const totalStr = String(total).padStart(2, '0')
  const statusWord =
    phase === 'loading' ? 'ACQUIRING SIGNAL'
    : phase === 'intro' ? 'INITIALIZING'
    : phase === 'story' && current ? locationLabel(current)
    : phase === 'error' ? 'NO DATA AVAILABLE'
    : phase === 'aborted' ? 'ABORTED'
    : 'BRIEFING COMPLETE'
  const subtitle =
    phase === 'story' ? narrations[index]
    : phase === 'intro' ? introText
    : phase === 'outro' ? outroText
    : ''
  const feedSrc =
    phase === 'story' && images.length > 0 ? images[imgIdx % images.length] : null

  return (
    <>
      {/* Slim top status strip — the globe (and the story's sonar ring) own
          the center of the screen; this only carries state + controls. */}
      <div className="pointer-events-none fixed inset-x-0 top-[5.5rem] z-[900] flex justify-center px-4">
        <div
          className="pointer-events-auto holo-frame border border-[#7be0ff]/40 bg-[#02040a]/85 backdrop-blur-sm px-4 py-1.5 flex items-center gap-3"
          style={{ boxShadow: '0 0 24px rgba(124,224,255,0.25)' }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              background: '#7be0ff',
              boxShadow: '0 0 6px #7be0ff, 0 0 12px #4cc9ff80',
              animation: 'pulse 1.4s ease-in-out infinite',
            }}
          />
          <span className="text-hud-xs tracking-[0.42em] text-[#4cc9ff]/80">
            TOP STORIES BRIEFING
          </span>
          <span className="text-hud-xs text-[#7be0ff] tabular-nums tracking-[0.2em]">
            {num} / {totalStr || '—'}
          </span>
          <span
            key={statusWord}
            className="briefing-status-in text-hud-xs tracking-[0.32em] text-[#7be0ff] tabular-nums"
            style={{ textShadow: '0 0 10px rgba(124,224,255,0.55)' }}
          >
            {statusWord}
          </span>
          {total > 0 && (
            <span className="flex gap-1">
              {stories.map((_, i) => (
                <span
                  key={i}
                  className="h-0.5 w-5 transition-all duration-300"
                  style={{
                    background: i < index ? '#4cc9ff80' : i === index ? '#7be0ff' : '#4cc9ff20',
                    boxShadow: i === index ? '0 0 8px #7be0ff' : undefined,
                  }}
                />
              ))}
            </span>
          )}
          <button
            onClick={handleAbort}
            className="text-hud-2xs tracking-[0.3em] text-[#ff8f6b]/80 hover:text-[#ffb59a] border border-[#ff8f6b]/30 hover:border-[#ff8f6b]/60 px-2 py-0.5"
          >
            ◢ ABORT
          </button>
        </div>
      </div>

      {/* Holographic scene reconstruction, projected stage-right while a
          story plays. Keyed by story so the projection re-materializes per
          headline instead of morphing between them. */}
      {phase === 'story' && current && (
        <Hologram
          key={current.id}
          src={holos[index] ?? null}
          fallbackSrc={current.imageUrl ?? null}
          index={index}
          total={total}
          label={locationLabel(current)}
        />
      )}

      {/* Lower-third: visual feed + narration, broadcast style. Sits above
          the telemetry readout, leaving the globe center unobstructed. */}
      {(subtitle || feedSrc) && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[4.5rem] z-[900] flex justify-center px-4">
          <div
            className={`briefing-lower-in pointer-events-auto holo-frame border border-[#7be0ff]/40 bg-[#02040a]/85 backdrop-blur-sm flex items-stretch w-[52rem] max-w-full overflow-hidden text-left ${
              captionDone && phase === 'outro' ? 'briefing-lower-out' : ''
            }`}
            style={{ boxShadow: '0 0 24px rgba(124,224,255,0.2)' }}
          >
            {feedSrc && (
              <div className="relative w-72 flex-shrink-0 min-h-[10.5rem] overflow-hidden border-r border-[#4cc9ff]/25 bg-[#02040a]">
                <img
                  key={feedSrc}
                  src={feedSrc}
                  alt=""
                  className="briefing-img absolute inset-0 w-full h-full object-cover"
                  onError={() => setImages((prev) => prev.filter((u) => u !== feedSrc))}
                />
                {/* Holo grade + scanlines, matching the selection card treatment */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(76,201,255,0.16), rgba(2,4,10,0) 35%, rgba(2,4,10,0.6))',
                  }}
                />
                <div
                  className="absolute inset-0 pointer-events-none opacity-25 mix-blend-screen"
                  style={{
                    background:
                      'repeating-linear-gradient(0deg, transparent 0 2px, rgba(124,224,255,0.18) 2px 3px)',
                  }}
                />
                {/* Targeting corner brackets */}
                <span className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-[#7be0ff]/90" />
                <span className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-[#7be0ff]/90" />
                <span className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-[#7be0ff]/90" />
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-[#7be0ff]/90" />
                {/* Feed counter */}
                {images.length > 1 && (
                  <div className="absolute bottom-1 right-1.5 text-hud-2xs tracking-[0.3em] text-[#7be0ff]/85 tabular-nums">
                    {String((imgIdx % images.length) + 1).padStart(2, '0')}/
                    {String(images.length).padStart(2, '0')}
                  </div>
                )}
                <div className="absolute bottom-1 left-1.5 text-hud-2xs tracking-[0.3em] text-[#4cc9ff]/60">
                  ◉ LIVE FEED
                </div>
              </div>
            )}
            <div
              key={`${phase}-${index}`}
              className={`flex-1 px-4 py-3 min-w-0 flex flex-col justify-center ${
                captionDone ? 'briefing-text-out' : ''
              }`}
            >
              {phase === 'story' && current && (
                <div className="briefing-sub text-hud-2xs tracking-[0.3em] text-[#cfe6ff]/70 tabular-nums uppercase">
                  {locationLabel(current)} · {fmtCoord(current.lat, 'N', 'S')} ·{' '}
                  {fmtCoord(current.lon, 'E', 'W')}
                  {current.countryCode ? ` · ${current.countryCode.toUpperCase()}` : ''}
                </div>
              )}
              {subtitle && <Caption text={subtitle} spoken={spokenWord} />}
              {phase === 'story' && current?.url && (
                <a
                  href={current.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="briefing-sub mt-2 text-hud-2xs tracking-[0.25em] uppercase text-[#4cc9ff] hover:text-[#7be0ff]"
                >
                  OPEN ARTICLE →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
