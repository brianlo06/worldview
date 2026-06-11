import { useEffect, useState } from 'react'

// Wall-clock that re-renders once a second (HUD clock + relative timestamps).
export function useCurrentTime(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

// Animated presence: keeps the last non-null value around for `exitMs` after
// it drops to null so an exit animation can play before unmount. `closing`
// is true during that window — put the exit-animation class on it.
export function useAnimatedPresence<T>(
  value: T | null,
  exitMs = 240,
): { shown: T | null; closing: boolean } {
  const [held, setHeld] = useState<T | null>(value)
  useEffect(() => {
    if (value !== null) {
      const t = setTimeout(() => setHeld(value), 0)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setHeld(null), exitMs)
    return () => clearTimeout(t)
  }, [value, exitMs])
  return { shown: value ?? held, closing: value === null && held !== null }
}
