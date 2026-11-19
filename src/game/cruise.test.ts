import { describe, expect, it } from 'vitest'
import { CRUISE, cruiseStep, landWalls, lotSolid, slabSolid, type CruisePose } from './cruise'
import { hits, type Solid } from './collide'

const foot = { w: 0.54, l: 1, cz: 0 }
const run = (p: CruisePose, input: { steer: number; gas: number; brake: number }, secs: number, solids: Solid[] = []) => {
  for (let t = 0; t < secs; t += 1 / 60) p = cruiseStep(p, input, 1 / 60, foot, solids).pose
  return p
}
const start = (): CruisePose => ({ x: 0, z: 0, h: 0, v: 0, steer: 0 })

describe('driving round town by hand', () => {
  it('speeds up to the top speed and no further', () => {
    const p = run(start(), { steer: 0, gas: 1, brake: 0 }, 5)
    expect(p.v).toBeCloseTo(CRUISE.top, 5)
    expect(p.z).toBeGreaterThan(10)
    expect(Math.abs(p.x)).toBeLessThan(1e-6)
  })

  it('brakes to a stop, then backs up slowly', () => {
    const moving = run(start(), { steer: 0, gas: 1, brake: 0 }, 3)
    const stopped = run(moving, { steer: 0, gas: 0, brake: 1 }, moving.v / CRUISE.brake + 0.01)
    expect(stopped.v).toBeLessThanOrEqual(0)
    const back = run(stopped, { steer: 0, gas: 0, brake: 1 }, 3)
    expect(back.v).toBeCloseTo(-CRUISE.back, 5)
  })

  it('rolls to a stop with nothing pressed', () => {
    const moving = run(start(), { steer: 0, gas: 1, brake: 0 }, 2)
    expect(run(moving, { steer: 0, gas: 0, brake: 0 }, 5).v).toBe(0)
  })

  it('steers left on +1, and turns tighter at a walk than at speed', () => {
    const left = run({ ...start(), v: 1 }, { steer: 1, gas: 0.01, brake: 0 }, 0.5)
    // Heading 0 faces +z; turning left (h going up) swings the nose towards +x.
    expect(left.h).toBeGreaterThan(0)
    expect(left.x).toBeGreaterThan(0)
    const slow = run({ ...start(), v: 1 }, { steer: 1, gas: 0, brake: 0 }, 0.3)
    const fast = run({ ...start(), v: CRUISE.top }, { steer: 1, gas: 1, brake: 0 }, 0.3)
    expect(slow.steer).toBeGreaterThan(fast.steer)
  })

  it('stops at a building instead of driving into it', () => {
    const wall = lotSolid({ x0: -2, x1: 2, z0: 4, z1: 8 })
    const p = run(start(), { steer: 0, gas: 1, brake: 0 }, 4, [wall])
    expect(hits({ x: p.x, z: p.z, h: p.h, w: foot.w, l: foot.l }, wall)).toBe(false)
    expect(p.z).toBeLessThan(4)
  })

  it('stays on the town land', () => {
    const walls = landWalls({ x0: -5, x1: 5, z0: -5, z1: 5 })
    const p = run(start(), { steer: 0, gas: 1, brake: 0 }, 6, walls)
    expect(p.z).toBeLessThan(5)
  })

  it('reads a traffic car the way the sim lays it out', () => {
    const s = slabSolid({ x: 1, z: 2, ux: 1, uz: 0, hl: 0.5, hw: 0.27 })
    expect(s.h).toBeCloseTo(Math.PI / 2)
    expect([s.w, s.l]).toEqual([0.54, 1])
  })
})
