// The JARVIS greeting line, shared by hud/Greeting.tsx (types + speaks it)
// and boot/BootScreen.tsx (pre-warms its neural speech during the "click to
// continue" idle). Kept out of the component file for fast-refresh.

import { useAppStore } from '../store/useAppStore'

function salute(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Good morning'
  if (h >= 12 && h < 18) return 'Good afternoon'
  return 'Good evening'
}

// Round down to a clean "over N" figure so the line reads like an aide's
// summary, not a database row (2,431 → "over 2,400").
function approx(n: number): string {
  if (n >= 1000) return `over ${(Math.floor(n / 100) * 100).toLocaleString()}`
  if (n >= 100) return `over ${Math.floor(n / 50) * 50}`
  return String(n)
}

export function buildGreeting(): string {
  const { dots, eventCount } = useAppStore.getState()
  const countries = new Set(
    dots.map((d) => d.countryCode).filter(Boolean),
  ).size
  if (eventCount > 0 && countries > 5) {
    return (
      `${salute()}. Tracking ${approx(eventCount)} events across ` +
      `${countries} countries. Press briefing when you're ready.`
    )
  }
  return `${salute()}. Worldview is online.`
}
