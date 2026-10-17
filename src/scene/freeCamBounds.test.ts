import { describe, expect, it } from 'vitest'
import { PLOT_MAX, PLOT_MIN, START_LAND } from '../game/data'
import type { PlacedBuilding } from '../game/store'
import { CLEAR, MIN_ARM, RAMP, ROAM_MARGIN, cameraSpot, lotsOf, roamBox, roofFloor, type Lot } from './freeCamBounds'
import { FREE, nearFor } from './freeCam'

// The free camera (the orbit button in town): where it may go. Kegan's orbit
// view audit (10-16) found it parked inside buildings, cutting walls open up
// close, and drifting 150 units off into empty forest with no way back.

const flat = () => 1.2
const building = (over: Partial<PlacedBuilding>): PlacedBuilding => ({ uid: 'b', def: 'showroom', x: 9, z: 9, jobEndsAt: null, ...over })

describe('free camera roaming', () => {
  it('keeps the spot in view over the town and the fields just past it', () => {
    const box = roamBox(START_LAND)
    // The starting land is tiles 0-23, world -24 to 24.
    expect(box).toEqual({ x0: -24 - ROAM_MARGIN, x1: 24 + ROAM_MARGIN, z0: -24 - ROAM_MARGIN, z1: 24 + ROAM_MARGIN })
  })

  it('grows with the land bought', () => {
    const all: string[] = []
    for (let x = PLOT_MIN; x <= PLOT_MAX; x++) for (let z = PLOT_MIN; z <= PLOT_MAX; z++) all.push(`${x},${z}`)
    const box = roamBox(all)
    expect(box.x0).toBeLessThan(-55 - ROAM_MARGIN + 1)
    expect(box.x1).toBeGreaterThan(55 + ROAM_MARGIN - 1)
  })
})

describe('free camera and buildings', () => {
  const [lot] = lotsOf([building({})])
  lot.top = 2.2

  it('turns a building into its lot in world units, leaving out stored ones', () => {
    expect([lot.x0, lot.x1, lot.z0, lot.z1]).toEqual([-6, -2, -6, -2])
    expect(lotsOf([building({ stored: true })])).toEqual([])
  })

  it('lifts the camera over the roof on the lot and lets it down to the street past it', () => {
    expect(roofFloor([lot], -4, -4)).toBeCloseTo(2.2 + CLEAR)
    expect(roofFloor([lot], -2, -4)).toBeCloseTo(2.2 + CLEAR)
    expect(roofFloor([lot], -2 + RAMP, -4)).toBe(0)
  })

  it('leaves a one-tile street between two buildings at street level', () => {
    const two: Lot[] = [{ key: 'a', x0: -6, x1: -2, z0: -6, z1: -2, top: 3 }, { key: 'b', x0: 0, x1: 4, z0: -6, z1: -2, top: 3 }]
    expect(roofFloor(two, -1, -4)).toBe(0)
  })

  it('never jumps: the floor rises smoothly towards a building', () => {
    let last = roofFloor([lot], 2, -4)
    for (let x = 2; x >= -4; x -= 0.01) {
      const f = roofFloor([lot], x, -4)
      expect(Math.abs(f - last)).toBeLessThan(0.08)
      last = f
    }
  })

  // Turn all the way round a spot on the grass beside the showroom, 60 frames a second.
  const circle = (view: { x: number; y: number; z: number }, dist: number) => {
    const pitch = 1.4
    let carry = { arm: 1, lift: 0 }
    let prev: { x: number; y: number; z: number } | null = null
    let biggest = 0
    const frames = 600
    for (let i = 0; i <= frames; i++) {
      const yaw = (i / frames) * Math.PI * 2
      const off = { x: dist * Math.sin(pitch) * Math.sin(yaw), y: dist * Math.cos(pitch), z: dist * Math.sin(pitch) * Math.cos(yaw) }
      const at = cameraSpot(view, off, [lot], flat, carry, 1 / 60)
      carry = at
      const inside = at.x > lot.x0 && at.x < lot.x1 && at.z > lot.z0 && at.z < lot.z1 && at.y < lot.top!
      expect(inside, `frame ${i} inside the showroom at ${at.x.toFixed(2)},${at.y.toFixed(2)},${at.z.toFixed(2)}`).toBe(false)
      if (prev) biggest = Math.max(biggest, Math.hypot(at.x - prev.x, at.y - prev.y, at.z - prev.z))
      prev = at
    }
    return biggest
  }

  // One frame of turning moves the camera about 0.07 to 0.1. Riding over a roof stays
  // close to that; sliding in front of one is a quick glide, never a jump of more than
  // a tenth of the way in a frame.
  it('circling right beside a building rides over it, never inside and never snapping', () => {
    expect(circle({ x: -8.5, y: 0, z: -4 }, 7)).toBeLessThan(0.5)
  })

  it('circling further off slides in front of it, never inside and never snapping', () => {
    expect(circle({ x: -12, y: 0, z: -4 }, 10)).toBeLessThan(1)
  })

  it('slides in front of a building rather than sit inside it', () => {
    // Camera pose straight through the showroom, the spot in view on the grass in front of it.
    const view = { x: -12, y: 0, z: -4 }
    const off = { x: 9, y: 0.5, z: 0 }
    let at = { x: 0, y: 0, z: 0, arm: 1, lift: 0 }
    for (let i = 0; i < 120; i++) at = cameraSpot(view, off, [lot], flat, at, 1 / 60)
    expect(at.x).toBeLessThan(lot.x0)
    expect(at.x - view.x).toBeGreaterThanOrEqual(MIN_ARM - 0.2)
    expect(at.y).toBeLessThan(2)
  })
})

describe('free camera near plane', () => {
  it('comes in close up, so walls a step away are not cut open', () => {
    expect(nearFor(FREE.minDist)).toBe(FREE.nearClose)
    expect(FREE.nearClose).toBeLessThanOrEqual(0.25)
  })

  it('stays at FREE.near far out, where coplanar.test.tsx measures depth', () => {
    expect(nearFor(FREE.maxDist)).toBe(FREE.near)
  })

  it('never makes depth coarser than at the furthest zoom', () => {
    // The depth step at the spot in view is about d * d / near.
    const worst = (FREE.maxDist * FREE.maxDist) / FREE.near
    for (let d = FREE.minDist; d <= FREE.maxDist; d += 0.5) expect((d * d) / nearFor(d)).toBeLessThanOrEqual(worst + 1e-6)
  })
})
