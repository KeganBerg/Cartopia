import { describe, expect, it } from 'vitest'
import { CHALLENGER_NAMES, challengerCar, challengerPi, makeChallenger } from './challenger'
import { inClass } from './classes'
import { masteryMode } from './mastery'

describe('challengers', () => {
  it('are always a step faster than the car just beaten, and never slower than yours', () => {
    expect(challengerPi(40, 30)).toBeGreaterThan(40)
    expect(challengerPi(40, 60)).toBeGreaterThan(60)
    expect(challengerPi(10, 5)).toBeGreaterThanOrEqual(12)
  })
  it('bring a car of your class', () => {
    expect(inClass(challengerCar('stallion', 50).id, 'muscle')).toBe(true)
    expect(inClass(challengerCar('pip', 30).id, 'compact')).toBe(true)
  })
  it('get faster down the run and count for mastery as a drag race', () => {
    const a = makeChallenger(0, 40, 'stallion', 42, () => 0)
    const b = makeChallenger(1, a.pi, 'stallion', 42, () => 0)
    expect(b.pi).toBeGreaterThan(a.pi)
    expect(a.id).toBe('chal-0')
    expect(CHALLENGER_NAMES).toContain(a.town)
    expect(masteryMode(b.id)).toBe('drag')
  })
})
