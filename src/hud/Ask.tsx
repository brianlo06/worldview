// "Ask the globe" — the general-public hero surface. A single input + one-tap
// chips + a "view from your city" gesture, all routed through POST /ask. The
// answer card carries a Share button (POST /share → /s/<id> link), and the
// whole thing hydrates from / writes to the URL so a shared link drops the
// visitor straight back into the moment and invites them to ask their own.

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import {
  askGlobe,
  createShare,
  fetchCluster,
  type AskAnswer,
  type AskResultItem,
} from '../api/client'
import { audio } from '../audio/audio'
import { speak } from '../audio/voice'

interface Chip {
  label: string
  q: string
}

// General-public phrasing, not OSINT-speak. These line up with the backend's
// pre-baked + intent-normalized cache keys, so they're warm and cheap.
const CHIPS: Chip[] = [
  { label: 'Biggest story right now', q: 'biggest story right now' },
]

// Fallback when geolocation is denied/unavailable — a manual city picker.
const CITY_FALLBACKS: { label: string; lat: number; lon: number }[] = [
  { label: 'New York', lat: 40.71, lon: -74.0 },
  { label: 'London', lat: 51.51, lon: -0.13 },
  { label: 'Tokyo', lat: 35.68, lon: 139.69 },
  { label: 'Paris', lat: 48.85, lon: 2.35 },
]

type Status = 'idle' | 'pending' | 'error'

function readParams(): URLSearchParams {
  return new URLSearchParams(window.location.search)
}

function writeParams(next: Record<string, string | null>) {
  const params = readParams()
  for (const [k, v] of Object.entries(next)) {
    if (v == null || v === '') params.delete(k)
    else params.set(k, v)
  }
  const qs = params.toString()
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
  window.history.replaceState(null, '', url)
}

