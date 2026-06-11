export interface AudioHandle {
  start(): void
  click(): void
  whoosh(intensity?: number): void
  chime(): void
  /** Low "live transmission" bed layered under briefings. Ramped in/out. */
  startBed(): void
  stopBed(): void
  setMuted(muted: boolean): void
  isMuted(): boolean
  /** Register the function that stops speech (both TTS paths) on mute.
   *  Lives here because voice.ts imports this module (not vice versa). */
  setSpeechCanceller(fn: () => void): void
}

const MASTER_VOLUME = 0.3
const STORAGE_KEY = 'worldview:muted'

export function createAudio(): AudioHandle {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let started = false
  let muted = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1'
  let noiseBuffer: AudioBuffer | null = null

  function ensureCtx(): AudioContext {
    if (!ctx) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
      ctx = new Ctor()
      master = ctx.createGain()
      master.gain.value = muted ? 0 : MASTER_VOLUME
      master.connect(ctx.destination)
    }
    return ctx
  }

  function getNoiseBuffer(c: AudioContext) {
    if (!noiseBuffer) {
      const len = c.sampleRate * 0.6
      noiseBuffer = c.createBuffer(1, len, c.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1
      }
    }
    return noiseBuffer
  }

  function start() {
    if (started) return
    const c = ensureCtx()
    started = true
    if (c.state === 'suspended') void c.resume()

    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 340
    filter.Q.value = 1.1
    filter.connect(master!)

    const freqs = [55, 82.4, 110]
    for (const f of freqs) {
      const osc = c.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f

      const gain = c.createGain()
      gain.gain.value = 0.045

      const lfo = c.createOscillator()
      lfo.frequency.value = 0.08 + Math.random() * 0.18
      const lfoAmp = c.createGain()
      lfoAmp.gain.value = 0.025
      lfo.connect(lfoAmp).connect(gain.gain)
      lfo.start()

      osc.connect(gain).connect(filter)
      osc.start()
    }

    const shimmer = c.createOscillator()
    shimmer.type = 'sine'
    shimmer.frequency.value = 660
    const shGain = c.createGain()
    shGain.gain.value = 0.005
    const shLfo = c.createOscillator()
    shLfo.frequency.value = 0.21
    const shLfoAmp = c.createGain()
    shLfoAmp.gain.value = 0.005
    shLfo.connect(shLfoAmp).connect(shGain.gain)
    shLfo.start()
    shimmer.connect(shGain).connect(master!)
    shimmer.start()
  }

  function click() {
    if (muted) return
    const c = ensureCtx()
    if (c.state === 'suspended') void c.resume()
    const t = c.currentTime
    const osc = c.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1200, t)
    osc.frequency.exponentialRampToValueAtTime(620, t + 0.12)
    const gain = c.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.45, t + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    osc.connect(gain).connect(master!)
    osc.start(t)
    osc.stop(t + 0.25)
  }

  function whoosh(intensity = 0.35) {
    if (muted) return
    const c = ensureCtx()
    if (c.state === 'suspended') void c.resume()
    const t = c.currentTime

    const src = c.createBufferSource()
    src.buffer = getNoiseBuffer(c)

    const filter = c.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 3.5
    filter.frequency.setValueAtTime(220, t)
    filter.frequency.exponentialRampToValueAtTime(1400, t + 0.18)
    filter.frequency.exponentialRampToValueAtTime(380, t + 0.35)

    const gain = c.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.linearRampToValueAtTime(intensity, t + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)

    src.connect(filter).connect(gain).connect(master!)
    src.start(t)
    src.stop(t + 0.45)
  }

  function chime() {
    if (muted) return
    const c = ensureCtx()
    if (c.state === 'suspended') void c.resume()
    const t = c.currentTime

    // Two-note bell: fundamental + perfect fifth, fast attack, long decay
    const notes: Array<[number, number]> = [
      [880, 0.18],
      [1320, 0.10],
    ]
    for (const [freq, peak] of notes) {
      const osc = c.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const gain = c.createGain()
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)
      osc.connect(gain).connect(master!)
      osc.start(t)
      osc.stop(t + 1.5)
    }
  }

  // Briefing bed: looped low-passed noise, barely audible, with a slow LFO
  // drifting the filter so it breathes — reads as an open comms channel.
  let bedSource: AudioBufferSourceNode | null = null
  let bedGain: GainNode | null = null

  function startBed() {
    if (muted || bedSource) return
    const c = ensureCtx()
    if (c.state === 'suspended') void c.resume()
    const t = c.currentTime

    const src = c.createBufferSource()
    src.buffer = getNoiseBuffer(c)
    src.loop = true

    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 140
    filter.Q.value = 0.8
    const lfo = c.createOscillator()
    lfo.frequency.value = 0.06
    const lfoAmp = c.createGain()
    lfoAmp.gain.value = 45
    lfo.connect(lfoAmp).connect(filter.frequency)
    lfo.start()

    const gain = c.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.linearRampToValueAtTime(0.05, t + 2.0)

    src.connect(filter).connect(gain).connect(master!)
    src.start(t)
    bedSource = src
    bedGain = gain
  }

  function stopBed() {
    if (!bedSource || !ctx) return
    const t = ctx.currentTime
    bedGain?.gain.cancelScheduledValues(t)
    bedGain?.gain.setValueAtTime(bedGain.gain.value, t)
    bedGain?.gain.linearRampToValueAtTime(0.0001, t + 1.5)
    const src = bedSource
    bedSource = null
    bedGain = null
    setTimeout(() => {
      try {
        src.stop()
      } catch {
        // already stopped
      }
    }, 1600)
  }

  let speechCanceller: (() => void) | null = null

  function setMuted(m: boolean) {
    muted = m
    try {
      localStorage.setItem(STORAGE_KEY, m ? '1' : '0')
    } catch {
      // ignore
    }
    if (master) master.gain.value = m ? 0 : MASTER_VOLUME
    // Also stop any speech in flight when the user mutes
    if (m) {
      if (speechCanceller) speechCanceller()
      else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }

  return {
    start,
    click,
    whoosh,
    chime,
    startBed,
    stopBed,
    setMuted,
    isMuted: () => muted,
    setSpeechCanceller: (fn: () => void) => {
      speechCanceller = fn
    },
  }
}

export const audio = createAudio()
