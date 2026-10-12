import { describe, expect, it } from 'vitest'
import { placeOf } from './sun'
import { DAY_MS, OPEN_FROM, OPEN_TO, naturalPhase, nextPhaseAt, nightAmount } from './clock'
import { seasonOf } from '../scene/season'

const MIN = 60_000
const NOON = 1000 * DAY_MS

describe('place', () => {
  it('knows roughly where a time zone is, old names too', () => {
    expect(placeOf('America/New_York')).toEqual({ lat: 41, lon: -74 })
    expect(placeOf('US/Eastern')).toEqual(placeOf('America/New_York'))
    expect(placeOf('Asia/Kolkata')).toEqual(placeOf('Asia/Calcutta'))
    expect(placeOf('Australia/Sydney')!.lat).toBeLessThan(0)
    expect(placeOf('UTC')).toBeNull()
    expect(placeOf('Nowhere/Land')).toBeNull()
  })
})

describe('town clock', () => {
  const open = (t: number) => {
    const p = naturalPhase(t)
    return p >= OPEN_FROM && p < OPEN_TO
  }

  it('runs 10 minutes of day, then 10 of night, the same for everyone', () => {
    let night = 0
    for (let t = NOON; t < NOON + DAY_MS; t += 1000) if (open(t)) night++
    expect(night).toBe(600)
    expect(open(NOON + 5 * MIN - 1000)).toBe(false)
    expect(open(NOON + 5 * MIN)).toBe(true)
    expect(open(NOON + 15 * MIN - 1000)).toBe(true)
    expect(open(NOON + 15 * MIN)).toBe(false)
    expect(nightAmount(naturalPhase(NOON))).toBe(0)
    expect(nightAmount(naturalPhase(NOON + 10 * MIN))).toBe(1)
  })

  it('fades smoothly through dusk and dawn', () => {
    let last = nightAmount(naturalPhase(NOON))
    for (let t = NOON; t < NOON + DAY_MS; t += 1000) {
      const n = nightAmount(naturalPhase(t))
      expect(Math.abs(n - last)).toBeLessThan(0.01)
      last = n
    }
  })

  it('finds when the club opens next', () => {
    expect(nextPhaseAt(OPEN_FROM, NOON)).toBe(NOON + 5 * MIN)
    expect(nextPhaseAt(OPEN_FROM, NOON + 16 * MIN)).toBe(NOON + DAY_MS + 5 * MIN)
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
