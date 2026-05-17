import { Suspense, lazy, useState } from 'react'
import { Hud } from './hud/Hud'
import { BootScreen } from './boot/BootScreen'

// Three.js (~600 KB) is reachable only through Globe → scene/* files. Lazy
// loading Globe splits Three out of the main bundle, dropping first-paint JS
// dramatically; the boot screen overlays the brief Suspense fallback gap.
const Globe = lazy(() =>
  import('./globe/Globe').then((m) => ({ default: m.Globe })),
)

export default function App() {
  const [booted, setBooted] = useState(false)
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#02040a]">
      {/* Mount the globe immediately so textures + API load behind the boot
          screen — by the time the user clicks through, it's ready */}
      <Suspense fallback={null}>
        <Globe />
      </Suspense>
      <Hud />
      {!booted && <BootScreen onComplete={() => setBooted(true)} />}
    </div>
  )
}
