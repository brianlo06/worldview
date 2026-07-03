// Tiny pathname "router" for the /game view — one binary fork doesn't justify
// a router dependency. pushState on enter/leave keeps back/forward working;
// a custom event lets any component navigate without prop-drilling.

import { useEffect, useState } from 'react'

export type Route = 'main' | 'game'

const NAV_EVENT = 'worldview:navigate'

export function currentRoute(): Route {
  return window.location.pathname.startsWith('/game') ? 'game' : 'main'
}

export function enterGame() {
  if (currentRoute() !== 'game') {
    window.history.pushState({}, '', '/game')
    window.dispatchEvent(new Event(NAV_EVENT))
  }
}

export function exitGame() {
  if (currentRoute() === 'game') {
    window.history.pushState({}, '', '/')
    window.dispatchEvent(new Event(NAV_EVENT))
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(currentRoute)
  useEffect(() => {
    const update = () => setRoute(currentRoute())
    window.addEventListener('popstate', update)
    window.addEventListener(NAV_EVENT, update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener(NAV_EVENT, update)
    }
  }, [])
  return route
}
