// Published drop rates — live server values, never hardcoded copy.

import { useEffect } from 'react'
import { useGameStore } from '../store/useGameStore'
import { TIER_COLORS, TIER_LABELS } from './GameCard'
import type { Tier } from '../api/game'

const TIERS: Tier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']

export function RatesPanel({ onClose }: { onClose: () => void }) {
  const rates = useGameStore((s) => s.rates)
  const loadRates = useGameStore((s) => s.loadRates)

  useEffect(() => {
    void loadRates()
  }, [loadRates])

  return (
    <div className="pointer-events-auto border border-[#4cc9ff]/40 bg-[#02040a]/92 backdrop-blur-sm p-4 w-[19rem]">
      <div className="flex items-center justify-between">
        <span className="text-hud-xs tracking-[0.25em] text-[#7be0ff]">DROP RATES</span>
        <button
          type="button"
          onClick={onClose}
          className="text-hud-xs text-[#4cc9ff]/70 hover:text-[#7be0ff]"
        >
          ✕
        </button>
      </div>
      {!rates ? (
        <div className="mt-3 text-hud-xs text-[#7a93a8]">FETCHING LIVE RATES…</div>
      ) : (
        <>
          <div className="mt-3 space-y-1.5">
            {TIERS.map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span
                  className="w-24 text-hud-2xs tracking-[0.2em]"
                  style={{ color: TIER_COLORS[t] }}
                >
                  {TIER_LABELS[t]}
                </span>
                <div className="h-1.5 flex-1 bg-[#4cc9ff]/10">
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.max(1, rates.tiers[t])}%`,
                      background: TIER_COLORS[t],
                    }}
                  />
                </div>
                <span className="w-12 text-right text-hud-2xs text-[#9db8cc]">
                  {rates.tiers[t]}%
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-[#4cc9ff]/20 pt-2 text-hud-2xs normal-case tracking-normal text-[#7a93a8]">
            Pity: Epic or better within {rates.pity.epic} scans, Legendary within{' '}
            {rates.pity.legendary}. {rates.daily_scans.base} free scans a day (
            {rates.daily_scans.streak_amount} on a {rates.daily_scans.streak_min_days}
            -day streak). Bonus scans cost {rates.scan_prices.bonus} Flux. No purchases,
            ever.
          </div>
          <div className="mt-3 border-t border-[#4cc9ff]/20 pt-2">
            <div className="text-hud-2xs tracking-[0.22em] text-[#7be0ff]">
              CARD INCOME
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              {TIERS.map((t) => (
                <div key={t} className="flex justify-between text-hud-2xs">
                  <span style={{ color: TIER_COLORS[t] }}>{TIER_LABELS[t]}</span>
                  <span className="text-[#9db8cc]">
                    +{rates.card_income.daily_by_tier[t]} / day
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-hud-2xs normal-case tracking-normal text-[#7a93a8]">
              Income accrues for {rates.card_income.accrual_cap_hours}h. Fresh pulls earn{' '}
              {rates.card_income.freshness_multiplier}x for{' '}
              {rates.card_income.freshness_hours}h.
            </div>
          </div>
          <div className="mt-3 border-t border-[#4cc9ff]/20 pt-2">
            <div className="text-hud-2xs tracking-[0.22em] text-[#7be0ff]">
              UPGRADES
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              {TIERS.map((t) => (
                <div key={t} className="flex justify-between text-hud-2xs">
                  <span style={{ color: TIER_COLORS[t] }}>{TIER_LABELS[t]}</span>
                  <span className="text-[#9db8cc]">
                    {rates.card_upgrades.cost_by_tier[t]} base
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-hud-2xs normal-case tracking-normal text-[#7a93a8]">
              Upgrades require duplicate copies and Flux. Each level adds{' '}
              {Math.round(rates.card_upgrades.income_bonus_per_level * 100)}% card income.
              Max level {rates.card_upgrades.max_level}.
            </div>
          </div>
        </>
      )}
    </div>
  )
}
