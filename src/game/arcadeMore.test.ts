import { describe, expect, it } from 'vitest'
import {
  BLOCK, FUEL_BAND, GRID, STREET, TOWN, blockCentre, dashStars, flips, fuelOk, insideBlock, jumpLength, jumpScore, kerbSpot,
  landed, pitOrder, pitStars, starReward, stuntStars, washStars,
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

  it('pit stop: every wheel once, fuel in the band, faster is better', () => {
    let seed = 3
    const order = pitOrder(() => ((seed = (seed * 16807) % 2147483647) / 2147483647))
    expect([...order].sort()).toEqual([0, 1, 2, 3])
    expect(fuelOk((FUEL_BAND[0] + FUEL_BAND[1]) / 2)).toBe(true)
    expect(fuelOk(FUEL_BAND[0] - 0.01)).toBe(false)
    expect(fuelOk(1)).toBe(false)
    expect([pitStars(5), pitStars(9), pitStars(30)]).toEqual([3, 2, 1])
  })

  it('car wash: all spots with time to spare for three stars', () => {
    expect(washStars(12, 12, 10)).toBe(3)
    expect(washStars(12, 12, 4)).toBe(2)
    expect(washStars(12, 12, 0)).toBe(1)
    expect(washStars(9, 12, 0)).toBe(1)
    expect(washStars(5, 12, 0)).toBe(0)
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
    // Three max-power jumps with a flip each earn three stars.
    expect(stuntStars(3 * jumpScore(jumpLength(1), Math.PI * 2))).toBe(3)
    expect(stuntStars(100)).toBe(0)
  })
})
