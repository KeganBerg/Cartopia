// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import { AIRBORNE, FADE_S, FX, REST_S, drift, makeFliers } from './SeasonFx'

describe('falling leaves', () => {
  it('land, lie still for REST_S, then leave after the fade', () => {
    const f = makeFliers(1)
    f.y[0] = 0.5
    let t = 0
    while (f.land[0] === AIRBORNE && t < 10) drift(f, FX.fall, (t += 0.05), 0.05, true)
    expect(f.land[0]).not.toBe(AIRBORNE)
    const landed = f.land[0]
    const spot = [f.x[0], f.y[0], f.z[0]]
    while (t < landed + REST_S + FADE_S - 0.1) drift(f, FX.fall, (t += 0.05), 0.05, true)
    expect([f.x[0], f.y[0], f.z[0]]).toEqual(spot)
    drift(f, FX.fall, (t += 0.2), 0.05, true)
    expect(f.land[0]).toBe(AIRBORNE)
    expect(f.y[0]).not.toBe(spot[1])
  })
})
