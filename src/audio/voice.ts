/** JARVIS voice. Web Speech Synthesis with exact word timing from
 *  onboundary events for caption sync. A server neural-TTS path (GET /tts,
 *  Piper) exists below but is DISABLED — the user preferred the browser
 *  voice (and its pacing) after hearing both. Flip SERVER_TTS_ENABLED to
 *  re-try it. Respects the existing audio mute state. */

import { audio } from './audio'
import { API_BASE } from '../api/client'

const SERVER_TTS_ENABLED = false

// How long to wait for the server to synthesize before falling back. First
// requests for a line can take several seconds (subprocess synth on a small
// box); repeats are instant (disk + browser cache).
const TTS_FETCH_TIMEOUT_MS = 12000

export interface SpeakOptions {
  /** Cancel any in-flight speech first. Default true. */
  interrupt?: boolean
  /** 0.5 – 2.0. Default 1.0. */
  rate?: number
  /** 0.0 – 2.0. Default 1.0. (Web Speech fallback only.) */
  pitch?: number
  /** 0.0 – 1.0. */
  volume?: number
  /** Called as each word is spoken — index into text.split(/\s+/). */
  onWord?: (wordIndex: number) => void
}

// --- Server (neural) path --------------------------------------------------

let currentAudio: HTMLAudioElement | null = null
let currentUrl: string | null = null
let wordRaf: number | null = null

function stopServerAudio(): void {
  if (wordRaf !== null) {
    cancelAnimationFrame(wordRaf)
    wordRaf = null
  }
  if (currentAudio) {
    currentAudio.onended = null
    currentAudio.onerror = null
    currentAudio.pause()
    currentAudio.removeAttribute('src')
    currentAudio = null
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl)
    currentUrl = null
  }
}

function ttsUrl(text: string): string {
  return `${API_BASE}/tts?text=${encodeURIComponent(text)}`
}

/** Warm the browser HTTP cache for a line so speak() starts instantly.
 *  No-op while the server voice is disabled. */
export function prefetchSpeech(text: string): void {
  if (!SERVER_TTS_ENABLED || !text || audio.isMuted()) return
  fetch(ttsUrl(text)).catch(() => {})
}

/** Play `text` via server TTS. Resolves true if playback happened (even if
 *  it errored midway — re-speaking the whole line robotically is worse),
 *  false if it never started and the caller should fall back. */
