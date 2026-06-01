import { useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { MarketSnapshot } from '../api/client'

function formatPrice(p: number | null): string {
  if (p === null) return '—'
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (p >= 1) return p.toFixed(2)
  return p.toFixed(4)
}

function changeColor(pct: number | null): string {
  if (pct === null || Math.abs(pct) < 0.05) return '#8aa0b6'
  return pct > 0 ? '#84c9a3' : '#d68f8f'
}

function changeArrow(pct: number | null): string {
  if (pct === null) return '·'
  if (Math.abs(pct) < 0.05) return '·'
  return pct > 0 ? '▲' : '▼'
}

function displayName(m: MarketSnapshot): string {
  return m.isCurrency ? m.symbol.replace('FX:USD/', '') : m.name
}

function TickerCell({ m }: { m: MarketSnapshot }) {
  const color = changeColor(m.changePct)
  return (
    <span className="inline-flex items-baseline gap-1.5 px-4 tabular-nums whitespace-nowrap">
      <span className="text-[#cfe6ff]/75 normal-case tracking-normal">
        {displayName(m)}
      </span>
      <span className="text-[#cfe6ff]/55 text-hud-xs">
        {formatPrice(m.price)}
      </span>
      <span className="text-hud-xs" style={{ color }}>
        {changeArrow(m.changePct)}{' '}
        {m.changePct !== null
          ? `${m.changePct > 0 ? '+' : ''}${m.changePct.toFixed(2)}%`
          : '—'}
      </span>
      <span className="text-[#4cc9ff]/15 px-2">·</span>
    </span>
  )
}

function ExpandedRow({ m, index }: { m: MarketSnapshot; index: number }) {
  const color = changeColor(m.changePct)
  return (
    <div
      style={{ animationDelay: `${Math.min(index, 16) * 22}ms` }}
      className="hud-row-in flex items-baseline gap-2 text-hud-xs py-[1px] tabular-nums hover:bg-[#4cc9ff]/4 px-2"
    >
      <span className="text-[#cfe6ff]/70 normal-case tracking-normal truncate flex-1">
        {displayName(m)}
      </span>
      <span className="text-[#cfe6ff]/65 text-right whitespace-nowrap">
        {formatPrice(m.price)}
      </span>
      <span
        className="text-right whitespace-nowrap w-[3.6rem] text-hud-2xs"
        style={{ color }}
      >
        {changeArrow(m.changePct)}{' '}
        {m.changePct !== null
          ? `${m.changePct > 0 ? '+' : ''}${m.changePct.toFixed(2)}%`
          : '—'}
      </span>
    </div>
  )
}

export function MarketsPanel() {
  const markets = useAppStore((s) => s.markets)
  const [expanded, setExpanded] = useState(false)

  const { indices, currencies, ordered } = useMemo(() => {
    const i: MarketSnapshot[] = []
    const c: MarketSnapshot[] = []
    for (const m of markets) (m.isCurrency ? c : i).push(m)
    i.sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
    c.sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
    // Ticker order: biggest movers first, alternating index/fx so the strip
    // isn't visually clumpy.
    const o: MarketSnapshot[] = []
    const maxLen = Math.max(i.length, c.length)
    for (let k = 0; k < maxLen; k++) {
      if (k < i.length) o.push(i[k])
      if (k < c.length) o.push(c[k])
    }
    return { indices: i, currencies: c, ordered: o }
  }, [markets])

  if (markets.length === 0) return null

  return (
    <>
      {/* The strip itself: full-width along the very top edge */}
      <div className="absolute top-0 left-0 right-0 h-7 z-30 pointer-events-auto bg-[#02040a]/85 backdrop-blur-sm border-b border-[#4cc9ff]/15 flex items-stretch overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={`flex-shrink-0 px-3 flex items-center gap-1.5 text-hud-2xs tracking-[0.28em] border-r border-[#4cc9ff]/15 transition ${
            expanded
              ? 'text-[#7be0ff] bg-[#4cc9ff]/10'
              : 'text-[#4cc9ff]/65 hover:text-[#4cc9ff]/90 hover:bg-[#4cc9ff]/6'
          }`}
          title={expanded ? 'Hide markets panel' : 'Open markets panel'}
        >
          <span className="text-hud-3xs opacity-60">{expanded ? '▾' : '▸'}</span>
          MARKETS
        </button>
        <div className="flex-1 overflow-hidden flex items-center">
          <div className="ticker-track text-hud-sm">
            {/* Render the list twice so the keyframe -50% translate produces
                a seamless loop with no visible jump. */}
            {ordered.map((m) => (
              <TickerCell key={`a-${m.symbol}`} m={m} />
            ))}
            {ordered.map((m) => (
              <TickerCell key={`b-${m.symbol}`} m={m} />
            ))}
          </div>
        </div>
      </div>

      {/* Expanded panel: drops down from the right end of the ticker */}
      {expanded && (
        <div className="absolute top-7 right-4 w-[22rem] max-w-[calc(100vw-2rem)] z-30 pointer-events-auto border border-[#4cc9ff]/30 border-t-0 bg-[#02040a]/85 backdrop-blur-sm">
          <div className="max-h-[60vh] overflow-y-auto py-1">
            {indices.length > 0 && (
              <>
                <div className="text-hud-3xs tracking-widest text-[#4cc9ff]/30 px-2 pt-1 pb-0.5">
                  INDICES
                </div>
                {indices.map((m, i) => (
                  <ExpandedRow key={m.symbol} m={m} index={i} />
                ))}
              </>
            )}
            {currencies.length > 0 && (
              <>
                <div className="text-hud-3xs tracking-widest text-[#4cc9ff]/30 px-2 pt-2 pb-0.5">
                  USD vs FX
                </div>
                {currencies.map((m, i) => (
                  <ExpandedRow key={m.symbol} m={m} index={i + indices.length} />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
