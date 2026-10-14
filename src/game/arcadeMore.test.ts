import { describe, expect, it } from 'vitest'
import {
  BLOCK, GRID, STREET, TOWN, blockCentre, brakeDistance, dashStars, flips, gunTimes, insideBlock, jumpLength, jumpScore, kerbSpot,
  landed, pitCall, pitStars, stopGrade, stopPenalty, starReward, stuntStars, washStars, scrubNeed, washBonus,
} from './arcadeMore'
import { chaseReward } from './arcade'

describe('arcade second wave', () => {
  it('pays by stars, never more than a capped chase run', () => {
    expect(starReward(0, 10)).toEqual({ coins: 0, xp: 0 })
    for (const lvl of [1, 10, 40]) {
      const one = starReward(1, lvl), three = starReward(3, lvl)
      expect(three.coins).toBeGreaterThan(one.coins)
      expect(three.coins).toBeLessThanOrEqual(chaseReward(1e9, lvl).coins)
      expect(three.coins % 5).toBe(0)
    }
  })

  it('pit stop: stopping on the marks is free, sloppy stops cost, faster is better', () => {
    let seed = 3
    const times = gunTimes(() => ((seed = (seed * 16807) % 2147483647) / 2147483647))
    expect(times).toHaveLength(4)
    for (const t of times.flat()) {
      expect(t).toBeGreaterThanOrEqual(0.5)
      expect(t).toBeLessThanOrEqual(0.95)
    }
    expect(brakeDistance(8)).toBeCloseTo(64 / 24)
    expect([stopGrade(0.1), stopGrade(-0.4), stopGrade(-1), stopGrade(1.2)]).toEqual(['perfect', 'good', 'short', 'long'])
    expect(stopPenalty(0.4)).toBe(0)
    expect(stopPenalty(2)).toBeGreaterThan(stopPenalty(1))
    expect(stopPenalty(50)).toBe(2.5)
    expect([pitStars(8), pitStars(10), pitStars(30)]).toEqual([3, 2, 1])
    let r = 7
    expect([...pitCall(() => ((r = (r * 16807) % 2147483647) / 2147483647))].sort()).toEqual([0, 1, 2, 3])
  })

  it('car wash: all spots with time to spare for three stars', () => {
    expect(washStars(10)).toBe(3)
    expect(washStars(6)).toBe(2)
    expect(washStars(3)).toBe(1)
    expect(washStars(2)).toBe(0)
    // Later cars need more scrubbing and give less time back, so a run always ends.
    expect(scrubNeed(8)).toBeGreaterThan(scrubNeed(0))
    expect(washBonus(12, true)).toBeLessThan(washBonus(0, false))
  })

  it('delivery: kerb spots are on the road, blocks are solid', () => {
    expect(TOWN).toBe(GRID * (BLOCK + STREET) + STREET)
    for (let bx = 0; bx < GRID; bx++) for (let side = 0; side < 4; side++) {
      const [x, z] = kerbSpot(bx, 1, side)
      expect(insideBlock(x, z, 0.4)).toBe(false)
    }
    expect(insideBlock(blockCentre(2), blockCentre(1), 0)).toBe(true)
    expect(insideBlock(TOWN, 0, 0)).toBe(true)
    expect([dashStars(1), dashStars(2), dashStars(4), dashStars(7)]).toEqual([0, 1, 2, 3])
  })

  it('stunt: more power flies further, flat landings and flips score', () => {
    expect(jumpLength(1)).toBeGreaterThan(jumpLength(0.5))
    expect(landed(0)).toBe(true)
    expect(landed(Math.PI)).toBe(false)
    expect(landed(Math.PI * 2 + 0.2)).toBe(true)
    expect(flips(Math.PI * 2 - 0.3)).toBe(1)
    expect(flips(1)).toBe(0)
    expect(jumpScore(10, Math.PI)).toBe(0)
    expect(jumpScore(10, Math.PI * 2)).toBe(250)
    expect(jumpScore(10, 0, Math.PI)).toBe(0)
    // A flip and a roll in one jump pay half again, and the target adds on top.
    expect(jumpScore(10, Math.PI * 2, Math.PI * 2, true)).toBe(100 + 270 * 1.5 + 250)
    // Four big jumps with a flip and a roll each on target earn three stars; plain flips don't.
    expect(stuntStars(4 * jumpScore(jumpLength(1), Math.PI * 2, Math.PI * 2, true))).toBe(3)
    expect(stuntStars(4 * jumpScore(jumpLength(1), Math.PI * 2))).toBe(2)
    expect(stuntStars(100)).toBe(0)
  })
})
