// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { RIVALS, RIVAL_VISITS, RIVAL_BACK_MS, currentRival, rivalPi, rivalShift } from './rivals'
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

  it('arrive in level order and get tougher each visit', () => {
    for (let i = 1; i < RIVALS.length; i++) expect(RIVALS[i].unlockLevel).toBeGreaterThan(RIVALS[i - 1].unlockLevel)
    for (const r of RIVALS) {
      for (let v = 1; v < RIVAL_VISITS; v++) {
        expect(rivalPi(r, v)).toBeGreaterThan(rivalPi(r, v - 1))
        expect(rivalShift(r, v)).toBeGreaterThan(rivalShift(r, v - 1))
      }
      expect(rivalShift(r, RIVAL_VISITS - 1)).toBeLessThanOrEqual(1)
      expect(rivalPi(r, RIVAL_VISITS - 1)).toBe(r.pi[1])
    }
  })

  it('takes turns: the next rival comes once the last one quits', () => {
    expect(currentRival(1, {}, 0)).toMatchObject({ def: RIVALS[0], visit: 0, locked: true })
    expect(currentRival(5, { vinnie: { beaten: 1, back: 100 } }, 50)).toMatchObject({ def: RIVALS[0], visit: 1, away: 100 })
    expect(currentRival(5, { vinnie: { beaten: 3 } }, 0)).toMatchObject({ def: RIVALS[1], visit: 0, locked: false, away: 0 })
    expect(currentRival(99, Object.fromEntries(RIVALS.map((r) => [r.id, { beaten: 3 }])), 0)).toBeNull()
  })

  it('pay the race, send the rival away, and pay the bonus once on the third win', () => {
    useGame.setState({ level: 5, xp: 0, coins: 0, bucks: 0, trophies: 0, rivals: {}, levelUp: null })
    const g = () => useGame.getState()
    expect(g().rivalResult('vinnie', false, 500)).toBeNull()
    expect(g().coins).toBe(50)
    expect(g().rivals.vinnie).toBeUndefined()
    const t = Date.now()
    expect(g().rivalResult('vinnie', true, 500)).toBeNull()
    expect(g().rivals.vinnie.beaten).toBe(1)
    expect(g().rivals.vinnie.back).toBeGreaterThanOrEqual(t + RIVAL_BACK_MS)
    g().rivalResult('vinnie', true, 500)
    const coins = g().coins
    expect(g().rivalResult('vinnie', true, 500)).toEqual({ coins: 1500, bucks: 1, trophies: 3 })
    expect(g().coins).toBe(coins + 500 + 1500)
    expect(g().bucks).toBe(1)
    expect(g().rivals.vinnie).toEqual({ beaten: 3 })
    // Never pays twice.
    expect(g().rivalResult('vinnie', true, 500)).toBeNull()
    expect(g().bucks).toBe(1)
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
