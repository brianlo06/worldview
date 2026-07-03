// Collection browser: filterable card grid + completion summary + badges.

import { useEffect, useMemo, useState } from 'react'
import type { OwnedCard, Tier } from '../api/game'
import { CATEGORIES } from '../globe/categories'
import { countryName } from '../globe/countries'
import { useGameStore } from '../store/useGameStore'
import { GameCardFace, TIER_COLORS, TIER_LABELS } from './GameCard'
import { ShareButton } from '../hud/ShareButton'
import { flagEmoji } from './flags'

const TIERS: Tier[] = ['legendary', 'epic', 'rare', 'uncommon', 'common']

const BADGE_LABELS: Record<string, string> = {
  'categories-7': 'ALL 7 CATEGORIES',
  'continents-5': '5 CONTINENTS',
  'countries-10': '10 COUNTRIES',
  'countries-25': '25 COUNTRIES',
  'countries-50': '50 COUNTRIES',
  'first-legendary': 'FIRST LEGENDARY',
}

export function CollectionPanel({ onClose }: { onClose: () => void }) {
  const collection = useGameStore((s) => s.collection)
  const player = useGameStore((s) => s.player)
  const loadCollection = useGameStore((s) => s.loadCollection)
  const claimIncome = useGameStore((s) => s.claimIncome)
  const upgradeCard = useGameStore((s) => s.upgradeCard)
  const [tierFilter, setTierFilter] = useState<Tier | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [detail, setDetail] = useState<OwnedCard | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    void loadCollection()
  }, [loadCollection])

  const cards = useMemo(() => {
    let out = collection?.cards ?? []
    if (tierFilter) out = out.filter((c) => c.tier === tierFilter)
    if (categoryFilter) out = out.filter((c) => c.category === categoryFilter)
    return out
  }, [collection, tierFilter, categoryFilter])

  const s = collection?.summary

  async function onClaimIncome() {
    setClaiming(true)
    await claimIncome()
    setClaiming(false)
  }

  async function onUpgrade(card: OwnedCard) {
    setUpgrading(true)
    const result = await upgradeCard(card.card_id)
    setUpgrading(false)
    if (!result) return
    setDetail((current) => current && current.card_id === card.card_id
      ? {
          ...current,
          level: result.level,
          max_level: result.max_level,
          income_per_day: result.income_per_day,
          upgrade_cost: result.next_upgrade_cost,
          can_upgrade: result.next_upgrade_cost != null && current.count > result.level,
        }
      : current)
  }

  return (
    <div className="pointer-events-auto absolute inset-x-2 top-14 bottom-2 sm:inset-x-auto sm:right-4 sm:w-[42rem] border border-[#4cc9ff]/40 bg-[#02040a]/94 backdrop-blur-md flex flex-col">
      <div className="flex items-center justify-between border-b border-[#4cc9ff]/25 px-4 py-2">
        <span className="text-hud-xs tracking-[0.25em] text-[#7be0ff]">
          COLLECTION{s ? ` · ${s.total_cards} CARDS · ${s.total_pulls} SCANS` : ''}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-hud-xs text-[#4cc9ff]/70 hover:text-[#7be0ff]"
        >
          ✕ CLOSE
        </button>
      </div>

      {s && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#4cc9ff]/15 px-4 py-1.5 text-hud-2xs tracking-[0.18em] text-[#9db8cc]">
          <span>
            CATEGORIES {s.categories.length}/{s.categories_total}
          </span>
          <span>COUNTRIES {s.countries.length}</span>
          <span>CONTINENTS {s.continents.length}/6</span>
          <span>+{s.income_per_day} FLUX/DAY</span>
          <button
            type="button"
            onClick={onClaimIncome}
            disabled={claiming || s.income_ready <= 0}
            className={`border px-1.5 py-0.5 transition ${
              s.income_ready > 0
                ? 'border-[#7ee5a3]/60 text-[#7ee5a3] hover:bg-[#7ee5a3]/10'
                : 'border-[#4cc9ff]/20 text-[#7a93a8]'
            }`}
          >
            {claiming ? 'COLLECTING...' : `COLLECT ${s.income_ready} FLUX`}
          </button>
          {collection!.badges.map((b) => (
            <span key={b} className="border border-[#ffd166]/50 px-1.5 py-0.5 text-[#ffd166]">
              ◆ {BADGE_LABELS[b] ?? b.toUpperCase()}
            </span>
          ))}
        </div>
      )}

      {/* filters */}
      <div className="flex flex-wrap items-center gap-1 border-b border-[#4cc9ff]/15 px-4 py-1.5">
        <button
          type="button"
          onClick={() => setTierFilter(null)}
          className={`border px-1.5 py-0.5 text-hud-2xs ${!tierFilter ? 'border-[#7be0ff] text-[#cfe6ff]' : 'border-[#4cc9ff]/30 text-[#4cc9ff]/70'}`}
        >
          ALL
        </button>
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTierFilter(tierFilter === t ? null : t)}
            className={`border px-1.5 py-0.5 text-hud-2xs ${tierFilter === t ? 'border-current' : 'border-[#4cc9ff]/20 opacity-60'}`}
            style={{ color: TIER_COLORS[t] }}
          >
            {TIER_LABELS[t]}
          </button>
        ))}
        <span className="mx-1 opacity-30">|</span>
        {CATEGORIES.filter((c) => c.id !== 'markets').map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoryFilter(categoryFilter === c.id ? null : c.id)}
            className={`border px-1.5 py-0.5 text-hud-2xs ${categoryFilter === c.id ? 'border-current' : 'border-[#4cc9ff]/20 opacity-60'}`}
            style={{ color: c.color }}
          >
            {c.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {!collection ? (
          <div className="p-4 text-hud-xs text-[#7a93a8]">LOADING COLLECTION…</div>
        ) : cards.length === 0 ? (
          <div className="p-4 text-hud-xs normal-case tracking-normal text-[#7a93a8]">
            {collection.cards.length === 0
              ? 'Nothing yet — run your first scan.'
              : 'No cards match this filter.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {cards.map((c) => (
              <button
                key={c.card_id}
                type="button"
                onClick={() => setDetail(c)}
                className="group relative border bg-[#03060d] p-2 text-left transition hover:bg-[#4cc9ff]/5"
                style={{ borderColor: `${TIER_COLORS[c.tier]}55` }}
              >
                <div className="flex items-center justify-between text-hud-2xs">
                  <span style={{ color: TIER_COLORS[c.tier] }}>
                    {TIER_LABELS[c.tier]} · LVL {c.level}
                  </span>
                  {c.count > 1 && <span className="text-[#7a93a8]">×{c.count}</span>}
                </div>
                <div className="mt-1 text-lg leading-none">{flagEmoji(c.country)}</div>
                <div className="mt-1 line-clamp-2 text-hud-xs normal-case tracking-normal text-[#cfe0ee]">
                  {c.headline}
                </div>
                <div className="mt-1 text-hud-2xs tracking-[0.15em] text-[#7a93a8]">
                  {(c.category ?? '').toUpperCase()}
                </div>
                <div className="mt-1 text-hud-2xs tracking-[0.15em] text-[#7ee5a3]">
                  +{c.income_per_day} FLUX/D
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* detail overlay */}
      {detail && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-[#02040a]/85 p-4"
          onClick={() => setDetail(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-3">
            <GameCardFace card={detail} />
            <div className="flex items-center gap-3">
              <span className="text-hud-2xs tracking-[0.2em] text-[#7a93a8]">
                PULLED {new Date(detail.first_at).toLocaleDateString()} ·{' '}
                {countryName(detail.country) ?? 'EARTH'} · LVL {detail.level}/{detail.max_level} ·{' '}
                +{detail.income_per_day} FLUX/DAY
              </span>
              <button
                type="button"
                onClick={() => onUpgrade(detail)}
                disabled={
                  upgrading ||
                  !detail.can_upgrade ||
                  detail.upgrade_cost == null ||
                  (player?.wallet.flux ?? 0) < detail.upgrade_cost
                }
                className={`border px-2 py-1 text-hud-2xs transition ${
                  detail.can_upgrade &&
                  detail.upgrade_cost != null &&
                  (player?.wallet.flux ?? 0) >= detail.upgrade_cost
                    ? 'border-[#7ee5a3]/60 text-[#7ee5a3] hover:bg-[#7ee5a3]/10'
                    : 'border-[#4cc9ff]/20 text-[#7a93a8]'
                }`}
              >
                {upgrading
                  ? 'UPGRADING...'
                  : detail.upgrade_cost == null
                    ? detail.level >= detail.max_level
                      ? 'MAX LEVEL'
                      : 'NEED COPY'
                    : `UPGRADE · ${detail.upgrade_cost} FLUX`}
              </button>
              <ShareButton
                build={() => ({
                  kind: 'pull',
                  title: detail.headline,
                  place: countryName(detail.country),
                  flyLat: detail.lat,
                  flyLon: detail.lon,
                  stats: {
                    tier: detail.tier,
                    category: detail.category,
                    pool_date: detail.pool_date,
                    art_seed: detail.art_seed,
                  },
                })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
