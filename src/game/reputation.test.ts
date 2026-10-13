// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { useGame } from './store'
import { REP_POINTS, REP_TITLES, repScore, repTier, reputation, startRepWatch } from './reputation'

const blank = { trophies: 0, stats: {}, cups: {}, mastery: {} }

describe('reputation', () => {
  it('adds up progress that never goes down', () => {
    expect(repScore(blank)).toBe(0)
    expect(repScore({ ...blank, trophies: 2, stats: { races: 3, racesWon: 1 } })).toBe(2 * REP_POINTS.trophy + 3 * REP_POINTS.race + REP_POINTS.win)
    expect(repScore({ ...blank, cups: { 'compact-1': 2, 'compact-2': 0 } })).toBe(REP_POINTS.cupRace)
    expect(repScore({ ...blank, mastery: { pip: { races: 10, wins: 0, modes: [], upsets: 0, tier: 2 } } })).toBe(2 * REP_POINTS.masteryStep)
  })
  it('has titles in rising order, with progress to the next', () => {
    for (let i = 1; i < REP_TITLES.length; i++) expect(REP_TITLES[i].at).toBeGreaterThan(REP_TITLES[i - 1].at)
    expect(repTier(0)).toBe(0)
    expect(repTier(REP_TITLES[2].at)).toBe(2)
    expect(repTier(1e9)).toBe(REP_TITLES.length - 1)
    const r = reputation({ ...blank, trophies: 30 })
    expect(r.title.name).toBe('Rookie')
    expect(r.toNext).toBe(REP_TITLES[1].at - 150)
  })
  it('announces a new title once, but takes the first one silently', () => {
    const toast = vi.fn()
    useGame.setState({ trophies: 0, stats: { ...useGame.getState().stats, races: 0, racesWon: 0, campaignWins: 0, gpWins: 0 }, cups: {}, mastery: {}, repSeen: undefined, toast })
    const stop = startRepWatch()
    expect(useGame.getState().repSeen).toBe(0)
    expect(toast).not.toHaveBeenCalled()
    useGame.setState({ trophies: 60 })
    expect(useGame.getState().repSeen).toBe(1)
    expect(toast).toHaveBeenCalledTimes(1)
    useGame.setState({ trophies: 61 })
    expect(toast).toHaveBeenCalledTimes(1)
    stop()
  })
})
