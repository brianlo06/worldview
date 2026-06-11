import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { MarketsPanel } from './MarketsPanel'
import { CenterCrosshair, TelemetryReadout } from './Telemetry'
import { Briefing } from './Briefing'
import { Ask } from './Ask'
import { BreakingPanel } from './BreakingPanel'
import { ControlsPanel } from './ControlsPanel'
import { AnomalyPanel } from './AnomalyPanel'
import { CategoryLegend } from './CategoryLegend'
import { SelectionCard } from './SelectionCard'

export function Hud() {
  const [briefingActive, setBriefingActive] = useState(false)
  const apiStatus = useAppStore((s) => s.apiStatus)

  return (
    <div className="pointer-events-none absolute inset-0 text-hud-sm tracking-widest uppercase">
      {/* Center reticle — always-on Stark crosshair */}
      <CenterCrosshair />

      {/* Top-edge markets ticker — always-on horizontal strip (28px tall) */}
      <MarketsPanel />

      {/* Top-center: offline banner (only when API is unreachable).
          top-[2.25rem] sits just below the markets ticker. */}
      {apiStatus === 'offline' && (
        <div className="absolute top-[2.25rem] left-1/2 -translate-x-1/2 w-[30rem] max-w-[calc(100vw-14rem)] pointer-events-none">
          <div
            className="border border-[#ffb84c]/55 bg-[#02040a]/80 backdrop-blur-sm px-3 py-1.5 flex items-center gap-2 text-hud-xs tracking-[0.22em] text-[#ffb84c]/95"
            role="status"
            aria-live="polite"
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{
                background: '#ffb84c',
                boxShadow: '0 0 6px #ffb84c, 0 0 12px #ffb84c80',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
            <span>FEED OFFLINE</span>
            <span className="opacity-50">·</span>
            <span className="opacity-80">SHOWING SAMPLE EVENTS</span>
          </div>
        </div>
      )}

      {/* Top-center: ASK THE GLOBE. Anchored to CENTER WITHIN THE GAP between
          the left column (WORLDVIEW/breaking, ~26rem) and the right controls
          (clusters/briefing/tour…, ~33rem) so the answer card can't overlap
          either — screen-centering would collide with the controls. On narrow
          desktops the panel shrinks to the gap; on wide ones it caps at 34rem. */}
      <div
        className={`absolute flex justify-center left-4 right-4 lg:left-[26rem] lg:right-[33rem] ${
          apiStatus === 'offline'
            ? 'top-[8rem] lg:top-[5.5rem]'
            : 'top-[5rem] lg:top-[2.25rem]'
        }`}
      >
        <div className="w-full max-w-[34rem]">
          <Ask
            briefingActive={briefingActive}
            onStartBriefing={() => setBriefingActive(true)}
          />
        </div>
      </div>

      {/* Bottom-center: camera telemetry */}
      <div className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 pointer-events-none">
        <TelemetryReadout />
      </div>

      {/* Top-left */}
      <BreakingPanel />

      {/* Top-right */}
      <ControlsPanel />

      {/* Right column: anomaly cards */}
      <AnomalyPanel />

      {/* Bottom-left: category legend */}
      <CategoryLegend />

      {/* Bottom-right: selection */}
      <SelectionCard />

      {/* JARVIS top-stories briefing overlay — token-fired by the BRIEFING button.
          Self-contained: fetches, sequences, dispatches flyTo/setSelectedEntity. */}
      {briefingActive && <Briefing onClose={() => setBriefingActive(false)} />}
    </div>
  )
}
