import { useAppStore } from '../store/useAppStore'
import { locationLabel } from '../globe/countries'
import { ShareButton } from './ShareButton'

const SELECTION_TOP_OFFSET = '5.5rem'

// Bottom-right: detail card for the selected event/cluster.
export function SelectionCard() {
  const selected = useAppStore((s) => s.selectedEntity)
  const setSelectedEntity = useAppStore((s) => s.setSelectedEntity)

  if (!selected) return null

  return (
    <div
      className="pointer-events-auto border border-[#4cc9ff]/50 bg-[#02040a]/80 backdrop-blur-sm text-[#cfe6ff] holo-frame flex flex-col"
      style={{
        position: 'absolute',
        right: '1rem',
        bottom: '1rem',
        width: '26rem',
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: `calc(100vh - ${SELECTION_TOP_OFFSET})`,
      }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => setSelectedEntity(null)}
        className="absolute top-1 right-1 z-10 w-6 h-6 flex items-center justify-center text-[#4cc9ff]/80 hover:text-[#7be0ff] hover:bg-[#4cc9ff]/10 text-hud-xs"
      >
        ✕
      </button>

      {selected.imageUrl && (
        <div className="relative overflow-hidden border-b border-[#4cc9ff]/30 flex-shrink-0">
          <img
            src={selected.imageUrl}
            alt=""
            className="w-full h-32 object-cover"
            style={{ filter: 'saturate(0.55) brightness(0.85) contrast(1.05) hue-rotate(-8deg)' }}
            onError={(e) => {
              const img = e.target as HTMLImageElement
              const wrapper = img.parentElement
              if (wrapper) wrapper.style.display = 'none'
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(180deg, rgba(76,201,255,0.18), rgba(2,4,10,0) 40%, rgba(2,4,10,0.55))',
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none opacity-30 mix-blend-screen"
            style={{
              background:
                'repeating-linear-gradient(0deg, transparent 0 2px, rgba(124,224,255,0.18) 2px 3px)',
            }}
          />
        </div>
      )}
      <div className="p-3 overflow-y-auto min-h-0">
        <div className="text-hud-xs opacity-60 tracking-[0.18em] uppercase flex items-center justify-between pr-6">
          <span className="truncate">
            {selected.sourceOutlet
              ? `SOURCE · ${selected.sourceOutlet.toUpperCase()}`
              : `SELECTED · ${selected.type.toUpperCase()}`}
          </span>
          {selected.category && (
            <span className="opacity-70 flex-shrink-0 ml-2">
              · {selected.category.toUpperCase()}
            </span>
          )}
        </div>
        <div className="text-hud-md normal-case tracking-normal mt-1 font-medium leading-snug text-[#dfeeff]">
          {selected.title ?? selected.id}
        </div>
        {locationLabel(selected.city, selected.countryCode) && (
          <div className="text-hud-xs tracking-[0.18em] mt-2 text-[#7be0ff]/85 flex items-center gap-1.5">
            <span>◎</span>
            <span>{locationLabel(selected.city, selected.countryCode)}</span>
            {selected.geoPrecision === 'country' && (
              <span
                className="ml-2 px-1.5 py-0.5 text-hud-3xs tracking-[0.2em] border border-[#ffb84c]/40 text-[#ffb84c]/85 rounded-sm"
                title="Coordinates are a country centroid, not a specific point"
              >
                ◌ APPROX
              </span>
            )}
          </div>
        )}
        {selected.summary && (
          <div className="text-hud-sm normal-case tracking-normal mt-2 opacity-80 leading-relaxed">
            {selected.summary}
          </div>
        )}
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {selected.url && (
            <a
              href={selected.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-hud-xs tracking-[0.18em] uppercase text-[#4cc9ff] hover:text-[#7be0ff]"
            >
              OPEN ARTICLE →
            </a>
          )}
          {/* Share this exact event — any clicked dot is shareable */}
          <ShareButton
            build={() => ({
              kind: 'cluster',
              params: ((): Record<string, string> => {
                if (selected.id.startsWith('cl:'))
                  return { cluster: selected.id.replace(/^cl:/, '') }
                if (selected.lat != null && selected.lon != null)
                  return { focus: `${selected.lat},${selected.lon}` }
                return {}
              })(),
              title: selected.title ?? null,
              place:
                locationLabel(selected.city, selected.countryCode) ||
                selected.city ||
                null,
              answer: selected.summary ?? null,
              flyLat: selected.lat ?? null,
              flyLon: selected.lon ?? null,
              stats: {},
            })}
          />
        </div>
      </div>
    </div>
  )
}
