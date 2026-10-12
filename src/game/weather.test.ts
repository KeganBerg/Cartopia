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
    expect({ ...weatherNow(t + 1000) }.mix.fog).toBeLessThan(0.05)
    const mid = { ...weatherNow(t + 5 * 60_000) }
    expect(mid.kind).toBe('fog')
    expect(mid.mix.fog).toBeCloseTo(1)
    // Unknown kinds are ignored.
    setLiveEvents([{ id: 2, kind: 'weather', payload: { kind: 'lava' }, from: t, to: t + 10 * 60_000 }])
    const x = t + 5 * 60_000 + 500
    weatherNow(x - 60_000)
    const lava = { ...weatherNow(x) }
    setLiveEvents([])
    weatherNow(x - 60_000)
    const plain = { ...weatherNow(x) }
    expect(lava.kind).toBe(plain.kind)
    expect(lava.cloud).toBeCloseTo(plain.cloud)
  })

  it('glides out of a live event that ends early instead of popping', () => {
    const t = 1_900_000_600_000
    setLiveEvents([{ id: 3, kind: 'weather', payload: { kind: 'snow' }, from: t, to: t + 10 * 60_000 }])
    weatherNow(t + 3 * 60_000)
    let at = t + 3 * 60_000
    for (let i = 0; i < 5; i++) weatherNow((at += 1000))
    expect(weatherNow(at).mix.snow).toBeGreaterThan(0.95)
    setLiveEvents([])
    const after = { ...weatherNow((at += 1000)) }
    expect(after.mix.snow).toBeGreaterThan(0.85)
    let last = after.snow
    for (let i = 0; i < 60; i++) {
      const now = weatherNow((at += 1000)).snow
      expect(Math.abs(now - last)).toBeLessThan(0.1)
      last = now
    }
    expect(weatherNow(at).mix.snow).toBeLessThan(0.05)
  })

  it('never puts two storms back to back', () => {
    for (let i = 1; i < 4000; i++) {
      const k = spellKind(i, 'summer')
      if (k === 'storm') expect(spellKind(i - 1, 'summer')).not.toBe('storm')
    }
  })

  it('is the same for everyone at the same moment and crossfades between spells', () => {
    const t = 1_800_000_000_000
    const start = Math.floor(t / SPELL_MS) * SPELL_MS
    const mid = { ...weatherNow(start + SPELL_MS / 2) }
    expect(mid.strength).toBe(1)
    expect(mid.cloud).toBeCloseTo(FEEL[mid.kind].cloud)
    expect({ ...weatherNow(start + SPELL_MS / 2 + 500) }.kind).toBe(mid.kind)
    // Across a change of weather nothing jumps: cloud and rain move a little each second.
    let i = Math.floor(t / SPELL_MS)
    while (spellKind(i) === spellKind(i + 1) || FEEL[spellKind(i)].cloud === FEEL[spellKind(i + 1)].cloud) i++
    const edge = (i + 1) * SPELL_MS
    let prev = { ...weatherNow(edge - 60_000) }
    for (let at = edge - 59_000; at <= edge + 60_000; at += 1000) {
      const w = { ...weatherNow(at) }
      expect(Math.abs(w.cloud - prev.cloud)).toBeLessThan(0.05)
      expect(Math.abs(w.rain - prev.rain)).toBeLessThan(0.05)
      prev = w
    }
    expect(prev.kind).toBe(spellKind(i + 1))
  })

  it('runs straight on with no dip when the next spell brings the same weather', () => {
    let i = 7_500_000
    while (spellKind(i) === 'clear' || spellKind(i) !== spellKind(i + 1)) i++
    const w = { ...weatherNow((i + 1) * SPELL_MS) }
    expect(w.kind).toBe(spellKind(i))
    expect(w.strength).toBeCloseTo(1)
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
