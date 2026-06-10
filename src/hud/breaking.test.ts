import { describe, expect, it } from 'vitest'
import type { DotRecord } from '../globe/dots'
import { pickBreaking } from './breaking'

let nextId = 0
function dot(overrides: Partial<DotRecord> = {}): DotRecord {
  nextId += 1
  return {
    id: `cl:${nextId}`,
    lat: 0,
    lon: 0,
    title: `story ${nextId}`,
    importance: 0.5,
    category: 'politics',
    breaking: true,
    ...overrides,
  }
}

describe('pickBreaking', () => {
  it('excludes non-breaking and market dots', () => {
    const picked = pickBreaking([
      dot({ breaking: false }),
      dot({ id: 'mkt:NYSE' }),
      dot({ title: 'real one' }),
    ])
    expect(picked.map((d) => d.title)).toEqual(['real one'])
  })

  it('sorts by importance, then recency', () => {
    const now = Date.parse('2026-06-10T01:00:00Z')
    const picked = pickBreaking(
      [
        dot({ title: 'older-high', importance: 0.9, occurredAt: '2026-06-09T23:00:00Z' }),
        dot({ title: 'low', importance: 0.3, category: 'business' }),
        dot({ title: 'newer-high', importance: 0.9, occurredAt: '2026-06-10T00:30:00Z' }),
      ],
      6,
      2,
      now,
    )
    expect(picked.map((d) => d.title)).toEqual(['newer-high', 'older-high', 'low'])
  })

  it('caps each category at MAX_PER_CATEGORY so storms cannot clog the list', () => {
    const picked = pickBreaking([
      dot({ title: 'storm 1', category: 'weather', importance: 0.99 }),
      dot({ title: 'storm 2', category: 'weather', importance: 0.98 }),
      dot({ title: 'storm 3', category: 'weather', importance: 0.97 }),
      dot({ title: 'storm 4', category: 'weather', importance: 0.96 }),
      dot({ title: 'airstrikes', category: 'conflict', importance: 0.7 }),
      dot({ title: 'cargo fire', category: 'social', importance: 0.6 }),
    ])
    expect(picked.map((d) => d.title)).toEqual([
      'storm 1',
      'storm 2',
      'airstrikes',
      'cargo fire',
    ])
  })

  it('respects the overall count limit', () => {
    const dots = Array.from({ length: 10 }, (_, i) =>
      dot({ category: i % 2 ? 'politics' : 'conflict' }),
    )
    expect(pickBreaking(dots, 4).length).toBe(4)
  })

  it('drops items idle for more than MAX_AGE_MS, keeps undated ones', () => {
    const now = Date.parse('2026-06-10T12:00:00Z')
    const picked = pickBreaking(
      [
        dot({ title: 'stale', occurredAt: '2026-06-10T01:00:00Z' }),
        dot({ title: 'fresh', occurredAt: '2026-06-10T11:00:00Z' }),
        dot({ title: 'undated (seed)', category: 'conflict' }),
      ],
      6,
      2,
      now,
    )
    expect(picked.map((d) => d.title)).toEqual(['fresh', 'undated (seed)'])
  })
})
