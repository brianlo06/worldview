// Card face: category-color frame, CSS tier finish (flat / gradient / sheen /
// shimmer / holo-foil with pointer parallax), seeded canvas art background.

import { useEffect, useRef } from 'react'
import { API_BASE } from '../api/client'
import type { GameCard as Card, Tier } from '../api/game'
import { CATEGORY_LOOKUP, DEFAULT_CATEGORY, type Category } from '../globe/categories'
import { countryName } from '../globe/countries'
import { drawCardArt } from './cardArt'
import { flagEmoji } from './flags'

export const TIER_LABELS: Record<Tier, string> = {
  common: 'COMMON',
  uncommon: 'UNCOMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
}

export const TIER_COLORS: Record<Tier, string> = {
  common: '#8fa3b8',
  uncommon: '#7ee5a3',
  rare: '#4cc9ff',
  epic: '#c79bff',
  legendary: '#ffd166',
}

function categoryColor(category: string | null): string {
  const def = CATEGORY_LOOKUP[(category as Category) ?? DEFAULT_CATEGORY]
  return def?.color ?? CATEGORY_LOOKUP[DEFAULT_CATEGORY].color
}

function imageSrc(url: string | null): string | null {
  if (!url) return null
  return url.startsWith('/') ? `${API_BASE}${url}` : url
}

export function GameCardFace({
  card,
  flipped = true,
  compact = false,
}: {
  card: Card
  flipped?: boolean
  compact?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const color = categoryColor(card.category)
  const tierColor = TIER_COLORS[card.tier]
  const photo = imageSrc(card.image_url)

  useEffect(() => {
    if (canvasRef.current) drawCardArt(canvasRef.current, card.art_seed, color)
  }, [card.art_seed, color])

  // Legendary holo parallax — pointer tilts the card.
  useEffect(() => {
    const el = cardRef.current
    if (!el || card.tier !== 'legendary') return
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width - 0.5
      const py = (e.clientY - r.top) / r.height - 0.5
      el.style.transform = `rotateY(${px * 14}deg) rotateX(${-py * 14}deg)`
    }
    const onLeave = () => {
      el.style.transform = ''
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [card.tier])

  return (
    <div
      ref={cardRef}
      className={`game-card game-card--${card.tier} relative overflow-hidden select-none ${
        compact ? 'w-full' : 'w-[19rem] sm:w-[21rem]'
      } ${flipped ? 'game-card--flipped' : ''}`}
      style={{
        border: `1px solid ${color}`,
        boxShadow: `0 0 18px ${color}40, inset 0 0 30px #00000090`,
        aspectRatio: '5 / 7',
        background: '#03060d',
        transition: 'transform 180ms ease',
        transformStyle: 'preserve-3d',
      }}
    >
      <canvas
        ref={canvasRef}
        width={340}
        height={476}
        className="absolute inset-0 h-full w-full"
      />
      {/* tier finish overlay (CSS-driven per tier) */}
      <div className="game-card__finish pointer-events-none absolute inset-0" />

      {photo && (
        <div className="absolute inset-x-0 top-0 h-[58%] overflow-hidden">
          <img
            src={photo}
            alt=""
            className="h-full w-full object-cover opacity-90"
            loading="lazy"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#03060d]/10 to-[#03060d]" />
        </div>
      )}

      <div className="relative flex h-full flex-col p-3 text-left">
        <div className="flex items-center justify-between text-hud-2xs tracking-[0.25em]">
          <span style={{ color: tierColor }}>{TIER_LABELS[card.tier]}</span>
          <span style={{ color }}>{(card.category ?? 'signal').toUpperCase()}</span>
        </div>

        <div className="mt-auto">
          <div className="text-3xl leading-none">{flagEmoji(card.country)}</div>
          <div
            className="mt-2 text-sm font-semibold normal-case tracking-normal text-[#e8f4ff]"
            style={{ textShadow: '0 1px 8px #000' }}
          >
            {card.headline}
          </div>
          {!compact && card.summary && (
            <div className="mt-1 line-clamp-3 text-hud-xs normal-case tracking-normal text-[#9db8cc]">
              {card.summary}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between text-hud-2xs tracking-[0.2em] text-[#7a93a8]">
            <span>{card.source_outlet ?? countryName(card.country) ?? 'EARTH'}</span>
            <span>{card.pool_date}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