export function Ask() {
  const setFlyToTarget = useAppStore((s) => s.setFlyToTarget)
  const setSelectedEntity = useAppStore((s) => s.setSelectedEntity)
  const apiStatus = useAppStore((s) => s.apiStatus)

  const [question, setQuestion] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [answer, setAnswer] = useState<AskAnswer | null>(null)
  const [askedQuestion, setAskedQuestion] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareStatus, setShareStatus] = useState<Status | 'copied'>('idle')
  const [showCityPicker, setShowCityPicker] = useState(false)
  // arrivedFromShare: came in via a ?ask deep link → prompt them to ask their own.
  const [arrivedFromShare, setArrivedFromShare] = useState(false)
  const [askedOwn, setAskedOwn] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hydratedRef = useRef(false)

  // Fly to a result and open it in the selection card. Tries to fetch the full
  // cluster (for the article link) and falls back to the result's own fields
  // (e.g. near-me events that aren't clusters).
  async function selectResult(r: AskResultItem) {
    if (r.lat != null && r.lon != null) {
      setFlyToTarget({ lat: r.lat, lon: r.lon, id: r.id ?? undefined })
    }
    const dot = r.id ? await fetchCluster(r.id) : null
    if (dot) {
      setSelectedEntity({
        type: 'cluster', id: dot.id, title: dot.title, summary: dot.summary,
        imageUrl: dot.imageUrl, url: dot.url, sourceOutlet: dot.sourceOutlet,
        occurredAt: dot.occurredAt, category: dot.category,
        countryCode: dot.countryCode, city: dot.city, geoPrecision: dot.geoPrecision,
        lat: dot.lat, lon: dot.lon,
      })
    } else {
      setSelectedEntity({
        type: 'cluster', id: r.id ? `cl:${r.id}` : 'ask-result',
        title: r.title, summary: r.summary, imageUrl: r.imageUrl, url: null,
        sourceOutlet: r.sourceOutlet, countryCode: r.countryCode, city: r.city,
        lat: r.lat, lon: r.lon,
      })
    }
  }

  // Core ask. lat/lon optional (city / near-me). `fromShare` suppresses the
  // "ask your own" reset so the arrival prompt persists until the user asks.
  async function runAsk(
    q: string,
    opts: { lat?: number; lon?: number; kind?: 'ask' | 'city'; fromShare?: boolean } = {},
  ) {
    const query = q.trim()
    if (!query && opts.lat == null) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setStatus('pending')
    setShareUrl(null)
    setShareStatus('idle')
    setShowCityPicker(false)
    if (!opts.fromShare) setAskedOwn(true)

    try {
      const res = await askGlobe(query, {
        lat: opts.lat,
        lon: opts.lon,
        signal: ctrl.signal,
      })
      if (ctrl.signal.aborted) return
      setAnswer(res)
      setAskedQuestion(query)
      setStatus('idle')

      // Reflect in the URL so this exact moment is linkable/shareable.
      writeParams({
        ask: query,
        lat: opts.lat != null ? String(opts.lat) : null,
        lon: opts.lon != null ? String(opts.lon) : null,
        cluster: null,
      })

      if (res.results.length > 0) {
        audio.whoosh(0.3)
        void selectResult(res.results[0]) // open the top story; the rest list below
      } else if (res.flyLat != null && res.flyLon != null) {
        audio.whoosh(0.3)
        setFlyToTarget({ lat: res.flyLat, lon: res.flyLon })
      }
      // Speak a short confirmation (place keeps it from being noisy).
      if (res.place) speak(res.place)
    } catch (e) {
      if (ctrl.signal.aborted) return
      console.warn('ask failed', e)
      setStatus('error')
    }
  }

  function onSubmit() {
    audio.click()
    void runAsk(question, { kind: 'ask' })
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      clear()
    }
  }

  function clear() {
    abortRef.current?.abort()
    setQuestion('')
    setAnswer(null)
    setAskedQuestion(null)
    setStatus('idle')
    setShareUrl(null)
    setShowCityPicker(false)
    writeParams({ ask: null, lat: null, lon: null, cluster: null })
  }

  function onChip(c: Chip) {
    audio.click()
    setQuestion(c.label)
    void runAsk(c.q, { kind: 'ask' })
  }

  // Prefill the input with "What's happening in " and focus it so the user
  // fills in the place, then hits Enter to ask.
  function onWhatsHappeningPrompt() {
    audio.click()
    setQuestion("What's happening in ")
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (el) {
        el.focus()
        const n = el.value.length
        el.setSelectionRange(n, n)
      }
    })
  }

  function onCityClick() {
    audio.click()
    if (!('geolocation' in navigator)) {
      setShowCityPicker(true)
      return
    }
    setStatus('pending')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setQuestion('From your area')
        void runAsk('whats happening near me', {
          lat: latitude,
          lon: longitude,
          kind: 'city',
        })
      },
      () => {
        // Denied / unavailable → manual picker.
        setStatus('idle')
        setShowCityPicker(true)
      },
      { timeout: 8000, maximumAge: 600000 },
    )
  }

  function onPickCity(city: { label: string; lat: number; lon: number }) {
    audio.click()
    setQuestion(`From ${city.label}`)
    void runAsk(`whats happening near ${city.label}`, {
      lat: city.lat,
      lon: city.lon,
      kind: 'city',
    })
  }

  async function onShare() {
    if (!answer || !askedQuestion) return
    audio.click()
    setShareStatus('pending')
    try {
      const params: Record<string, string> = { ask: askedQuestion }
      const created = await createShare({
        kind: 'ask',
        params,
        title: askedQuestion,
        place: answer.place,
        question: askedQuestion,
        answer: answer.answer,
        flyLat: answer.flyLat,
        flyLon: answer.flyLon,
        stats: answer.stats,
      })
      setShareUrl(created.url)
      setShareStatus('idle')
      // Copy to clipboard for one-tap sharing.
      try {
        await navigator.clipboard.writeText(created.url)
        setShareStatus('copied')
      } catch {
        /* clipboard blocked — link is still shown for manual copy */
      }
    } catch (e) {
      console.warn('share failed', e)
      setShareStatus('error')
    }
  }

  // Hydrate from the URL once on mount: reproduce a shared moment.
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    const p = readParams()
    const askParam = p.get('ask') ?? p.get('q') // ?q is an alias for a free-form ask
    const clusterParam = p.get('cluster')
    const focusParam = p.get('focus') // "lat,lon"
    const latParam = p.get('lat')
    const lonParam = p.get('lon')

    if (askParam) {
      setArrivedFromShare(true)
      setQuestion(askParam)
      const lat = latParam != null ? Number(latParam) : undefined
      const lon = lonParam != null ? Number(lonParam) : undefined
      void runAsk(askParam, {
        lat: Number.isFinite(lat) ? lat : undefined,
        lon: Number.isFinite(lon) ? lon : undefined,
        fromShare: true,
      })
      return
    }
    if (clusterParam) {
      // Fly to + open a specific cluster (unknown/stale id → ignored silently).
      const raw = clusterParam.replace(/^cl:/, '')
      fetchCluster(raw).then((dot) => {
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
      })
      return
    }
    if (focusParam) {
      const [latS, lonS] = focusParam.split(',')
      const lat = Number(latS)
      const lon = Number(lonS)
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        setFlyToTarget({ lat, lon })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const offline = apiStatus === 'offline'
  const hasAnswer = answer !== null
  const showOnboarding = !hasAnswer && status !== 'pending'
  const promptOwn = arrivedFromShare && !askedOwn

  return (
    <div className="w-full pointer-events-auto">
      {/* Loop-close: arriving via a shared link invites you to ask your own */}
      {promptOwn && (
        <div className="mb-2 text-center text-hud-2xs tracking-[0.25em] text-[#7be0ff]/80">
          ◆ SHARED WITH YOU — NOW ASK YOUR OWN
        </div>
      )}

      {/* Input */}
      <div
        className={`flex items-center gap-2 border bg-[#02040a]/75 backdrop-blur-sm px-3 py-2 transition ${
          hasAnswer
            ? 'border-[#7be0ff]/70'
            : 'border-[#4cc9ff]/40 focus-within:border-[#7be0ff]/70'
        }`}
      >
        <span className="text-hud-md opacity-50">▸</span>
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKey}
          placeholder="ASK THE GLOBE   ·   what's happening in Japan?"
          className="flex-1 bg-transparent text-hud-md tracking-wide outline-none text-[#cfe6ff] placeholder:text-[#4cc9ff]/35 normal-case"
          spellCheck={false}
          autoComplete="off"
          disabled={offline}
        />
        {status === 'pending' && <span className="text-hud-xs opacity-60">…</span>}
        {(hasAnswer || question) && status !== 'pending' && (
          <button
            type="button"
            onClick={clear}
            className="text-hud-xs opacity-60 hover:opacity-100"
          >
            CLEAR
          </button>
        )}
      </div>

      {/* Onboarding: chips + "view from your city" */}
      {showOnboarding && !showCityPicker && (
        <div className="mt-2 flex flex-col items-center gap-1.5">
          {/* Row 1: quick chips side by side */}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {CHIPS.map((c) => (
              <button
                key={c.q}
                type="button"
                onClick={() => onChip(c)}
                disabled={offline}
                className="border border-[#4cc9ff]/30 bg-[#02040a]/70 px-2.5 py-1 text-hud-2xs tracking-[0.15em] text-[#cfe6ff]/85 hover:border-[#7be0ff]/60 hover:bg-[#4cc9ff]/8 transition disabled:opacity-40"
              >
                {c.label}
              </button>
            ))}
            <button
              type="button"
              onClick={onWhatsHappeningPrompt}
              disabled={offline}
              className="border border-[#4cc9ff]/30 bg-[#02040a]/70 px-2.5 py-1 text-hud-2xs tracking-[0.15em] text-[#cfe6ff]/85 hover:border-[#7be0ff]/60 hover:bg-[#4cc9ff]/8 transition disabled:opacity-40"
            >
              What's happening in…
            </button>
          </div>
          {/* Row 2: city view under the chips */}
          <button
            type="button"
            onClick={onCityClick}
            disabled={offline}
            className="border border-[#7be0ff]/50 bg-[#4cc9ff]/8 px-2.5 py-1 text-hud-2xs tracking-[0.15em] text-[#7be0ff] hover:bg-[#4cc9ff]/15 transition disabled:opacity-40"
          >
            ◎ VIEW FROM YOUR CITY
          </button>
        </div>
      )}

      {/* Manual city picker (geolocation denied/unavailable) */}
      {showCityPicker && !hasAnswer && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          <span className="text-hud-2xs tracking-[0.2em] text-[#4cc9ff]/60">
            PICK A CITY:
          </span>
          {CITY_FALLBACKS.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => onPickCity(c)}
              className="border border-[#4cc9ff]/30 bg-[#02040a]/70 px-2.5 py-1 text-hud-2xs tracking-[0.15em] text-[#cfe6ff]/85 hover:border-[#7be0ff]/60 hover:bg-[#4cc9ff]/8 transition"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Answer card */}
      {hasAnswer && (
        <div className="mt-2 border border-[#4cc9ff]/40 bg-[#02040a]/85 backdrop-blur-sm px-3 py-2.5">
          <div className="flex items-center gap-2 text-hud-2xs tracking-[0.22em] text-[#4cc9ff]/70 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7be0ff] shadow-[0_0_6px_#7be0ff]" />
            <span>WORLDVIEW</span>
            {answer!.place && <span className="opacity-60">· {answer!.place}</span>}
            <span className="ml-auto opacity-45">{answer!.source}</span>
          </div>
          <div className="mt-1.5 text-hud-sm normal-case tracking-normal leading-relaxed text-[#dfeeff] max-h-[22vh] overflow-y-auto">
            {answer!.answer}
          </div>

          {/* Nearby / related stories — click any to fly there and open it.
              This is what makes "view from your city" surface several results. */}
          {answer!.results.length > 1 && (
            <ul className="mt-2 border-t border-[#4cc9ff]/15 pt-2 space-y-0.5 max-h-[30vh] overflow-y-auto pr-1">
              {answer!.results.map((r, i) => (
                <li
                  key={r.id ?? i}
                  onClick={() => selectResult(r)}
                  className="group flex items-start gap-2 px-1.5 py-1 cursor-pointer hover:bg-[#4cc9ff]/8 transition"
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full mt-[6px] flex-shrink-0 bg-[#4cc9ff]"
                    style={{ boxShadow: '0 0 5px #4cc9ff90' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-hud-sm normal-case tracking-normal leading-snug text-[#dfeeff] line-clamp-2 group-hover:text-[#eaf4ff]">
                      {r.title}
                    </div>
                    <div className="text-hud-2xs opacity-50 normal-case tracking-wide mt-0.5 flex items-center gap-1.5">
                      {r.place && <span>{r.place}</span>}
                      {r.place && r.sourceOutlet && <span className="opacity-60">·</span>}
                      {r.sourceOutlet && <span className="truncate">{r.sourceOutlet}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={onShare}
              disabled={shareStatus === 'pending'}
              className="border border-[#7be0ff]/50 bg-[#4cc9ff]/8 px-2.5 py-1 text-hud-2xs tracking-[0.2em] text-[#7be0ff] hover:bg-[#4cc9ff]/15 transition disabled:opacity-50"
            >
              {shareStatus === 'pending' ? 'CREATING…' : '⇪ SHARE'}
            </button>
            {shareStatus === 'copied' && (
              <span className="text-hud-2xs tracking-[0.2em] text-[#9affb2]">
                ✓ LINK COPIED
              </span>
            )}
            {shareStatus === 'error' && (
              <span className="text-hud-2xs tracking-[0.2em] text-[#ff8888]">
                SHARE FAILED
              </span>
            )}
            {shareUrl && (
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-hud-2xs tracking-wide normal-case text-[#4cc9ff]/80 hover:text-[#7be0ff] truncate"
              >
                {shareUrl.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>
      )}

      {status === 'error' && !hasAnswer && (
        <div className="mt-2 text-center text-hud-xs tracking-[0.2em] text-[#ff8888]/80">
          COULDN'T REACH THE GLOBE — TRY AGAIN
        </div>
      )}
    </div>
  )
}
