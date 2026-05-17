import { useAppStore } from '../store/useAppStore'

function fmtDeg(v: number, signed = true): string {
  const sign = signed ? (v >= 0 ? '+' : '−') : ''
  const abs = Math.abs(v)
  return `${sign}${abs.toFixed(2)}°`
}

export function CenterCrosshair() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        className="opacity-30"
        style={{ filter: 'drop-shadow(0 0 3px rgba(124,224,255,0.6))' }}
      >
        {/* Tiny "+" with gapped center so it doesn't cover the actual look-at point */}
        <line x1="14" y1="0" x2="14" y2="10" stroke="#7be0ff" strokeWidth="1" />
        <line x1="14" y1="18" x2="14" y2="28" stroke="#7be0ff" strokeWidth="1" />
        <line x1="0" y1="14" x2="10" y2="14" stroke="#7be0ff" strokeWidth="1" />
        <line x1="18" y1="14" x2="28" y2="14" stroke="#7be0ff" strokeWidth="1" />
        <circle cx="14" cy="14" r="1.5" fill="none" stroke="#7be0ff" strokeWidth="0.8" />
      </svg>
    </div>
  )
}

export function TelemetryReadout() {
  const t = useAppStore((s) => s.cameraTelemetry)
  if (!t) return null
  return (
    <div className="pointer-events-none text-[#4cc9ff]/55 text-[9px] tracking-[0.18em] tabular-nums leading-relaxed text-center">
      <div>
        LAT <span className="text-[#cfe6ff]/70">{fmtDeg(t.lat)}</span>
        {'   '}LON <span className="text-[#cfe6ff]/70">{fmtDeg(t.lon)}</span>
      </div>
      <div>
        ALT <span className="text-[#cfe6ff]/70">{t.altitude.toFixed(2)}u</span>
        {'   '}AZ <span className="text-[#cfe6ff]/70">{fmtDeg(t.azimuth, false)}</span>
        {'   '}FPS <span className="text-[#cfe6ff]/70">{Math.round(t.fps)}</span>
      </div>
    </div>
  )
}
