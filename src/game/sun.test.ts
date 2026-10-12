import { describe, expect, it } from 'vitest'
import { dayAt, placeOf, sunDay } from './sun'
import { naturalPhase, nextPhaseAt, nightAmount } from './clock'
import { seasonOf } from '../scene/season'

const H = 3_600_000
const NYC = placeOf('America/New_York')!
const SYD = placeOf('Australia/Sydney')!
// Hours into the UTC day.
const utcHour = (t: number) => ((t / H) % 24 + 24) % 24
const dayOf = (iso: string, place = NYC) => dayAt(Date.parse(iso), place)

describe('sun', () => {
  it('knows roughly where a time zone is, old names too', () => {
    expect(NYC).toEqual({ lat: 41, lon: -74 })
    expect(placeOf('US/Eastern')).toEqual(NYC)
    expect(placeOf('Asia/Kolkata')).toEqual(placeOf('Asia/Calcutta'))
    expect(placeOf('UTC')).toBeNull()
    expect(placeOf('Nowhere/Land')).toBeNull()
  })

  it('rises and sets close to the real times in New York', () => {
    // 2026-06-21: sunrise 5:25 EDT (9:25 UTC), sunset 20:31 EDT (00:31 UTC).
    const june = sunDay(dayOf('2026-06-21T19:00:00Z'), NYC)
    expect(Math.abs(utcHour(june.rise) - 9.42)).toBeLessThan(0.25)
    expect(Math.abs(utcHour(june.set) - 0.52)).toBeLessThan(0.25)
    // 2026-12-21: sunrise 7:17 EST (12:17 UTC), sunset 16:32 EST (21:32 UTC).
    const dec = sunDay(dayOf('2026-12-21T19:00:00Z'), NYC)
    expect(Math.abs(utcHour(dec.rise) - 12.28)).toBeLessThan(0.25)
    expect(Math.abs(utcHour(dec.set) - 21.53)).toBeLessThan(0.25)
  })

  it('keeps a bit of day and night near the poles', () => {
    const north = { lat: 78, lon: 15 }
    const s = sunDay(dayAt(Date.parse('2026-06-21T12:00:00Z'), north), north)
    expect(s.set - s.rise).toBeLessThanOrEqual(20 * H)
    const w = sunDay(dayAt(Date.parse('2026-12-21T12:00:00Z'), north), north)
    expect(w.set - w.rise).toBeGreaterThanOrEqual(4 * H)
  })
})

describe('local town clock', () => {
  const at = (iso: string, place = NYC) => nightAmount(naturalPhase(Date.parse(iso), place))

  it('is day at noon and night at midnight, local time', () => {
    expect(at('2026-10-12T16:00:00Z')).toBe(0) // noon EDT
    expect(at('2026-10-13T04:00:00Z')).toBe(1) // midnight EDT
    expect(at('2026-10-12T02:00:00Z', SYD)).toBe(0) // 1pm in Sydney
    expect(at('2026-10-12T14:00:00Z', SYD)).toBe(1) // 1am in Sydney
  })

  it('fades smoothly through dusk around sunset', () => {
    const s = sunDay(dayOf('2026-10-12T19:00:00Z'), NYC)
    expect(nightAmount(naturalPhase(s.set - 41 * 60_000, NYC))).toBe(0)
    const mid = nightAmount(naturalPhase(s.set + 5 * 60_000, NYC))
    expect(mid).toBeGreaterThan(0.4)
    expect(mid).toBeLessThan(0.6)
    expect(nightAmount(naturalPhase(s.set + 51 * 60_000, NYC))).toBe(1)
    let last = 0
    for (let t = s.set - H; t < s.set + H; t += 60_000) {
      const n = nightAmount(naturalPhase(t, NYC))
      expect(n).toBeGreaterThanOrEqual(last)
      expect(n - last).toBeLessThan(0.02)
      last = n
    }
  })

  it('finds when the club opens next', () => {
    const noon = Date.parse('2026-10-12T19:00:00Z') // 3pm EDT
    const s = sunDay(dayAt(noon, NYC), NYC)
    expect(Math.abs(nextPhaseAt(0.3, noon, NYC) - (s.set + 5 * 60_000))).toBeLessThan(1000)
    // After dawn it is tomorrow's sunset.
    const morning = Date.parse('2026-10-13T13:00:00Z')
    expect(nextPhaseAt(0.3, morning, NYC)).toBeGreaterThan(Date.parse('2026-10-13T21:00:00Z'))
  })
})

describe('seasons', () => {
  it('follows the local month, flipped down south', () => {
    expect(seasonOf(10)).toBe('fall')
    expect(seasonOf(12)).toBe('winter')
    expect(seasonOf(1)).toBe('winter')
    expect(seasonOf(7)).toBe('summer')
    expect(seasonOf(10, true)).toBe('spring')
    expect(seasonOf(1, true)).toBe('summer')
  })
})
