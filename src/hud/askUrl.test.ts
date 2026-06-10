// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { readParams, writeParams } from './askUrl'

describe('askUrl params', () => {
  it('writes params and reads them back', () => {
    writeParams({ ask: 'biggest story right now', lat: '35.6' })
    const p = readParams()
    expect(p.get('ask')).toBe('biggest story right now')
    expect(p.get('lat')).toBe('35.6')
    expect(window.location.search).toContain('ask=')
  })

  it('preserves unrelated params on update', () => {
    writeParams({ ask: 'one', lat: '1' })
    writeParams({ lat: '2' })
    const p = readParams()
    expect(p.get('ask')).toBe('one')
    expect(p.get('lat')).toBe('2')
  })

  it('deletes keys set to null or empty string', () => {
    writeParams({ ask: 'one', lat: '1' })
    writeParams({ ask: null, lat: '' })
    const p = readParams()
    expect(p.get('ask')).toBeNull()
    expect(p.get('lat')).toBeNull()
  })

  it('drops the query string entirely when no params remain', () => {
    writeParams({ ask: 'one' })
    writeParams({ ask: null })
    expect(window.location.search).toBe('')
  })
})
