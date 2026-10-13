import { describe, expect, it } from 'vitest'
import { NEAR_GAP, NEAR_R, NEAR_TOUCH, nearMiss, stepNearMiss } from './nearMiss'

// The player drives up the z axis at 20 m/s; another kart sits at (x, z).
const me = (z = 0, speed = 20) => ({ id: 0, x: 0, z, y: 0, vx: 0, vz: speed, h: 0, spin: 0 })
const kart = (x: number, z: number) => ({ id: 1, x, z, y: 0, vx: 0, vz: 10, h: 0, spin: 0 })

// Drives the player past a kart `gap` metres to the side, returning whether a near miss was called.
function pass(gap: number, speed = 20, s = nearMiss(), t0 = 0) {
  let called = false
  for (let z = -6; z <= 6; z += 0.25) called = stepNearMiss(s, me(z, speed), [me(z, speed), kart(gap, 0)], t0 + (z + 6) / speed) || called
  return called
}

describe('near misses', () => {
  it('calls a close pass that never touches', () => {
    expect(pass((NEAR_TOUCH + NEAR_R) / 2)).toBe(true)
  })

  it('ignores a rub, a wide pass and a slow crawl', () => {
    expect(pass(NEAR_TOUCH - 0.1)).toBe(false)
    expect(pass(NEAR_R + 0.5)).toBe(false)
    expect(pass((NEAR_TOUCH + NEAR_R) / 2, 4)).toBe(false)
  })

  it('needs the kart to go by, not just come close and drop back', () => {
    const s = nearMiss()
    let called = false
    for (const z of [-4, -1.5, -1, -1.5, -4]) called = stepNearMiss(s, me(z), [kart(1.8, 0)], 1) || called
    expect(called).toBe(false)
  })

  it('waits a moment between calls', () => {
    const s = nearMiss()
    const gap = (NEAR_TOUCH + NEAR_R) / 2
    expect(pass(gap, 20, s, 0)).toBe(true)
    expect(pass(gap, 20, s, 1)).toBe(false)
    expect(pass(gap, 20, s, NEAR_GAP + 1)).toBe(true)
  })
})
