// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './store'
import { boostsSpent } from './boosts'
import { DAILY_CARS, DAILY_PAY, dailyDay, dailyMedal, dailyRun, dailyShare } from './daily'

const g = () => useGame.getState()
const MON = Date.UTC(2026, 9, 12, 12)
afterEach(() => vi.restoreAllMocks())

describe('Daily Run', () => {
  it('is the same for everyone on a day and changes day to day', () => {
    const a = dailyRun('2026-10-12')
    const b = dailyRun('2026-10-12')
    expect(a.car.id).toBe(b.car.id)
    expect(a.venue.id).toBe(b.venue.id)
    expect(a.color).toBe(b.color)
    const week = Array.from({ length: 7 }, (_, i) => dailyRun(`2026-10-${13 + i}`).car.id + dailyRun(`2026-10-${13 + i}`).venue.id)
    expect(new Set(week).size).toBeGreaterThan(3)
    expect(DAILY_CARS.every((c) => !c.bucks && !c.parked)).toBe(true)
  })
  it('gives medals faster than par', () => {
    const r = dailyRun('2026-10-12')
    expect(r.medals[0]).toBeLessThan(r.medals[1])
    expect(r.medals[2]).toBe(r.par)
    expect(dailyMedal(r, r.medals[0])).toBe(0)
    expect(dailyMedal(r, r.par + 0.01)).toBe(3)
    expect(dailyShare(r, r.medals[0])).toContain('🥇')
  })
  it('pays the first run of the day only, and keeps the best', () => {
    vi.spyOn(Date, 'now').mockReturnValue(MON)
    useGame.setState({ coins: 0, daily: undefined, boosts: boostsSpent(MON), levelUp: null })
    const r = dailyRun()
    g().dailyResult(r.par + 1)
    expect(g().coins).toBe(DAILY_PAY[3])
    expect(g().daily).toEqual({ day: dailyDay(), best: r.par + 1, paid: true })
    g().dailyResult(r.medals[0])
    expect(g().coins).toBe(DAILY_PAY[3])
    expect(g().daily?.best).toBe(r.medals[0])
    g().dailyResult(r.par)
    expect(g().daily?.best).toBe(r.medals[0])
  })
})
