import { describe, expect, it } from 'vitest'
import { naturalPhase } from './clock'
import { setLiveEvents } from './liveEvents'
import { FEEL, SPELL_MS, seedRoll, spellKind, weatherNow, type WeatherKind } from './weather'

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

  it('brings mist only on mornings, sun after showers, heat only in summer afternoons', () => {
    const phase = (i: number) => naturalPhase(i * SPELL_MS)
    let mist = 0, clearing = 0, heat = 0
    for (const season of ['winter', 'spring', 'summer', 'fall'] as const) {
      for (let i = 1; i < 4000; i++) {
        const k = spellKind(i, season)
        if (k === 'mist') {
          mist++
          expect(season).not.toBe('winter')
          expect(phase(i)).toBeGreaterThanOrEqual(0.68)
          expect(phase(i)).toBeLessThanOrEqual(0.9)
        }
        if (k === 'clearing') {
          clearing++
          expect(season).not.toBe('winter')
          expect(['rain', 'storm', 'drizzle']).toContain(spellKind(i - 1, season))
        }
        if (k === 'heat') {
          heat++
          expect(season).toBe('summer')
        }
      }
    }
    expect(mist).toBeGreaterThan(50)
    expect(clearing).toBeGreaterThan(200)
    expect(heat).toBeGreaterThan(20)
  })

  it('lets a weather live event set the sky for everyone, fading in and out', () => {
    const t = 1_900_000_000_000
    setLiveEvents([{ id: 1, kind: 'weather', payload: { kind: 'fog' }, from: t, to: t + 10 * 60_000 }])
    expect({ ...weatherNow(t + 1000) }.strength).toBeLessThan(0.05)
    const mid = { ...weatherNow(t + 5 * 60_000) }
    expect(mid.kind).toBe('fog')
    expect(mid.strength).toBe(1)
    // Unknown kinds are ignored.
    setLiveEvents([{ id: 2, kind: 'weather', payload: { kind: 'lava' }, from: t, to: t + 10 * 60_000 }])
    expect({ ...weatherNow(t + 5 * 60_000 + 500) }.kind).toBe(spellKind(Math.floor((t + 5 * 60_000 + 500) / SPELL_MS)))
    setLiveEvents([])
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

  it('rolls the same race weather from the same live race id', () => {
    expect(seedRoll('race-abc')).toBe(seedRoll('race-abc'))
    const rolls = Array.from({ length: 200 }, (_, i) => seedRoll(`race-${i}`))
    expect(Math.min(...rolls)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...rolls)).toBeLessThan(1)
    expect(rolls.filter((r) => r < 0.5).length).toBeGreaterThan(70)
    expect(rolls.filter((r) => r < 0.5).length).toBeLessThan(130)
  })
})
