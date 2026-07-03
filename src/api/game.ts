// Game API client. Anonymous identity: a server-minted token persisted in
// localStorage; the collection lives in this browser (no accounts). All
// player-state calls send X-Player-Token.

import { API_BASE } from './client'

const TOKEN_KEY = 'worldview:game:token'
const PLAYER_KEY = 'worldview:game:player-id'

export type Tier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export interface GameCard {
  card_id: string
  headline: string
  summary: string | null
  lat: number | null
  lon: number | null
  country: string | null
  category: string | null
  tier: Tier
  art_seed: number
  pool_date: string
  image_url: string | null
  source_outlet: string | null
}

export interface Wallet {
  flux: number
  scans_left: number
  since_epic: number
  since_legendary: number
}

export interface Player {
  player_id: string
  name: string | null
  streak_days: number
  wallet: Wallet
  badges: string[]
}

export interface ScanResult {
  card: GameCard
  is_dupe: boolean
  flux_credit: number
  flux_spent: number
  pity_hit: 'epic' | 'legendary' | null
  new_badges: string[]
  streak_days: number
  wallet: Wallet
}

export interface OwnedCard extends GameCard {
  count: number
  level: number
  max_level: number
  first_at: string
  income_per_day: number
  upgrade_cost: number | null
  can_upgrade: boolean
}

export interface Collection {
  cards: OwnedCard[]
  badges: string[]
  summary: {
    total_cards: number
    total_pulls: number
    by_tier: Partial<Record<Tier, number>>
    categories: string[]
    categories_total: number
    countries: string[]
    continents: string[]
    has_legendary: boolean
    income_ready: number
    income_per_day: number
  }
}

export interface Rates {
  tiers: Record<Tier, number>
  pity: { epic: number; legendary: number }
  daily_scans: { base: number; streak_min_days: number; streak_amount: number }
  dupe_flux: Record<Tier, number>
  card_income: {
    daily_by_tier: Record<Tier, number>
    duplicate_bonus: number
    duplicate_bonus_cap: number
    freshness_hours: number
    freshness_multiplier: number
    accrual_cap_hours: number
  }
  scan_prices: { bonus: number }
  card_upgrades: {
    max_level: number
    income_bonus_per_level: number
    cost_by_tier: Record<Tier, number>
  }
}

export interface IncomeResult {
  ready: number
  claimed: number
  income_per_day: number
  wallet: Wallet
}

export interface UpgradeResult {
  card_id: string
  level: number
  max_level: number
  flux_spent: number
  income_per_day: number
  next_upgrade_cost: number | null
  wallet: Wallet
}

export class ScanRefusedError extends Error {
  resetAt: string | null
  constructor(message: string, resetAt: string | null) {
    super(message)
    this.resetAt = resetAt
  }
}

function token(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  withAuth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (withAuth) {
    const t = token()
    if (t) headers['X-Player-Token'] = t
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (res.status === 429) {
    const body = await res.json().catch(() => null)
    const detail = body?.detail
    throw new ScanRefusedError(
      detail?.message ?? 'No scans left today.',
      detail?.reset_at ?? null,
    )
  }
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
  return (await res.json()) as T
}

/** Provision on first visit, reuse the stored token afterwards. If the
 * stored token has gone stale (server reset), re-provision once. */
export async function ensurePlayer(): Promise<Player> {
  if (token()) {
    try {
      return await request<Player>('/game/player')
    } catch (e) {
      // 401 → stale token → fall through and re-provision
      if (!(e instanceof Error) || !e.message.includes('401')) {
        if (e instanceof ScanRefusedError) throw e
      }
    }
  }
  const created = await request<Player & { token: string }>(
    '/game/player',
    { method: 'POST', body: JSON.stringify({}) },
    false,
  )
  localStorage.setItem(TOKEN_KEY, created.token)
  localStorage.setItem(PLAYER_KEY, created.player_id)
  return created
}

export function scan(payment: 'free' | 'flux' = 'free'): Promise<ScanResult> {
  return request<ScanResult>('/game/scan', {
    method: 'POST',
    body: JSON.stringify({ payment }),
  })
}

export function getCollection(): Promise<Collection> {
  return request<Collection>('/game/collection')
}

export function claimIncome(): Promise<IncomeResult> {
  return request<IncomeResult>('/game/income/claim', { method: 'POST' })
}

export function upgradeCard(cardId: string): Promise<UpgradeResult> {
  return request<UpgradeResult>(`/game/cards/${cardId}/upgrade`, { method: 'POST' })
}

export function getRates(): Promise<Rates> {
  return request<Rates>('/game/rates', {}, false)
}
