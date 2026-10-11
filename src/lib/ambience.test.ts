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

describe('pickSpecies', () => {
  it('picks only birds that are around that season', async () => {
    const { pickSpecies } = await import('./birdsong')
    for (let r = 0; r < 1; r += 0.01) {
      expect(pickSpecies('winter', r)).not.toBe('robin')
      expect(pickSpecies('summer', r)).not.toBe('blueJay')
    }
  })
})

describe('weatherMix', () => {
  it('sends birds and yard work indoors in rain and snow, and adds wind', async () => {
    const { weatherMix } = await import('./ambience')
    const day = ambientMix(0, 'summer')
    const storm = weatherMix(day, { rain: 1, snow: 0, wind: 0.7, wet: 1 })
    expect(storm.birds).toBeLessThan(day.birds * 0.2)
    expect(storm.yard).toBe(0)
    expect(storm.cicadas).toBe(0)
    expect(storm.wind).toBeGreaterThan(day.wind)
    const snow = weatherMix(ambientMix(0, 'winter'), { rain: 0, snow: 1, wind: 1, wet: 0 })
    expect(snow.traffic).toBeLessThan(ambientMix(0, 'winter').traffic)
    expect(snow.leaves).toBe(0)
    for (const v of Object.values(storm)) expect(v).toBeLessThanOrEqual(1)
  })
})
