import { describe, expect, it } from 'vitest'
import { BUILDINGS, jobXp, playXpMult, raceXp, serviceXp, townXpMult, upgradeXp, xpToNext } from './data'
import { CLASS_XP, GALAXY_XP, MASTERY_XP, masteryXp } from './mastery'

describe('XP for playing', () => {
  it('leaves levels 1-4 alone, so the first ten minutes pace the same', () => {
    for (const l of [1, 2, 3, 4]) {
      expect(raceXp(true, l)).toBe(30)
      expect(raceXp(false, l)).toBe(8)
      expect(serviceXp('gas', l)).toBe(8)
      expect(townXpMult(l)).toBe(1)
    }
    expect(townXpMult(5)).toBe(1)
  })

  it('grows race XP with level, and keeps a loss well under a win', () => {
    expect(raceXp(true, 10)).toBe(100)
    expect(raceXp(true, 20)).toBe(220)
    expect(raceXp(true, 40)).toBe(460)
    for (let l = 1; l <= 60; l++) {
      expect(raceXp(true, l)).toBeGreaterThanOrEqual(raceXp(true, l - 1 || 1))
      expect(raceXp(false, l)).toBeLessThan(raceXp(true, l) / 3)
    }
  })

  it('never lets one race be worth more than 1% of a level past the early game', () => {
    for (let l = 5; l <= 60; l++) expect(raceXp(true, l) / xpToNext(l)).toBeLessThan(0.013)
  })

  it('grows town job XP by 2.5% a level past 5', () => {
    const pizza = BUILDINGS.find((b) => b.id === 'pizza')!
    const tower = BUILDINGS.find((b) => b.id === 'glasstower')!
    expect(jobXp(pizza, 1, 1)).toBe(upgradeXp(pizza, 1))
    expect(townXpMult(25)).toBeCloseTo(1.5)
    expect(jobXp(tower, 1, 25)).toBe(Math.round(upgradeXp(tower, 1) * 1.5))
    expect(playXpMult(20)).toBeCloseTo(220 / 30)
  })

  it('pays mastery steps as a share of the current level', () => {
    expect(masteryXp(20, [0], [], false)).toBe(Math.round(MASTERY_XP[0] * xpToNext(20)))
    expect(masteryXp(20, [0, 1, 2, 3], [1, 2], true)).toBe(Math.round((0.17 + CLASS_XP[0] + CLASS_XP[1] + GALAXY_XP) * xpToNext(20)))
    expect(masteryXp(1, [], [], false)).toBe(0)
  })
})