function speakServer(text: string, opts: SpeakOptions): Promise<boolean> {
  return (async () => {
    const res = await fetch(ttsUrl(text), {
      signal: AbortSignal.timeout(TTS_FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return false
    const blob = await res.blob()

    return new Promise<boolean>((resolve) => {
      const url = URL.createObjectURL(blob)
      const el = new Audio(url)
      currentAudio = el
      currentUrl = url
      el.volume = Math.min(1, opts.volume ?? 0.85)
      if (opts.rate) el.playbackRate = opts.rate

      // Word boundaries estimated from each word's share of the audio
      // duration (proportional to its character count) — accurate enough
      // for caption highlighting.
      const words = text.split(/\s+/).filter(Boolean)
      let bounds: number[] | null = null
      let spoken = -1
      el.onloadedmetadata = () => {
        if (opts.onWord && isFinite(el.duration) && el.duration > 0) {
          const total = words.reduce((s, w) => s + w.length + 1, 0)
          let acc = 0
          bounds = words.map((w) => {
            const b = (acc / total) * el.duration
            acc += w.length + 1
            return b
          })
        }
      }
      const tick = () => {
        if (currentAudio !== el) return
        if (bounds && opts.onWord) {
          while (spoken + 1 < bounds.length && el.currentTime >= bounds[spoken + 1]) {
            spoken += 1
            opts.onWord(spoken)
          }
        }
        wordRaf = requestAnimationFrame(tick)
      }

      let started = false
      const finish = (played: boolean) => {
        stopServerAudio()
        resolve(played)
      }
      el.onended = () => finish(true)
      el.onerror = () => finish(started)
      el.play().then(
        () => {
          started = true
          wordRaf = requestAnimationFrame(tick)
        },
        () => finish(false), // autoplay-blocked or unsupported
      )
    })
  })().catch(() => false)
}

// --- Web Speech fallback -----------------------------------------------------

let preferredVoice: SpeechSynthesisVoice | null = null
let voicesLoaded = false

function ensureVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return []
  }
  const list = window.speechSynthesis.getVoices()
  if (list.length > 0) voicesLoaded = true
  return list
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (preferredVoice) return preferredVoice
  const voices = ensureVoices()
  if (voices.length === 0) return null

  // macOS-good voices first, then any en-* voice as a fallback
  const wanted = [
    'Samantha',     // macOS — clean, slightly warm
    'Allison',      // macOS — measured, JARVIS-leaning
    'Tessa',        // macOS South African — close to British inflection
    'Daniel',       // macOS British — even closer
    'Karen',        // macOS Australian
    'Moira',        // macOS Irish
    'Google US English',
    'Google UK English Female',
    'Google UK English Male',
  ]
  for (const name of wanted) {
    const match = voices.find((v) => v.name === name)
    if (match) {
      preferredVoice = match
      return match
    }
  }
  // Last resort — first English voice
  const enAny = voices.find((v) => v.lang.toLowerCase().startsWith('en'))
  preferredVoice = enAny ?? voices[0]
  return preferredVoice
}

// Some browsers populate voices asynchronously; subscribe so we don't miss them
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const synth = window.speechSynthesis
  synth.addEventListener?.('voiceschanged', () => {
    preferredVoice = null
    ensureVoices()
  })
}

function speakBrowser(text: string, opts: SpeakOptions): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve()
  }
  const synth = window.speechSynthesis
  // Wait until voices are loaded (Chrome fires this async on first call)
  if (!voicesLoaded) {
    ensureVoices()
    if (!voicesLoaded) {
      return new Promise<void>((resolve) => {
        setTimeout(() => speakBrowser(text, opts).then(resolve), 250)
      })
    }
  }

  const u = new SpeechSynthesisUtterance(text)
  const v = pickVoice()
  if (v) u.voice = v
  u.rate = opts.rate ?? 1.0
  u.pitch = opts.pitch ?? 1.0
  u.volume = opts.volume ?? 0.6

  if (opts.onWord) {
    // Exact word timing: map boundary charIndex to a word index.
    const words = text.split(/\s+/).filter(Boolean)
    const starts: number[] = []
    let pos = 0
    for (const w of words) {
      const s = text.indexOf(w, pos)
      starts.push(s)
      pos = s + w.length
    }
    u.onboundary = (e) => {
      if (e.name && e.name !== 'word') return
      const ci = e.charIndex ?? 0
      for (let i = starts.length - 1; i >= 0; i--) {
        if (ci >= starts[i]) {
          opts.onWord!(i)
          break
        }
      }
    }
  }

  return new Promise<void>((resolve) => {
    // Resolve on either successful end or error so an async sequence isn't
    // permanently blocked by a single failed utterance.
    u.onend = () => resolve()
    u.onerror = () => resolve()
    synth.speak(u)
  })
}

// --- Public API ----------------------------------------------------------------

/** Speak `text` — neural voice when the server can provide it, browser
 *  speech otherwise. Silent no-op if audio is muted. Resolves when the
 *  speech ends (or immediately if it was skipped). */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!text || audio.isMuted()) return
  if (opts.interrupt !== false) silence()
  if (SERVER_TTS_ENABLED) {
    const played = await speakServer(text, opts)
    if (played) return
  }
  await speakBrowser(text, opts)
}

/** Cancel any speech currently in flight (both paths). */
export function silence(): void {
  stopServerAudio()
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

// Muting mid-speech must stop the server-audio element too, not just
// speechSynthesis — register the full canceller with the audio module.
audio.setSpeechCanceller(silence)
