import { describe, expect, it } from 'vitest'
import { CARS, SKILLS, type CarDef, type SkillId } from './data'
import { DIST } from './distance'
import { buildPi, fairMargin, fairRivalPi } from './fairPi'
import { perfectDuel, rng } from './raceSim'
import { tourPrize, tourRivalPi } from './tour'

// A plain car on both sides, so only PI, shifting and the rival's skill decide it.
const plain = { ...CARS[0], grip: 50, skill: undefined } as CarDef

function winRate(myPi: number, rivalPi: number, cleanness: number, skill: SkillId | undefined, boostGear: number) {
  const roll = rng(31 + myPi)
  let wins = 0
  for (let k = 0; k < 40; k++) if (perfectDuel(plain, myPi, 'main', rivalPi, plain, cleanness, skill, boostGear, roll)) wins++
  return wins / 40
}

describe('fair AI rivals', () => {
  it('keeps the ladder PI when the car can beat it, and never goes above it', () => {
    expect(fairRivalPi(40, 90, 1)).toBe(40)
    expect(fairRivalPi(120, 60, 1)).toBeLessThan(120)
    expect(fairRivalPi(120, 60, 0)).toBeGreaterThan(60)
  })

  it('eases clean rivals and strong skills more', () => {
    expect(fairMargin(1)).toBeLessThan(fairMargin(0))
    expect(fairMargin(1, 'slipstream')).toBeLessThan(fairMargin(1))
  })

  it('a perfect drive beats every capped rival, whatever its skill and shifting', () => {
    const misses: string[] = []
    for (const skill of [undefined, ...(Object.keys(SKILLS) as SkillId[])])
      for (let n = 0; n <= 8; n++)
        for (const my of [30, 60, 100]) {
          const c = n / 8 + (n < 8 ? 0.06 : 0)
          const rp = fairRivalPi(999, my, c, skill)
          // Boost in fourth nearly always wins; boost fired early still wins most races.
          if (winRate(my, rp, c, skill, 3) < 0.85 || winRate(my, rp, c, skill, 1) < 0.7) misses.push(`${skill ?? 'none'} at ${c} with PI ${my} vs ${rp}`)
        }
    expect(misses).toEqual([])
  }, 60000)

  it('counts a build over a set distance: sprinters in a mile, long-haulers off the line', () => {
    const misses: string[] = []
    for (const build of [-1, 0, 1]) for (const d of ['quarter', 'mile'] as const) for (const c of [0.5, 1]) for (const skill of [undefined, 'slipstream'] as const) {
      const track = DIST[d].m
      const my = 70
      const rp = fairRivalPi(999, buildPi(my, build, track), c, skill)
      const roll = rng(5)
      let wins = 0
      for (let k = 0; k < 30; k++) if (perfectDuel(plain, my, 'main', rp, plain, c, skill, 3, roll, build, track)) wins++
      if (wins / 30 < 0.85) misses.push(`build ${build} ${d} at ${c} ${skill ?? 'none'}: ${wins}/30`)
    }
    expect(misses).toEqual([])
    expect(buildPi(70, -1, DIST.mile.m)).toBeLessThan(70)
  }, 60000)

  it('pays a Pro Tour race at the PI raced, never above the ladder', () => {
    expect(tourPrize(40, 50)).toBeLessThan(tourPrize(40))
    expect(tourPrize(40, 999)).toBe(tourPrize(40))
    expect(tourPrize(40, tourRivalPi(40))).toBe(tourPrize(40))
  })
})
