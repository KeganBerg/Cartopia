// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { LOSS_SHARE, boostsSpent } from './boosts'
import { RIVALS, RIVAL_VISITS, RIVAL_BACK_MS, currentRival, rivalLadderPi, rivalPi, rivalShift } from './rivals'
import { visitorPiFactor } from '../lib/visitors'
import { CAMPAIGN, GP_SERIES } from './data'
import { isCleanName } from '../lib/names'
import { useGame } from './store'

describe('town rivals', () => {
  it('have unique, clean names that no campaign or Grand Prix racer uses', () => {
    const others = new Set([...CAMPAIGN.flatMap((c) => c.rivals), ...GP_SERIES.flatMap((s) => s.rivals)])
    expect(new Set(RIVALS.map((r) => r.id)).size).toBe(RIVALS.length)
    for (const r of RIVALS) {
      expect(isCleanName(r.name), r.name).toBe(true)
      expect(others.has(r.name), r.name).toBe(false)
      for (const line of Object.values(r.lines).flat()) expect(line.length, line).toBeLessThanOrEqual(60)
    }
  })

  it('arrive in PI order and get tougher each visit', () => {
    for (let i = 1; i < RIVALS.length; i++) expect(RIVALS[i].pi[0]).toBeGreaterThan(RIVALS[i - 1].pi[1])
    for (const r of RIVALS) {
      for (let v = 1; v < RIVAL_VISITS; v++) {
        expect(rivalPi(r, v)).toBeGreaterThan(rivalPi(r, v - 1))
        expect(rivalShift(r, v)).toBeGreaterThan(rivalShift(r, v - 1))
      }
      expect(rivalShift(r, RIVAL_VISITS - 1)).toBeLessThanOrEqual(1)
      expect(rivalPi(r, RIVAL_VISITS - 1)).toBe(r.pi[1])
    }
  })

  it('race a car within a few percent of yours, still getting quicker each visit', () => {
    for (const r of RIVALS) {
      for (const my of [20, 40, 60, 80, 100, 130]) {
        for (let v = 0; v < RIVAL_VISITS; v++) {
          const pi = rivalPi(r, v, my)
          expect(pi).toBeLessThanOrEqual(rivalLadderPi(r, v))
          if (pi < rivalLadderPi(r, v)) expect(Math.abs(pi - my)).toBeLessThanOrEqual(Math.ceil(my * 0.04))
          if (v > 0) expect(pi).toBeGreaterThanOrEqual(rivalPi(r, v - 1, my))
        }
      }
    }
    expect(rivalPi(RIVALS[2], 0, 30)).toBe(29) // Duke used to bring 48 to a PI 30 car
  })

  it('send street racers within 5% of your best car, one in five up to 10% quicker', () => {
    for (let i = 0; i <= 10; i++) {
      const f = visitorPiFactor(0.5, i / 10)
      expect(f).toBeGreaterThanOrEqual(0.95)
      expect(f).toBeLessThanOrEqual(1.05)
      const tough = visitorPiFactor(0.1, i / 10)
      expect(tough).toBeGreaterThanOrEqual(1.05)
      expect(tough).toBeLessThanOrEqual(1.1)
    }
  })

  it('takes turns: the next rival comes once the last one quits', () => {
    expect(currentRival(1, {}, 0)).toMatchObject({ def: RIVALS[0], visit: 0, locked: true })
    expect(currentRival(5, { vinnie: { beaten: 1, back: 100 } }, 50)).toMatchObject({ def: RIVALS[0], visit: 1, away: 100 })
    expect(currentRival(5, { vinnie: { beaten: 3 } }, 0)).toMatchObject({ def: RIVALS[1], visit: 0, locked: false, away: 0 })
    expect(currentRival(99, Object.fromEntries(RIVALS.map((r) => [r.id, { beaten: 3 }])), 0)).toBeNull()
  })

  it('never waits on a level once rivals have started', () => {
    const last = RIVALS[RIVALS.length - 1]
    const beatenAllBut = Object.fromEntries(RIVALS.filter((r) => r !== last).map((r) => [r.id, { beaten: 3 }]))
    expect(currentRival(2, beatenAllBut, 0)).toMatchObject({ def: last, locked: false })
  })

  it('pay the race, send the rival away, and pay the bonus once on the third win', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 12, 12))
    useGame.setState({ level: 5, xp: 0, coins: 0, bucks: 0, trophies: 0, rivals: {}, levelUp: null, boosts: boostsSpent(Date.UTC(2026, 9, 12, 12)) })
    const g = () => useGame.getState()
    expect(g().rivalResult('vinnie', false, 500)).toBeNull()
    expect(g().coins).toBe(500 * LOSS_SHARE)
    expect(g().rivals.vinnie).toBeUndefined()
    const t = Date.now()
    expect(g().rivalResult('vinnie', true, 500)).toBeNull()
    expect(g().rivals.vinnie.beaten).toBe(1)
    expect(g().rivals.vinnie.back).toBeGreaterThanOrEqual(t + RIVAL_BACK_MS)
    g().rivalResult('vinnie', true, 500)
    useGame.setState((s) => ({ boosts: s.boosts && { ...s.boosts, streak: 0 } })) // no win-streak bonus on the payout checked
    const coins = g().coins
    expect(g().rivalResult('vinnie', true, 500)).toEqual({ coins: 1500, bucks: 1, trophies: 3 })
    expect(g().coins).toBe(coins + 500 + 1500)
    expect(g().bucks).toBe(1)
    expect(g().rivals.vinnie).toEqual({ beaten: 3 })
    // Never pays twice.
    expect(g().rivalResult('vinnie', true, 500)).toBeNull()
    expect(g().bucks).toBe(1)
    vi.restoreAllMocks()
  })

  it('settle double or nothing both ways', () => {
    useGame.setState({ coins: 1000, racesWon: 0 })
    useGame.getState().rivalBet(true, 400)
    expect(useGame.getState().coins).toBe(1400)
    expect(useGame.getState().racesWon).toBe(1)
    useGame.getState().rivalBet(false, 400)
    expect(useGame.getState().coins).toBe(1000)
    useGame.setState({ coins: 100 })
    useGame.getState().rivalBet(false, 400)
    expect(useGame.getState().coins).toBe(0)
  })
})
