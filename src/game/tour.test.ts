// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { MAX_RACE_PI } from './race'
import { useGame } from './store'
import { LOSS_SHARE, boostsSpent } from './boosts'
import { isCleanName } from '../lib/names'
import { TOUR_RACES, TOUR_VENUES, tourLeg, tourLegBonus, tourPrize, tourRivalName, tourRivalPi, tourShift, tourSkills, tourIsBoss } from './tour'

describe('Pro Tour', () => {
  it('gets harder and pays more every race, without end', () => {
    for (let r = 1; r < 400; r++) {
      if (tourRivalPi(r - 1) < MAX_RACE_PI && !tourIsBoss(r - 1)) expect(tourRivalPi(r)).toBeGreaterThanOrEqual(tourRivalPi(r - 1))
      expect(tourShift(r)).toBeGreaterThanOrEqual(tourShift(r - 1))
      expect(tourRivalPi(r)).toBeLessThanOrEqual(MAX_RACE_PI)
    }
    expect(tourRivalPi(0)).toBeLessThan(40)
    // Past the campaign's last boss (PI 124) a few dozen races in, and still climbing.
    expect(tourRivalPi(90)).toBeGreaterThan(124)
    expect(tourPrize(60)).toBeGreaterThan(tourPrize(5))
    expect(tourLegBonus(10)).toBeGreaterThan(tourLegBonus(1))
  })

  it('ends every leg with a boss who is tougher than the race before', () => {
    for (let leg = 0; leg < 20; leg++) {
      const boss = leg * TOUR_RACES + TOUR_RACES - 1
      expect(tourIsBoss(boss)).toBe(true)
      expect(tourRivalName(boss)).toBe(tourLeg(leg).boss)
      expect(tourRivalPi(boss)).toBeGreaterThan(tourRivalPi(boss - 1))
      expect(tourSkills(boss)).toBe(true)
    }
  })

  it('visits every venue at night as well as by day', () => {
    const seen = new Set<string>()
    for (let leg = 0; leg < 30; leg++) seen.add(`${tourLeg(leg).venue}-${tourLeg(leg).night}`)
    expect(seen.size).toBe(TOUR_VENUES.length * 2)
    expect(tourLeg(0)).toMatchObject({ venue: 'main', night: false })
  })

  it('names rivals the same way every time', () => {
    expect(tourRivalName(3)).toBe(tourRivalName(3))
    expect(new Set(Array.from({ length: 20 }, (_, i) => tourRivalName(i))).size).toBeGreaterThan(12)
  })

  it('keeps clean rival names', () => {
    for (let r = 0; r < 300; r++) expect(isCleanName(tourRivalName(r)), tourRivalName(r)).toBe(true)
  })

  it('moves on only after a win, and pays the leg bonus once on beating the boss', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 12, 12))
    useGame.setState({ level: 5, xp: 0, coins: 0, trophies: 0, tour: 0, tourPrize: null, levelUp: null, boosts: boostsSpent(Date.UTC(2026, 9, 12, 12)) })
    const g = () => useGame.getState()
    g().tourResult(false)
    vi.restoreAllMocks()
    expect(g().tour).toBe(0)
    expect(g().coins).toBe(Math.round(tourPrize(0) * LOSS_SHARE))
    for (let i = 0; i < TOUR_RACES - 1; i++) g().tourResult(true)
    expect(g().tour).toBe(TOUR_RACES - 1)
    expect(g().tourPrize).toBeNull()
    const before = g().coins
    g().tourResult(true)
    expect(g().tour).toBe(TOUR_RACES)
    expect(g().tourPrize).toEqual({ leg: 0, coins: tourLegBonus(0) })
    expect(g().coins).toBe(before + tourPrize(TOUR_RACES - 1) + tourLegBonus(0))
  })
})
