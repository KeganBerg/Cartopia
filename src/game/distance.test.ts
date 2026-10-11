import { describe, expect, it } from 'vitest'
import { CARS, GP_ROUNDS } from './data'
import { AI_BOOST_GEAR, freshRacer, fireBoost, shiftRacer, stepRacer } from './race'
import { DIST, RACE_DISTS, buildOf, character, characterMul, gpDist, tourDist, type RaceDist } from './distance'

// A clean run over a distance by a car of this PI and build.
function run(pi: number, c: number, d: RaceDist) {
  const r = freshRacer()
  let t = 0
  const dt = 1 / 120
  while (r.finished === null && t < 100) {
    t += dt
    if (r.gear < 3 && r.rpm >= 0.9) shiftRacer(r, 1.08)
    if (r.gear >= AI_BOOST_GEAR) fireBoost(r)
    stepRacer(r, pi, dt, t, characterMul(c, r.gear, r.dist), DIST[d].m)
  }
  return r.finished!
}

describe('race distances', () => {
  it('get longer as the races get harder', () => {
    const order = (d: RaceDist) => RACE_DISTS.indexOf(d)
    for (let r = 1; r < GP_ROUNDS; r++) expect(order(gpDist(r))).toBeGreaterThanOrEqual(order(gpDist(r - 1)))
    expect(gpDist(0)).toBe('quarter')
    expect(gpDist(GP_ROUNDS - 1)).toBe('mile')
    for (let r = 1; r < 5; r++) expect(order(tourDist(r))).toBeGreaterThanOrEqual(order(tourDist(r - 1)))
    expect(tourDist(4)).toBe('mile')
    expect(tourDist(5)).toBe('quarter')
  })

  it('a build only ever slows a car, so the quarter-mile floors and GP checks stay safe', () => {
    for (let c = -1; c <= 1; c += 0.25) for (let g = 0; g < 4; g++) for (let d = 0; d <= 2000; d += 100) {
      const m = characterMul(c, g, d)
      expect(m).toBeLessThanOrEqual(1)
      expect(m).toBeGreaterThan(0.5)
    }
  })

  it('sprinters win the quarter mile and long-haulers the mile, at the same PI', () => {
    for (const pi of [30, 70, 140]) {
      expect(run(pi, -1, 'quarter')).toBeLessThan(run(pi, 1, 'quarter'))
      expect(run(pi, 1, 'mile')).toBeLessThan(run(pi, -1, 'mile'))
      // The swing is worth a few PI either way.
      expect(run(pi, -1, 'mile') / run(pi, 1, 'mile')).toBeGreaterThan(1.03)
      expect(run(pi, 1, 'quarter') / run(pi, -1, 'quarter')).toBeGreaterThan(1.02)
    }
  })

  it('the garage has every build', () => {
    const builds = new Set(CARS.map((c) => buildOf(character(c))))
    expect(builds).toEqual(new Set(['sprinter', 'allrounder', 'longhaul']))
  })
})
