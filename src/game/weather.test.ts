import { describe, expect, it } from 'vitest'
import { FEEL, SPELL_MS, spellKind, weatherNow, type WeatherKind } from './weather'

describe('weather', () => {
  it('rolls weather that suits the season, with clear spells most common', () => {
    const count = (season: 'winter' | 'spring' | 'summer' | 'fall') => {
      const seen: Partial<Record<WeatherKind, number>> = {}
      for (let i = 0; i < 4000; i++) {
        const k = spellKind(i, season)
        seen[k] = (seen[k] ?? 0) + 1
      }
      return seen
    }
    const winter = count('winter')
    expect(winter.rain ?? 0).toBe(0)
    expect(winter.snow).toBeGreaterThan(0)
    expect(winter.blizzard).toBeGreaterThan(0)
    const summer = count('summer')
    expect(summer.snow ?? 0).toBe(0)
    expect(summer.storm).toBeGreaterThan(0)
    for (const seen of [winter, summer, count('spring'), count('fall')]) {
      const clear = seen.clear ?? 0
      for (const [k, n] of Object.entries(seen)) if (k !== 'clear') expect(clear).toBeGreaterThan(n)
    }
  })

  it('never puts two storms back to back', () => {
    for (let i = 1; i < 4000; i++) {
      const k = spellKind(i, 'summer')
      if (k === 'storm') expect(spellKind(i - 1, 'summer')).not.toBe('storm')
    }
  })

  it('is the same for everyone at the same moment and fades in at a spell start', () => {
    const t = 1_800_000_000_000
    const start = Math.floor(t / SPELL_MS) * SPELL_MS
    const a = { ...weatherNow(start + 1000) }
    expect(a.strength).toBeLessThan(0.05)
    const mid = { ...weatherNow(start + SPELL_MS / 2) }
    expect(mid.strength).toBe(1)
    expect(mid.cloud).toBeCloseTo(FEEL[mid.kind].cloud)
    expect({ ...weatherNow(start + SPELL_MS / 2 + 500) }.kind).toBe(mid.kind)
  })
})
