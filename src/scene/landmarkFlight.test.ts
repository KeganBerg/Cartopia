// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import { flight, T } from './Landmark'

// The Skyhopper's flight must be smooth: no jumps in place or speed, and no
// snaps of heading, from take-off to touchdown (Kegan saw it stutter before landing).
describe('skyhopper flight', () => {
  const pad: [number, number, number] = [1.45, 9.89, 0]
  const dt = 1 / 120
  const at = (c: number) => {
    const p = { x: 0, y: 0, z: 0, bank: 0, thrust: 0 }
    flight(c, pad, p)
    return p
  }
  it('starts and ends on the pad', () => {
    for (const c of [0, T.land, T.land + 5]) {
      const p = at(c)
      expect(Math.hypot(p.x, p.y, p.z)).toBeLessThan(1e-6)
    }
  })
  it('never jumps, and its speed changes gently', () => {
    let worstJump = 0, worstAccel = 0, worstBank = 0
    let prev = at(0), v0 = 0
    for (let c = dt; c <= T.land + 0.5; c += dt) {
      const p = at(c)
      const step = Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z)
      const v = step / dt
      worstJump = Math.max(worstJump, step)
      if (c > dt) worstAccel = Math.max(worstAccel, Math.abs(v - v0) / dt)
      worstBank = Math.max(worstBank, Math.abs(p.bank - prev.bank))
      prev = p
      v0 = v
    }
    expect(worstJump).toBeLessThan(0.1) // under 12 units a second
    expect(worstAccel).toBeLessThan(40)
    expect(worstBank).toBeLessThan(0.01)
  })
  it('turns its heading smoothly while it moves sideways', () => {
    let worst = 0, last: number | null = null
    for (let c = 0; c <= T.land; c += dt) {
      const p = at(c), q = at(c + 0.05)
      const vx = q.x - p.x, vz = q.z - p.z
      if (vx * vx + vz * vz <= 1e-6) continue
      const yaw = Math.atan2(vx, vz)
      if (last !== null) {
        let d = Math.abs(yaw - last) % (2 * Math.PI)
        if (d > Math.PI) d = 2 * Math.PI - d
        worst = Math.max(worst, d)
      }
      last = yaw
    }
    expect(worst).toBeLessThan(0.15)
  })
})
