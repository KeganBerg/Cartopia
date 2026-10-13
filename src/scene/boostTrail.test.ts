import { describe, expect, it } from 'vitest'
import { BOOST_TRAIL, BoostTrail } from './boostTrail'

// The boost trail is one ribbon mesh written in place each frame: it follows the car while
// the boost burns, stretches back about speed × life, then fades away once it stops.
describe('boost trail', () => {
  const zs = (t: BoostTrail) => {
    const p = t.mesh.geometry.attributes.position.array as Float32Array
    const out: number[] = []
    for (let i = 2; i < p.length; i += 3) out.push(p[i])
    return out
  }

  it('follows a boosting car, then fades out without reallocating', () => {
    const t = new BoostTrail()
    const pos = t.mesh.geometry.attributes.position
    const buf = pos.array
    expect(t.mesh.visible).toBe(false)
    // 20 units a second up the strip for a second, boosting.
    let z = 0
    for (let f = 0; f < 60; f++) {
      z += 20 / 60
      t.update(1 / 60, 0.75, 0.16, z, 0, true)
    }
    expect(t.mesh.visible).toBe(true)
    const span = zs(t)
    expect(Math.max(...span)).toBeCloseTo(z, 3)
    // Stretches back roughly speed × life, never further.
    expect(z - Math.min(...span)).toBeGreaterThan(20 * BOOST_TRAIL.life * 0.7)
    expect(z - Math.min(...span)).toBeLessThan(20 * BOOST_TRAIL.life * 1.2)
    // Boost over: gone within its life.
    for (let f = 0; f < 30; f++) {
      z += 20 / 60
      t.update(1 / 60, 0.75, 0.16, z, 0, false)
    }
    expect(t.mesh.visible).toBe(false)
    expect(t.mesh.geometry.attributes.position).toBe(pos)
    expect(pos.array).toBe(buf)
    t.dispose()
  })

  it("starts a fresh ribbon on the next burn instead of joining the last one's tail", () => {
    const t = new BoostTrail()
    for (let f = 0; f < 20; f++) t.update(1 / 60, 0, 0.16, f * 0.3, 0, true)
    t.update(1 / 60, 0, 0.16, 6, 0, false)
    // Fires again far up the road a moment later.
    t.update(1 / 60, 0, 0.16, 40, 0, true)
    t.update(1 / 60, 0, 0.16, 40.3, 0, true)
    expect(Math.min(...zs(t))).toBeGreaterThan(39)
    t.dispose()
  })
})
