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
