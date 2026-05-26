/** Lightweight Web Speech Synthesis wrapper used for JARVIS-style voice cues.
 *  Respects the existing audio mute state and picks a decent macOS voice when
 *  one's available. Falls back silently in browsers / environments without TTS. */

import { audio } from './audio'

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

export interface SpeakOptions {
  /** Cancel any in-flight speech first. Default true. */
  interrupt?: boolean
  /** 0.5 – 2.0. Default 1.0. */
  rate?: number
  /** 0.0 – 2.0. Default 1.0. */
  pitch?: number
  /** 0.0 – 1.0. Default 0.6 — quieter than the master audio. */
  volume?: number
}

/** Speak `text`. Silent no-op if audio is muted or the platform lacks TTS.
 *  Returns a Promise that resolves when the utterance ends (or immediately
 *  if speech was skipped). Backwards-compatible — existing fire-and-forget
 *  callers can ignore the return value. */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!text || audio.isMuted()) return Promise.resolve()
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve()
  }

  const synth = window.speechSynthesis
  // Wait until voices are loaded (Chrome fires this async on first call)
  if (!voicesLoaded) {
    ensureVoices()
    if (!voicesLoaded) {
      return new Promise<void>((resolve) => {
        setTimeout(() => speak(text, opts).then(resolve), 250)
      })
    }
  }
  if (opts.interrupt !== false) synth.cancel()

  const u = new SpeechSynthesisUtterance(text)
  const v = pickVoice()
  if (v) u.voice = v
  u.rate = opts.rate ?? 1.0
  u.pitch = opts.pitch ?? 1.0
  u.volume = opts.volume ?? 0.6
  return new Promise<void>((resolve) => {
    // Resolve on either successful end or error so an async sequence isn't
    // permanently blocked by a single failed utterance.
    u.onend = () => resolve()
    u.onerror = () => resolve()
    synth.speak(u)
  })
}

/** Cancel any speech currently in flight. */
export function silence(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
}
