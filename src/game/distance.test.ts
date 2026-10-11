import { describe, expect, it } from 'vitest'
import { CARS, GP_ROUNDS } from './data'
import { AI_BOOST_GEAR, aiReaction, freshRacer, fireBoost, launchRacer, shiftRacer, stepRacer, type Racer } from './race'
import { gpBeatTable } from './guardTables'
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

// The server checks a Grand Prix win with gpBeatTable(), worked out over a quarter mile. Over a
// longer race a lower-PI car has less of a chance against a rival, so the table never turns away
// a real win: for each rival, the lowest PI that can beat it over a mile is at least the table's.
describe('the Grand Prix check over a mile', () => {
  const SKILL: ((r: Racer, t: number) => number)[] = [() => 1, (r) => (r.gear === 0 ? 1.2 : 1), (r) => (r.gear === 3 ? 1.15 : 1), () => 1.08, (_, t) => (t < 2.5 ? 1.1 : 1), (r) => (r.gear <= 1 ? 1.1 : 1), (r) => (r.gear === 1 ? 1.1 : 1)]
  const L = DIST.mile.m
  const best = (pi: number) => {
    let b = Infinity
    for (const sk of SKILL) for (const at of [0.9, 0.93]) for (let f = 0; f < 4; f += 0.25) {
      const r = freshRacer()
      let t = 0
      while (r.finished === null && t < 100) { t += 1 / 120; if (r.gear < 3 && r.rpm >= at) shiftRacer(r, 1.08); if (t >= f) fireBoost(r); stepRacer(r, pi, 1 / 120, t, sk(r, t), L) }
      b = Math.min(b, r.finished!)
    }
    return b * 0.975
  }
  const slowest = (pi: number) => {
    let w = 0
    for (const drag of [() => 1, (_: Racer, t: number) => (t < 2.5 ? 0.9 : 1), (r: Racer) => (r.gear === 1 ? 0.9 : 1)]) for (let at = 0.8; at <= 0.92 + 1e-9; at += 0.04) {
      const r = freshRacer(false)
      const re = aiReaction(1, 1)
      let t = 0
      while (r.finished === null && t < 100) { t += 1 / 120; if (!r.launched && t >= re) launchRacer(r, re); if (r.launched && r.gear < 3 && r.rpm >= at) shiftRacer(r, 1.08); if (r.gear >= AI_BOOST_GEAR) fireBoost(r); stepRacer(r, pi, 1 / 120, t, drag(r, t), L) }
      w = Math.max(w, r.finished!)
    }
    return w * 1.03
  }
  it('needs at least the quarter-mile PI', () => {
    const table = gpBeatTable()
    for (const rival of [37, 71, 110]) {
      const need = table[rival - 1]
      // One PI under the table's answer can't win the mile either.
      expect(best(need - 1)).toBeGreaterThanOrEqual(slowest(rival))
    }
  }, 120000)
})
