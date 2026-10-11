// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { MOD_SKINS, SKINS, ownedSkins } from './data'
import { useGame } from './store'
import { isCleanName } from '../lib/names'
import { trialVenue, trialWeek } from './trial'
import { VENUES } from '../scene/venues'
import { EVENT_RACES, WEEKLY_EVENTS, eventBonus, eventFor, eventIsBoss, eventPrize, eventProgress, eventRivalPi, nextEventWeek, weeksUntil } from './events'

const week = (i: number) => new Date(Date.UTC(2026, 9, 5) + i * 7 * 86400000).toISOString().slice(0, 10)

describe('weekly events', () => {
  it('runs a different event every week and never on the time trial venue', () => {
    for (let i = 0; i < 30; i++) {
      expect(eventFor(week(i)).id).not.toBe(eventFor(week(i + 1)).id)
      expect(eventFor(week(i)).venue).not.toBe(trialVenue(week(i)).id)
    }
    expect(new Set(WEEKLY_EVENTS.map((e) => e.venue)).size).toBe(VENUES.length)
    expect(eventFor(nextEventWeek())).toBe(eventFor(week(Math.round((Date.parse(trialWeek()) - Date.UTC(2026, 9, 5)) / 6048e5) + 1)))
    expect(weeksUntil(eventFor().id)).toBe(0)
  })

  it('gives each event its own exclusive skin that is never sold', () => {
    expect(new Set(WEEKLY_EVENTS.map((e) => e.skin)).size).toBe(WEEKLY_EVENTS.length)
    for (const e of WEEKLY_EVENTS) {
      const d = SKINS.find((s) => s.id === e.skin)!
      expect(d.unlock).toEqual({ event: e.id })
      // Not unlocked by level or sets, so only the event gives it.
      expect(ownedSkins({ level: 999, claimedSets: ['daily', 'muscle', 'roadtrip', 'heavy'] })).not.toContain(d.id)
    }
    const ns = [...SKINS, ...MOD_SKINS].map((s) => s.n)
    for (const e of WEEKLY_EVENTS) expect(ns.filter((n) => n === SKINS.find((s) => s.id === e.skin)!.n).length).toBe(1)
  })

  it('keeps clean rival names and climbs to a boss', () => {
    for (const e of WEEKLY_EVENTS) {
      expect(e.rivals.length).toBe(EVENT_RACES)
      for (const r of e.rivals) expect(isCleanName(r), r).toBe(true)
    }
    for (let i = 1; i < EVENT_RACES; i++) expect(eventRivalPi(80, i)).toBeGreaterThan(eventRivalPi(80, i - 1))
    expect(eventIsBoss(EVENT_RACES - 1)).toBe(true)
    expect(eventRivalPi(80, EVENT_RACES - 1)).toBeGreaterThan(80)
    expect(eventRivalPi(5, 0)).toBeGreaterThanOrEqual(20)
  })

  it('pays race coins, then the skin and bonus for the boss, once a week', () => {
    const e = eventFor()
    useGame.setState({ level: 10, xp: 0, coins: 0, trophies: 0, event: null, eventPrize: null, skins: [], levelUp: null })
    const g = () => useGame.getState()
    g().eventResult(true)
    expect(g().coins).toBe(0) // not entered yet
    g().eventEnter(90)
    g().eventEnter(150) // entering again keeps the first PI
    expect(eventProgress(g().event)).toEqual({ week: trialWeek(), pi: 90, won: 0 })
    g().eventResult(false)
    expect(eventProgress(g().event)!.won).toBe(0)
    for (let i = 0; i < EVENT_RACES - 1; i++) g().eventResult(true)
    expect(g().eventPrize).toBeNull()
    const before = g().coins
    g().eventResult(true)
    expect(g().skins).toContain(e.skin)
    expect(g().eventPrize).toEqual({ id: e.id, skin: e.skin, coins: eventBonus(90) })
    expect(g().coins).toBe(before + eventPrize(90, EVENT_RACES - 1) + eventBonus(90))
    // Cleared: no more races this week.
    const after = g().coins
    g().eventResult(true)
    expect(g().coins).toBe(after)
  })

  it('pays a double bonus when the skin is already owned, and starts fresh next week', () => {
    const e = eventFor()
    useGame.setState({ level: 10, xp: 0, coins: 0, event: { week: trialWeek(), pi: 60, won: EVENT_RACES - 1 }, eventPrize: null, skins: [e.skin], levelUp: null })
    useGame.getState().eventResult(true)
    expect(useGame.getState().eventPrize).toEqual({ id: e.id, skin: null, coins: eventBonus(60) * 2 })
    expect(eventProgress({ week: '2020-01-06', pi: 60, won: 5 })).toBeNull()
  })
})
