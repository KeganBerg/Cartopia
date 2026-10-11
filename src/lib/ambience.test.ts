import { describe, expect, it } from 'vitest'
import { ambientMix } from './ambience'

describe('ambientMix', () => {
  it('plays crickets on summer nights and traffic by day', () => {
    const night = ambientMix(1, 'summer')
    const day = ambientMix(0, 'summer')
    expect(night.crickets).toBe(1)
    expect(day.crickets).toBe(0)
    expect(day.traffic).toBeGreaterThan(night.traffic)
    expect(day.cicadas).toBeGreaterThan(0)
  })
  it('keeps winter quiet: no insects or frogs, wind and owls instead', () => {
    for (const n of [0, 0.5, 1]) {
      const m = ambientMix(n, 'winter')
      expect(m.crickets + m.peepers + m.cicadas + m.leaves).toBe(0)
      expect(m.wind).toBeGreaterThan(0.5)
    }
    expect(ambientMix(1, 'winter').owls).toBeGreaterThan(0)
  })
  it('brings spring peepers and fall leaves', () => {
    expect(ambientMix(1, 'spring').peepers).toBe(1)
    expect(ambientMix(0, 'fall').leaves).toBeGreaterThan(ambientMix(0, 'summer').leaves)
  })
  it('stays within 0..1', () => {
    for (const s of ['winter', 'spring', 'summer', 'fall'] as const)
      for (const n of [0, 0.3, 1]) for (const v of Object.values(ambientMix(n, s))) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
  })
})
