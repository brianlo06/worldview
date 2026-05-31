import type { DotRecord } from './dots'

export type SignificanceTier = 'all' | 'notable' | 'major' | 'top'

export interface TierDef {
  id: SignificanceTier
  label: string
  description: string
}

export const TIERS: TierDef[] = [
  { id: 'all',     label: 'ALL',     description: 'Show everything, no filtering' },
  { id: 'notable', label: 'NOTABLE', description: 'Importance ≥ 0.65 — cuts long-tail noise' },
  { id: 'major',   label: 'MAJOR',   description: 'Importance ≥ 0.68 — substantive stories' },
  { id: 'top',     label: 'TOP',     description: 'Importance ≥ 0.75 — top of distribution' },
]

// keep in sync with tier_where_clause in worldview-api/src/worldview_api/scoring.py
/** Whether a dot survives the active significance filter. */
export function passesTier(d: DotRecord, tier: SignificanceTier): boolean {
  if (tier === 'all') return true
  // Breaking-tagged events always pass — they're urgent by definition
  if (d.breaking) return true
  const importance = d.importance ?? 0
  switch (tier) {
    case 'notable':
      return importance >= 0.65
    case 'major':
      return importance >= 0.68
    case 'top':
      return importance >= 0.75
  }
}
