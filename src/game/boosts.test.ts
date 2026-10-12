import { describe, expect, it } from 'vitest'
import { BOOST_CAP, LIVE_LOSS_SHARE, LOSS_SHARE, STREAK_MAX, WELCOME_AWAY_MS, WELCOME_RACES, boostFor, boostLabel, boostsSpent, emptyBoosts, isWeekend, placeShare, welcomeBack } from './boosts'

const MON = Date.UTC(2026, 9, 12, 12)
const SAT = Date.UTC(2026, 9, 17, 12)

describe('race boosts', () => {
  it('doubles the first win of the day in each mode, once', () => {
    const a = boostFor(emptyBoosts(), 'race', true, MON)
    expect(a.mult).toBe(2)
    // (Without the win streak, tested below.)
    const next = { ...a.next, streak: 0 }
    expect(boostFor(next, 'race', true, MON).mult).toBe(1)
    // Karts and the arcade have their own first win.
    expect(boostFor(next, 'kart', true, MON).mult).toBe(2)
    // The next day it's back.
    expect(boostFor(next, 'race', true, MON + 86400_000).mult).toBe(2)
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

describe('loss pay and the win streak', () => {
  it('pays first place in full and a 1v1 loss only the floor', () => {
    expect(placeShare(1, 2)).toBe(1)
    expect(placeShare(2, 2)).toBe(LOSS_SHARE)
    expect(placeShare(2, 2, true)).toBe(LIVE_LOSS_SHARE)
    expect(LOSS_SHARE).toBeLessThan(0.25)
  })
  it('pays the top of a 12-car field well, falling to the floor at the back', () => {
    expect(placeShare(2, 12)).toBeCloseTo(0.6)
    expect(placeShare(3, 12)).toBeLessThan(placeShare(2, 12))
    expect(placeShare(12, 12)).toBe(LOSS_SHARE)
    for (let p = 2; p <= 12; p++) expect(placeShare(p, 12)).toBeGreaterThanOrEqual(LOSS_SHARE)
  })
  it('adds a little per win in a row, capped, and a loss resets it', () => {
    let b = boostsSpent(MON)
    const mults: number[] = []
    for (let i = 0; i < 8; i++) {
      const x = boostFor(b, 'race', true, MON)
      mults.push(x.mult)
      b = x.next
    }
    expect(mults[0]).toBe(1)
    expect(mults[1]).toBeCloseTo(1.1)
    expect(mults[7]).toBeCloseTo(1 + STREAK_MAX)
    expect(boostLabel(boostFor(b, 'race', true, MON))).toContain('wins in a row')
    b = boostFor(b, 'race', false, MON).next
    expect(b.streak).toBe(0)
  })
  it('leaves the streak alone in arcade games', () => {
    const b = { ...boostsSpent(MON), streak: 3 }
    expect(boostFor(b, 'arcade', false, MON).next.streak).toBe(3)
    expect(boostFor(b, 'arcade', true, MON).mult).toBe(1)
  })
})
