import { describe, expect, it } from 'vitest'
import { VENUES, pickVenue } from './venues'

describe('race venues', () => {
  it('has at least five distinct places', () => {
    expect(VENUES.length).toBeGreaterThanOrEqual(5)
    expect(new Set(VENUES.map((v) => v.id)).size).toBe(VENUES.length)
  })
  it('gives both players of a live race the same venue', () => {
    expect(pickVenue('race-abc').id).toBe(pickVenue('race-abc').id)
  })
  it('never repeats the same venue twice in a row', () => {
    let prev = pickVenue(undefined, () => 0).id
    for (let i = 0; i < 50; i++) {
      const v = pickVenue(undefined, () => (i * 0.37) % 1).id
      expect(v).not.toBe(prev)
      prev = v
    }
  })
})
