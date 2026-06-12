// Post-boot JARVIS greeting: one console line that types itself out while
// the neural voice reads it, then fades. Numbers come from the live store
// (the globe loads behind the boot screen, so they're real by the time the
// user clicks through). BootScreen pre-warms the speech while the "click to
// continue" prompt idles, so the voice starts instantly.

import { useEffect, useRef, useState } from 'react'
import { speak } from '../audio/voice'
import { buildGreeting } from './greetingText'

const TYPE_MS = 16 // per character
const LINGER_MS = 2600 // after typing completes (speech usually runs longer)

export function Greeting() {
  // The text is frozen at mount so typing, speech, and the prefetched wav
  // all agree on the exact same line.
  const [text] = useState(buildGreeting)
  const [chars, setChars] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)
  const spokenDone = useRef(false)
  const typedDone = chars >= text.length

  useEffect(() => {
    void speak(text, { volume: 0.9 }).then(() => {
      spokenDone.current = true
    })
  }, [text])

  useEffect(() => {
    if (typedDone) return
    const t = setTimeout(() => setChars((c) => c + 1), TYPE_MS)
    return () => clearTimeout(t)
  }, [chars, typedDone])

  // Leave once both the typing has lingered and the speech has had time to
  // finish — poll rather than chain promises so an unmuted/failed speech
  // path can't strand the line on screen.
  useEffect(() => {
    if (!typedDone) return
    let waited = 0
    const iv = setInterval(() => {
      waited += 500
      if (spokenDone.current || waited >= 12000) {
        clearInterval(iv)
        setTimeout(() => setLeaving(true), LINGER_MS)
        setTimeout(() => setGone(true), LINGER_MS + 900)
      }
    }, 500)
    return () => clearInterval(iv)
  }, [typedDone])

  if (gone) return null
  return (
    <div
      className={`pointer-events-none fixed left-1/2 bottom-[calc(6rem+env(safe-area-inset-bottom))] -translate-x-1/2 z-[950] px-4 ${
        leaving ? 'briefing-text-out' : ''
      }`}
    >
      <div
        className="flex items-baseline gap-2 border border-[#4cc9ff]/35 bg-[#02040a]/80 backdrop-blur-sm px-4 py-2.5"
        style={{ boxShadow: '0 0 24px rgba(124,224,255,0.18)' }}
      >
        <span className="text-[#7be0ff] text-hud-sm">◢</span>
        <span className="text-hud-md normal-case tracking-wide text-[#dfeeff]/95 whitespace-pre-wrap">
          {text.slice(0, chars)}
          {!typedDone && (
            <span className="inline-block w-2 h-[1em] translate-y-[2px] bg-[#7be0ff] animate-pulse" />
          )}
        </span>
      </div>
    </div>
  )
}
