import type { DotRecord } from '../globe/dots'

export const BREAKING_COUNT = 6
// Diversity cap: one storm system can spawn several huge NWS-alert clusters
// that would otherwise fill every breaking slot with near-identical
// "Severe Thunderstorm Warning" entries.
export const MAX_PER_CATEGORY = 2
// Breaking means happening NOW: clusters whose last activity (occurredAt is
// the cluster's last_seen) is older than this stay on the globe but leave the
// breaking list. Dots without a timestamp (seed/demo data) are kept.
export const MAX_AGE_MS = 6 * 60 * 60 * 1000

function isNewsDot(d: DotRecord): boolean {
  return !d.id.startsWith('mkt:')
}

function isFresh(d: DotRecord, now: number): boolean {
  if (!d.occurredAt) return true
  const t = Date.parse(d.occurredAt)
  return Number.isNaN(t) || now - t <= MAX_AGE_MS
}

// Pick the breaking-news list: importance first (most consequential story on
// top), recency as tiebreaker, stale items dropped, capped per category so
// one topic can't clog the whole list.
export function pickBreaking(
  dots: DotRecord[],
  count = BREAKING_COUNT,
  maxPerCategory = MAX_PER_CATEGORY,
  now = Date.now(),
): DotRecord[] {
  const sorted = [...dots]
    .filter(isNewsDot)
    .filter((d) => d.breaking === true)
    .filter((d) => isFresh(d, now))
    .sort((a, b) => {
      const ai = a.importance ?? 0
      const bi = b.importance ?? 0
      if (bi !== ai) return bi - ai
      const at = a.occurredAt ? Date.parse(a.occurredAt) : 0
      const bt = b.occurredAt ? Date.parse(b.occurredAt) : 0
      return bt - at
    })

  const out: DotRecord[] = []
  const perCategory = new Map<string, number>()
  for (const d of sorted) {
    const cat = d.category ?? 'uncategorized'
    const n = perCategory.get(cat) ?? 0
    if (n >= maxPerCategory) continue
    perCategory.set(cat, n + 1)
    out.push(d)
    if (out.length >= count) break
  }
  return out
}
