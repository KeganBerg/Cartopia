import { describe, expect, it } from 'vitest'
import { BOOST_CAP, WELCOME_AWAY_MS, WELCOME_RACES, boostFor, boostLabel, boostsSpent, emptyBoosts, isWeekend, welcomeBack } from './boosts'

const MON = Date.UTC(2026, 9, 12, 12)
const SAT = Date.UTC(2026, 9, 17, 12)

describe('race boosts', () => {
  it('doubles the first win of the day in each mode, once', () => {
    const a = boostFor(emptyBoosts(), 'race', true, MON)
    expect(a.mult).toBe(2)
    expect(boostFor(a.next, 'race', true, MON).mult).toBe(1)
    // Karts and the arcade have their own first win.
    expect(boostFor(a.next, 'kart', true, MON).mult).toBe(2)
    // The next day it's back.
    expect(boostFor(a.next, 'race', true, MON + 86400_000).mult).toBe(2)
  })

  it('never spends the first win on a loss', () => {
    const lost = boostFor(emptyBoosts(), 'race', false, MON)
    expect(lost.mult).toBe(1)
    expect(boostFor(lost.next, 'race', true, MON).firstWin).toBe(true)
  })

  it('gives welcome-back pay for a set number of payouts after two days away', () => {
    expect(welcomeBack(emptyBoosts(), WELCOME_AWAY_MS - 1).welcome).toBe(0)
    let b = welcomeBack(boostsSpent(MON), WELCOME_AWAY_MS)
    for (let i = 0; i < WELCOME_RACES; i++) {
      const x = boostFor(b, 'race', false, MON)
      expect(x.mult).toBe(2)
      b = x.next
    }
    expect(boostFor(b, 'race', false, MON).mult).toBe(1)
  })

  it('adds the weekend boost, adds rather than multiplies, and caps the total', () => {
    expect(isWeekend(MON)).toBe(false)
    expect(isWeekend(SAT)).toBe(true)
    const all = boostFor(welcomeBack(emptyBoosts(), WELCOME_AWAY_MS), 'race', true, SAT)
    expect(all.mult).toBe(BOOST_CAP)
    expect(boostLabel(all)).toBe('×2.5 first win, welcome back, weekend')
    expect(boostFor(boostsSpent(SAT), 'race', false, SAT).mult).toBe(1.5)
  })

  it('spends nothing on a payout of nothing', () => {
    const b = welcomeBack(emptyBoosts(), WELCOME_AWAY_MS)
    const x = boostFor(b, 'arcade', false, MON, false)
    expect(x.mult).toBe(1)
    expect(x.next).toEqual(b)
  })
})
