import { describe, expect, it } from 'vitest'
import { CLEAR, conditions, conditionsNote, gripMul, surfaceOf, type Conditions } from './grip'
import { freshRacer, raceFloor, shiftQuality, stepRacer } from './race'
import { WEATHER_KINDS } from './weather'
import { VENUES } from '../scene/venues'
import { MODS } from './data'

// A run with every shift at `at` rpm.
function run(pi: number, c: Conditions, at = 0.855) {
  const r = freshRacer()
  const dt = 1 / 240
  let t = 0
  while (r.finished === null && t < 120) {
    t += dt
    if (r.gear < 3 && r.rpm >= at) {
      r.quality = shiftQuality(r.rpm, c.lo, c.hi).q
      r.gear++
      r.rpm = 0.35
    }
    stepRacer(r, pi, dt, t, gripMul(c, r.gear, r.rpm, t))
  }
  return r.finished!
}

describe('race grip', () => {
  it('only ever slows a car, so the referee floors stay safe', () => {
    for (const pi of [30, 70, 120]) {
      const floor = raceFloor(pi)
      const dry = run(pi, CLEAR)
      for (const v of VENUES) for (const k of WEATHER_KINDS) for (const grip of [20, 60, 100]) {
        const c = conditions(k, v.id, grip)
        expect(c.lo).toBeGreaterThanOrEqual(CLEAR.lo)
        expect(c.hi).toBeLessThanOrEqual(CLEAR.hi)
        expect(c.hi - c.lo).toBeGreaterThan(0.05)
        for (let at = c.lo; at <= c.hi; at += 0.01) {
          const time = run(pi, c, at)
          expect(time).toBeGreaterThanOrEqual(floor)
        }
        expect(run(pi, c)).toBeGreaterThanOrEqual(dry - 1e-9)
      }
    }
  })

  it('costs a few tenths in a storm or blizzard, and the right tires take it all back', () => {
    const dry = run(60, CLEAR)
    const storm = run(60, conditions('storm', 'main', 45)) - dry
    const blizzard = run(60, conditions('blizzard', 'snow', 45)) - dry
    const dust = run(60, conditions('dust', 'desert', 45)) - dry
    expect(storm).toBeGreaterThan(0.15)
    expect(storm).toBeLessThan(0.8)
    expect(blizzard).toBeGreaterThan(storm)
    expect(dust).toBeGreaterThan(0.1)
    expect(run(60, conditions('storm', 'main', 45, ['raintires']))).toBeCloseTo(dry, 5)
    expect(run(60, conditions('blizzard', 'snow', 45, ['snowstuds']))).toBeCloseTo(dry, 5)
    expect(run(60, conditions('dust', 'desert', 45, ['sandtires']))).toBeCloseTo(dry, 5)
    const all = run(60, conditions('storm', 'main', 45, ['allweather'])) - dry
    expect(all).toBeGreaterThan(0)
    expect(all).toBeLessThan(storm / 2)
  })

  it('lets grippy cars shrug off some wheelspin', () => {
    expect(conditions('rain', 'main', 90).spin).toBeLessThan(conditions('rain', 'main', 30).spin)
  })

  it('leaves a dry strip alone and says what a slick one does', () => {
    expect(surfaceOf('clear', 'main')).toEqual({ wet: 0, snow: 0, dust: 0 })
    expect(conditions('fog', 'docks', 50)).toEqual(CLEAR)
    expect(conditionsNote(CLEAR)).toBeNull()
    expect(conditionsNote(conditions('clear', 'snow', 50))).toMatch(/Icy/)
    expect(conditionsNote(conditions('dust', 'desert', 50))).toMatch(/Sandy/)
    expect(conditionsNote(conditions('rain', 'main', 50, ['raintires']))).toBeNull()
  })

  it('gives tires no PI, so they never move a time floor', () => {
    for (const m of MODS.filter((x) => x.slot === 'tires')) {
      expect([m.power, m.grip, m.weight]).toEqual([0, 0, 0])
      expect(m.tread).toBeTruthy()
    }
  })
})
