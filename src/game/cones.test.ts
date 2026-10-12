import { describe, expect, it } from 'vitest'
import { TRACKS, buildTrack, type Kart } from './kart'
import { CONE_REACH, placeCones, stepCones } from './cones'

const kart = (x: number, z: number, vx = 0, vz = 20) => ({ x, z, y: 0, vx, vz }) as Kart

describe('smashable cones', () => {
  it('line the inside of bends on every track, clear of pads, ramps and crates', () => {
    for (const def of TRACKS) for (const reverse of [false, true]) {
      const t = buildTrack(def, reverse)
      const cones = placeCones(t)
      expect(cones.length).toBeGreaterThanOrEqual(6)
      for (const c of cones) for (const b of [...t.boosts, ...t.ramps, ...t.crates]) expect(Math.hypot(b.x - c.hx, b.z - c.hz)).toBeGreaterThan(3)
    }
  })

  it('a kart that clips one sends it flying, and it comes back later', () => {
    const t = buildTrack(TRACKS[0])
    const cones = placeCones(t)
    const c = cones[0]
    expect(stepCones(cones, [kart(c.x + CONE_REACH / 2, c.z)], 1, 1 / 60)).toBe(1)
    expect(c.hit).toBe(1)
    for (let i = 1; i < 20; i++) stepCones(cones, [], 1 + i / 60, 1 / 60)
    expect(c.y).toBeGreaterThan(0)
    for (let i = 0; i < 60 * 7; i++) stepCones(cones, [], 1.4 + i / 60, 1 / 60)
    expect(c.hit).toBe(-1)
    expect([c.x, c.z]).toEqual([c.hx, c.hz])
  })

  it('never touches the kart', () => {
    const t = buildTrack(TRACKS[0])
    const cones = placeCones(t)
    const k = kart(cones[0].x, cones[0].z)
    const before = { ...k }
    stepCones(cones, [k], 1, 1 / 60)
    expect(k).toEqual(before)
  })
})
