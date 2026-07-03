// Game state slice — separate store from useAppStore so the news HUD never
// re-renders on game actions. The reveal is cosmetic: the pull is committed
// server-side before the response arrives, so interrupting costs nothing.

import { create } from 'zustand'
import {
  claimIncome as apiClaimIncome,
  ensurePlayer,
  getCollection,
  getRates,
  scan as apiScan,
  ScanRefusedError,
  upgradeCard as apiUpgradeCard,
  type Collection,
  type Player,
  type Rates,
  type IncomeResult,
  type ScanResult,
  type UpgradeResult,
} from '../api/game'

export type ScanPhase = 'idle' | 'scanning' | 'lockon' | 'reveal'

interface GameState {
  player: Player | null
  bootStatus: 'idle' | 'loading' | 'ready' | 'error'
  scanPhase: ScanPhase
  lastScan: ScanResult | null
  scanError: string | null
  resetAt: string | null
  collection: Collection | null
  rates: Rates | null

  boot: () => Promise<void>
  doScan: (payment?: 'free' | 'flux') => Promise<ScanResult | null>
  finishReveal: () => void
  claimIncome: () => Promise<IncomeResult | null>
  upgradeCard: (cardId: string) => Promise<UpgradeResult | null>
  loadCollection: () => Promise<void>
  loadRates: () => Promise<void>
}

export const useGameStore = create<GameState>()((set, get) => ({
  player: null,
  bootStatus: 'idle',
  scanPhase: 'idle',
  lastScan: null,
  scanError: null,
  resetAt: null,
  collection: null,
  rates: null,

  boot: async () => {
    if (get().bootStatus === 'loading') return
    set({ bootStatus: 'loading' })
    try {
      const player = await ensurePlayer()
      set({ player, bootStatus: 'ready', scanError: null })
    } catch {
      set({ bootStatus: 'error' })
    }
  },

  doScan: async (payment = 'free') => {
    if (get().scanPhase !== 'idle') return null
    set({ scanPhase: 'scanning', scanError: null, lastScan: null })
    try {
      const result = await apiScan(payment)
      const player = get().player
      set({
        lastScan: result,
        player: player
          ? { ...player, wallet: result.wallet, streak_days: result.streak_days,
              badges: [...new Set([...player.badges, ...result.new_badges])] }
          : player,
      })
      return result
    } catch (e) {
      if (e instanceof ScanRefusedError) {
        set({ scanPhase: 'idle', scanError: e.message, resetAt: e.resetAt })
      } else {
        set({ scanPhase: 'idle', scanError: 'Scan failed — feed unreachable.' })
      }
      return null
    }
  },

  finishReveal: () => set({ scanPhase: 'idle' }),

  claimIncome: async () => {
    try {
      const result = await apiClaimIncome()
      const player = get().player
      const collection = get().collection
      set({
        player: player ? { ...player, wallet: result.wallet } : player,
        collection: collection
          ? {
              ...collection,
              summary: {
                ...collection.summary,
                income_ready: result.ready,
                income_per_day: result.income_per_day,
              },
            }
          : collection,
      })
      return result
    } catch {
      return null
    }
  },

  upgradeCard: async (cardId: string) => {
    try {
      const result = await apiUpgradeCard(cardId)
      const player = get().player
      set({ player: player ? { ...player, wallet: result.wallet } : player })
      await get().loadCollection()
      return result
    } catch {
      return null
    }
  },

  loadCollection: async () => {
    try {
      set({ collection: await getCollection() })
    } catch {
      /* keep last known collection — browsable offline */
    }
  },

  loadRates: async () => {
    try {
      set({ rates: await getRates() })
    } catch {
      /* rates screen shows a fetch error state */
    }
  },
}))
