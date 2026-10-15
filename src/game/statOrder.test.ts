import { describe, expect, it } from 'vitest'
import { CARS, MODS, MOD_SLOTS, MAX_UPGRADE, UPGRADE_SLOTS, carLevel, modFits, performance, type CarDef, type ModDef, type UpgradeSlot } from './data'
import { DIST, RACE_DISTS, characterMul, raceCharacter, type RaceDist } from './distance'
import { AI_BOOST_GEAR, TOP_GEAR, fireBoost, freshRacer, shiftRacer, stepRacer } from './race'
import { gemCoins } from './bucksPacks'
import { engineProfile } from '../lib/engineAudio'

// A step up is never a step down: a bigger engine, a pricier part or another Garage upgrade
// never leaves a car with less power, less PI or a slower race.

const run = (pi: number, c: number, d: RaceDist) => {
  const r = freshRacer()
  const dt = 1 / 120
  let t = 0
  while (r.finished === null && t < 100) {
    t += dt
    if (r.gear < TOP_GEAR && r.rpm >= 0.9) shiftRacer(r, 1.08)
    if (r.gear >= AI_BOOST_GEAR) fireBoost(r)
    stepRacer(r, pi, dt, t, characterMul(c, r.gear, r.dist), DIST[d].m)
  }
  return r.finished!
}
const tuned = (n: number): Record<UpgradeSlot, number> => ({ engine: n, turbo: n, tires: n, weight: n })

describe('Garage upgrades', () => {
  it('never lower PI or slow a race at any distance', () => {
    const times = new Map<string, number>()
    const time = (car: CarDef, up: Record<UpgradeSlot, number>, d: RaceDist) => {
      const pi = performance(car, up)
      const c = raceCharacter(car)
      const k = `${pi}:${c}:${d}`
      if (!times.has(k)) times.set(k, run(pi, c, d))
      return times.get(k)!
    }
    for (const car of CARS) for (const rest of [0, MAX_UPGRADE]) for (const s of UPGRADE_SLOTS) for (let lvl = 0; lvl < MAX_UPGRADE; lvl++) {
      const a = { ...tuned(rest), [s.id]: lvl }
      const b = { ...a, [s.id]: lvl + 1 }
      expect(performance(car, b), `${car.id} ${s.id} ${lvl + 1}`).toBeGreaterThanOrEqual(performance(car, a))
      for (const d of RACE_DISTS) expect(time(car, b, d), `${car.id} ${s.id} ${lvl + 1} ${d}`).toBeLessThanOrEqual(time(car, a, d))
    }
  })
})

describe('car mods', () => {
  // What a part adds to PI before rounding, and what it costs in coins (gems at the rate for its level).
  const gain = (m: ModDef) => m.power * 0.6 + m.grip * 0.3 - m.weight * 0.1
  const cost = (m: ModDef) => m.coins + m.bucks * gemCoins(m.unlockLevel)
  it('gives more for every pricier part in the same slot, on every body', () => {
    const bodies = [...new Set(CARS.map((c) => c.body))]
    for (const s of MOD_SLOTS) for (const body of bodies) {
      const parts = MODS.filter((m) => m.slot === s.id && modFits(m, body) && !m.tread)
      for (const a of parts) for (const b of parts) {
        if (cost(b) > cost(a)) expect(gain(b), `${body}: ${b.name} costs more than ${a.name}`).toBeGreaterThan(gain(a))
      }
    }
  })
})

describe('engines', () => {
  // Cylinders as the engine voice plays them (electric cars don't count). Resto-mods (crate-built,
  // top of their class) and the tank (no engine name) sit outside the ladder.
  const cyl = (c: CarDef) => (engineProfile(c.id).electric ? 0 : engineProfile(c.id).ppr * 2)
  const cost = (c: CarDef) => c.price + (c.bucks ?? 0) * gemCoins(c.unlockLevel)
  const ladder = CARS.filter((c) => !c.secret && c.body !== 'tank')
  it('never give a bigger engine less power than a smaller one that comes earlier for less', () => {
    for (const big of ladder) for (const small of ladder) {
      if (cyl(small) > 0 && cyl(big) > cyl(small) && carLevel(small) <= carLevel(big) && cost(small) <= cost(big)) {
        expect(big.power, `${big.name} vs ${small.name}`).toBeGreaterThanOrEqual(small.power)
      }
    }
  })
})
