// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './store'
import { SEASON_DAYS, seasonNumber } from './data'
import { buildRecap, recapShare, seasonSnapshot, startRecapWatch } from './recap'

const stats = (races: number, racesWon: number) => ({ ...useGame.getState().stats, races, racesWon, coinsEarned: races * 100, carsBought: 0 })

describe('season recap', () => {
  afterEach(() => vi.restoreAllMocks())
  it('sums up what changed over the season, and skips a season with nothing played', () => {
    const start = { trophies: 10, stats: stats(5, 2), cups: {}, mastery: {}, season: null }
    const base = seasonSnapshot(start, 3)
    expect(buildRecap(base, start)).toBeNull()
    const r = buildRecap(base, { ...start, trophies: 40, stats: stats(25, 12), season: { n: 3, stars: 20, claimed: [0, 1] } })!
    expect(r).toMatchObject({ n: 3, races: 20, wins: 10, trophies: 30, coins: 2000, stars: 20, tiers: 2 })
    expect(recapShare(r)).toContain('20 races')
  })
  it('queues a recap once the season rolls over, and only then', () => {
    const t0 = Date.UTC(2026, 9, 13, 12)
    const spy = vi.spyOn(Date, 'now').mockReturnValue(t0)
    useGame.setState({ trophies: 0, stats: stats(0, 0), season: null, seasonBase: undefined, recap: null })
    const stop = startRecapWatch()
    expect(useGame.getState().seasonBase?.n).toBe(seasonNumber(t0))
    expect(useGame.getState().recap).toBeNull()
    useGame.setState({ trophies: 5, stats: stats(3, 1) })
    expect(useGame.getState().recap).toBeNull()
    stop()
    spy.mockReturnValue(t0 + SEASON_DAYS * 86400000)
    const stop2 = startRecapWatch()
    expect(useGame.getState().recap).toMatchObject({ n: seasonNumber(t0), races: 3, wins: 1, trophies: 5 })
    expect(useGame.getState().seasonBase?.n).toBe(seasonNumber(t0) + 1)
    useGame.getState().closeRecap()
    expect(useGame.getState().recap).toBeNull()
    stop2()
  })
})
