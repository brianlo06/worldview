// Fallback when geolocation is denied/unavailable — a manual city picker.

export interface CityOption {
  label: string
  lat: number
  lon: number
}

const CITY_FALLBACKS: CityOption[] = [
  { label: 'New York', lat: 40.71, lon: -74.0 },
  { label: 'London', lat: 51.51, lon: -0.13 },
  { label: 'Tokyo', lat: 35.68, lon: 139.69 },
  { label: 'Paris', lat: 48.85, lon: 2.35 },
]

export function CityPicker({ onPick }: { onPick: (city: CityOption) => void }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
      <span className="text-hud-2xs tracking-[0.2em] text-[#4cc9ff]/60">
        PICK A CITY:
      </span>
      {CITY_FALLBACKS.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => onPick(c)}
          className="border border-[#4cc9ff]/30 bg-[#02040a]/70 px-2.5 py-1 text-hud-2xs tracking-[0.15em] text-[#cfe6ff]/85 hover:border-[#7be0ff]/60 hover:bg-[#4cc9ff]/8 transition"
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}
