import type { DotRecord } from './dots'

export type SignificanceTier = 'all' | 'notable' | 'major' | 'top'

export interface TierDef {
  id: SignificanceTier
  label: string
  description: string
}

export const TIERS: TierDef[] = [
  { id: 'all',     label: 'ALL',     description: 'Show everything, no filtering' },
  { id: 'notable', label: 'NOTABLE', description: 'Importance ≥ 0.45 — cuts long-tail noise' },
  { id: 'major',   label: 'MAJOR',   description: 'Importance ≥ 0.6 or 3+ sources covered it' },
  { id: 'top',     label: 'TOP',     description: 'Importance ≥ 0.75 and 2+ sources' },
]

/** Whether a dot survives the active significance filter. */
export function passesTier(d: DotRecord, tier: SignificanceTier): boolean {
  if (tier === 'all') return true
  // Breaking-tagged events always pass — they're urgent by definition
  if (d.breaking) return true
  const importance = d.importance ?? 0
  const eventCount = d.eventCount ?? 1
  switch (tier) {
    case 'notable':
      return importance >= 0.45
    case 'major':
      return importance >= 0.6 || eventCount >= 3
    case 'top':
      return importance >= 0.75 && eventCount >= 2
  }
}
