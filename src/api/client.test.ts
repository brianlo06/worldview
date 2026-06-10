import { describe, expect, it } from 'vitest'
import {
  clusterCommonToDot,
  ensureCategory,
  formatSourceLabel,
  type ApiClusterCommon,
} from './client'

describe('ensureCategory', () => {
  it('passes through a valid category', () => {
    expect(ensureCategory('conflict')).toBe('conflict')
    expect(ensureCategory('weather')).toBe('weather')
  })

  it('falls back to business for unknown values', () => {
    expect(ensureCategory('sports')).toBe('business')
  })

  it('falls back to business for null/empty', () => {
    expect(ensureCategory(null)).toBe('business')
    expect(ensureCategory('')).toBe('business')
  })
})

describe('formatSourceLabel', () => {
  it('returns the bare outlet for a single source', () => {
    expect(formatSourceLabel('bbc.com', 1)).toBe('bbc.com')
  })

  it('appends "+N more" for multi-source stories', () => {
    expect(formatSourceLabel('fox13seattle.com', 19)).toBe(
      'fox13seattle.com · +18 more',
    )
  })

  it('uses the "source" placeholder when the outlet is unknown', () => {
    expect(formatSourceLabel(null, 3)).toBe('source · +2 more')
  })

  it('is undefined for a single source with unknown outlet', () => {
    expect(formatSourceLabel(null, 1)).toBeUndefined()
  })
})

function clusterRow(overrides: Partial<ApiClusterCommon> = {}): ApiClusterCommon {
  return {
    title: 'Quake hits coastal region',
    summary: 'A 6.1 magnitude earthquake struck offshore.',
    url: 'https://example.com/quake',
    image_url: 'https://example.com/quake.jpg',
    source_outlet: 'example.com',
    event_count: 4,
    lat: 35.6,
    lon: 139.7,
    country_code: 'JP',
    city: 'Tokyo',
    category: 'quake',
    importance: 0.8,
    breaking: true,
    geo_precision: 'city',
    ...overrides,
  }
}

describe('clusterCommonToDot', () => {
  it('returns null when coordinates are missing', () => {
    expect(clusterCommonToDot(clusterRow({ lat: null }), 'abc')).toBeNull()
    expect(clusterCommonToDot(clusterRow({ lon: null }), 'abc')).toBeNull()
  })

  it('maps snake_case fields onto a cl:-prefixed DotRecord', () => {
    const dot = clusterCommonToDot(clusterRow(), 'abc-123')
    expect(dot).toMatchObject({
      id: 'cl:abc-123',
      lat: 35.6,
      lon: 139.7,
      title: 'Quake hits coastal region',
      imageUrl: 'https://example.com/quake.jpg',
      sourceOutlet: 'example.com · +3 more',
      importance: 0.8,
      category: 'quake',
      breaking: true,
      eventCount: 4,
      countryCode: 'JP',
      city: 'Tokyo',
      geoPrecision: 'city',
    })
  })

  it('defaults importance to 0.5 and category to business', () => {
    const dot = clusterCommonToDot(
      clusterRow({ importance: null, category: 'not-a-category' }),
      'x',
    )
    expect(dot?.importance).toBe(0.5)
    expect(dot?.category).toBe('business')
  })
})
