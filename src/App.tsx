import { Suspense, lazy, useState } from 'react'
import { Hud } from './hud/Hud'
import { Greeting } from './hud/Greeting'
import { BootScreen } from './boot/BootScreen'
import { useRoute } from './game/router'

// Three.js (~600 KB) is reachable only through Globe → scene/* files. Lazy
// loading Globe splits Three out of the main bundle, dropping first-paint JS
// dramatically; the boot screen overlays the brief Suspense fallback gap.
const Globe = lazy(() =>
  import('./globe/Globe').then((m) => ({ default: m.Globe })),
)

// The game console is its own chunk — most visitors never load it.
const GameView = lazy(() =>
  import('./game/GameView').then((m) => ({ default: m.GameView })),
)

export default function App() {
  const [booted, setBooted] = useState(false)
  // Pathname switch (no router dep): /game renders the game console instead
  // of the news HUD; the globe stays mounted underneath in both routes.
  const route = useRoute()
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#02040a]">
      {/* Mount the globe immediately so textures + API load behind the boot
          screen — by the time the user clicks through, it's ready */}
      <Suspense fallback={null}>
        <Globe />
      </Suspense>
      {route === 'game' ? (
        <Suspense fallback={null}>
          <GameView />
        </Suspense>
      ) : (
        <Hud />
      )}
      {/* JARVIS greets right after the boot screen clears — typed + spoken */}
      {booted && route === 'main' && <Greeting />}
      {!booted && <BootScreen onComplete={() => setBooted(true)} />}
    </div>
  )
}
