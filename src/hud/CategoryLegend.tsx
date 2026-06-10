import { useAppStore } from '../store/useAppStore'
import { CATEGORIES } from '../globe/categories'

// Bottom-left: category legend (interactive toggles) + control hint.
// Width is capped to stay clear of the centered telemetry readout at the
// bottom edge — without this, on a wide-but-short viewport the legend +
// hint stretch across the middle and overlap it.
export function CategoryLegend() {
  const disabledCategories = useAppStore((s) => s.disabledCategories)
  const toggleCategory = useAppStore((s) => s.toggleCategory)

  return (
    <div className="absolute bottom-4 left-4 text-[#4cc9ff]/70 space-y-2 pointer-events-auto max-w-[calc(50vw-11rem)]">
      <div className="flex flex-wrap gap-x-2 gap-y-1 max-w-md">
        {CATEGORIES.map((c) => {
          const off = disabledCategories.has(c.id)
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleCategory(c.id)}
              className={`flex items-center gap-1.5 text-hud-xs tracking-widest px-1.5 py-0.5 transition ${
                off
                  ? 'opacity-35 hover:opacity-65'
                  : 'opacity-100 hover:bg-[#4cc9ff]/8'
              }`}
              title={off ? `Show ${c.label}` : `Hide ${c.label}`}
              aria-pressed={!off}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{
                  background: off ? '#3a4458' : c.color,
                  boxShadow: off ? 'none' : `0 0 6px ${c.color}`,
                }}
              />
              <span className={off ? 'line-through' : ''}>{c.label}</span>
            </button>
          )
        })}
      </div>
      <div className="opacity-60 text-hud-xs">
        DRAG · SCROLL · CLICK A DOT
      </div>
    </div>
  )
}
