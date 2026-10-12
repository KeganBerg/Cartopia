import { describe, expect, it } from 'vitest'
import { BUILDINGS } from './data'
import { HOURS, clockHour, hoursOf, seedOf } from './hours'

describe('closing time', () => {
  it('keeps round-the-clock places lit and closes the rest', () => {
    for (const id of ['gas', 'hospital', 'police', 'firehouse', 'motel', 'club', 'rescue']) expect(hoursOf(id)).toBe(HOURS.always)
    expect(hoursOf('offices')).toBe(HOURS.office)
    expect(hoursOf('coffee')).toBe(HOURS.early)
    expect(hoursOf('diner')).toBe(HOURS.late)
    expect(hoursOf('house')).toBe(HOURS.home)
  })
  it('only names real buildings', () => {
    const ids = new Set(BUILDINGS.map((b) => b.id))
    for (const id of ['offices', 'hq', 'glasstower', 'coffee', 'donut', 'tires', 'diner', 'pizza', 'school', 'house', 'trailer']) expect(ids.has(id)).toBe(true)
  })
  it('gives each building a stable seed in 0..1 and counts the night without wrapping', () => {
    expect(seedOf('b12')).toBe(seedOf('b12'))
    expect(seedOf('b12')).not.toBe(seedOf('b13'))
    for (const s of ['a', 'b1', 'xyz-123']) {
      expect(seedOf(s)).toBeGreaterThanOrEqual(0)
      expect(seedOf(s)).toBeLessThan(1)
    }
    expect(clockHour(0)).toBe(12)
    expect(clockHour(0.5)).toBe(24)
  })
})
