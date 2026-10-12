import { describe, expect, it } from 'vitest'
import { boxPush, carBox, circlePush, corners, scrape, separate, step, type Box, type Footprint } from './collide'
import { BLOCK, DROP_R, GRID, STREET, TOWN_SOLIDS, atDrop, blockCentre, kerbSpot } from './arcadeMore'

const box = (x: number, z: number, h = 0, w = 0.8, l = 1.6): Box => ({ x, z, h, w, l })
const wall: Box = { x: 0, z: 0, h: 0, w: 4, l: 4 } // spans -2..2 both ways
const overlaps = (a: Box, solids: Box[]) => solids.some((s) => boxPush(a, s) !== null)

describe('collide', () => {
  it('pushes a box out the shallow way, away from the solid', () => {
    const p = boxPush(box(2.3, 0), wall)! // half width 0.4: 0.1 in on the +x side
    expect(p.depth).toBeCloseTo(0.1)
    expect(p.nx).toBeCloseTo(1)
    expect(p.x).toBeCloseTo(0.1)
    expect(boxPush({ ...box(2.3, 0), x: 2.3 + p.x }, wall)).toBeNull()
  })

  it('only touching is not a hit', () => {
    expect(boxPush(box(2.4, 0), wall)).toBeNull()
    expect(boxPush(box(0, 2.8), wall)).toBeNull()
  })

  it('catches a corner a centre-point check would miss', () => {
    // A car turned 45° next to the wall: its centre is 0.8 clear and its nose 0.32, but a corner pokes in.
    const a = box(2.8, 0, Math.PI / 4)
    const reach = Math.max(...corners(a).map(([x]) => 2.8 - x))
    expect(reach).toBeGreaterThan(0.8)
    expect(boxPush(a, wall)).not.toBeNull()
  })

  it('never hits through empty space at any angle', () => {
    for (let k = 0; k < 64; k++) {
      const h = (k / 64) * Math.PI * 2
      const a = box(0, 0, h)
      // Exactly the box's own reach on x: touching, not hitting.
      const rx = Math.max(...corners(a).map(([x]) => x))
      expect(boxPush({ ...a, x: 2 - Math.min(...corners(a).map(([x]) => x)) + 1e-4 }, wall)).toBeNull()
      expect(boxPush({ ...a, x: -2 - rx - 1e-4 }, wall)).toBeNull()
      expect(boxPush({ ...a, x: -2 - rx + 0.02 }, wall)).not.toBeNull()
    }
  })

  it('pushes a box off a post, and out when the post is inside it', () => {
    const p = circlePush(box(0, 0), { x: 0.5, z: 0, r: 0.2 })!
    expect(p.nx).toBeCloseTo(-1)
    expect(p.depth).toBeCloseTo(0.1)
    expect(circlePush(box(0, 0), { x: 0.65, z: 0, r: 0.2 })).toBeNull()
    // Off the corner diagonally: the corner (0.4, 0.8) is 0.283 from the post, no hit at r 0.25.
    expect(circlePush(box(0, 0), { x: 0.6, z: 1, r: 0.25 })).toBeNull()
    const inside = circlePush(box(0, 0), { x: 0.1, z: 0, r: 0.2 })!
    expect(inside.nx).toBeCloseTo(-1)
    expect(inside.depth).toBeCloseTo(0.5)
  })

  it('settles a car wedged into a corner between two solids', () => {
    const a: Box = { x: -2, z: 0, h: 0, w: 4, l: 10 } // everything left of x = 0
    const b: Box = { x: 0, z: -2, h: 0, w: 10, l: 4 } // everything below z = 0
    const car = box(0.3, 0.7, 0.4)
    const hit = separate(car, [a, b])!
    expect(hit).not.toBeNull()
    expect(overlaps({ ...car, x: car.x + hit.x, z: car.z + hit.z }, [a, b])).toBe(false)
  })

  it('bounces a little head on, slides along a wall at a glancing angle', () => {
    // Wall's way out is -z; the car drives +z into it.
    const head = scrape(5, 0, 0, -1)
    expect(head.v).toBeCloseTo(-1.25)
    expect(head.impact).toBeCloseTo(5)
    const glance = scrape(5, 0.3, 0, -1) // nearly square on: still a bounce
    expect(glance.v).toBeLessThan(0)
    const side = scrape(5, Math.PI / 2 - 0.3, 0, -1)
    expect(side.v).toBeGreaterThan(4)
    expect(side.impact).toBeCloseTo(5 * Math.sin(0.3))
    // The nose swings round towards the wall's line (h = π/2 runs along it).
    expect(side.h).toBeGreaterThan(Math.PI / 2 - 0.3)
    expect(side.h).toBeLessThanOrEqual(Math.PI / 2 + 1e-9)
    // Driving away from a wall isn't a hit.
    expect(scrape(5, Math.PI, 0, -1).impact).toBe(0)
  })

  it('reverses into a wall the same way', () => {
    const r = scrape(-3, Math.PI, 0, -1) // facing -z, rolling backwards into +z
    expect(r.impact).toBeCloseTo(3)
    expect(r.v).toBeCloseTo(0.75)
  })

  it('a step against a wall ends touching, not inside, and keeps moving along it', () => {
    const f: Footprint = { w: 0.8, l: 1.6, cz: 0 }
    let pose = { x: -1.5, z: -2.45, h: Math.PI / 2 - 0.25 } // alongside the wall's -z face, angled slightly into it
    let v = 6
    for (let i = 0; i < 40; i++) {
      const h = pose.h
      const next = { x: pose.x + Math.sin(h) * v * 0.05, z: pose.z + Math.cos(h) * v * 0.05, h }
      const r = step(pose, v, next, f, [wall])
      pose = r.pose
      v = r.v
      expect(boxPush(carBox(pose, f), wall)).toBeNull()
    }
    expect(pose.x).toBeGreaterThan(2) // scraped all the way past
    expect(v).toBeGreaterThan(3)
  })
})

describe('corner glances', () => {
  it('clipping a corner with the edge of the bumper slides the car past it', () => {
    const f: Footprint = { w: 0.8, l: 1.6, cz: 0 }
    // Driving +z at x = 2.3: the left 0.1 of the car's width overlaps the wall's x range.
    const r = step({ x: 2.3, z: -3, h: 0 }, 5, { x: 2.3, z: -2.75, h: 0 }, f, [wall])
    expect(r.pose.x).toBeGreaterThan(2.39)
    expect(r.v).toBeGreaterThan(3)
    expect(boxPush(carBox(r.pose, f), wall)).toBeNull()
  })

  it('a real head-on hit still stops the car', () => {
    const f: Footprint = { w: 0.8, l: 1.6, cz: 0 }
    const r = step({ x: 1.8, z: -3, h: 0 }, 5, { x: 1.8, z: -2.75, h: 0 }, f, [wall])
    expect(r.v).toBeLessThan(0)
    expect(r.pose.x).toBeCloseTo(1.8)
  })
})

describe('delivery town', () => {
  const f: Footprint = { w: 0.86, l: 1.6, cz: -0.02 }

  it('the solids are the blocks kerb to kerb', () => {
    const b = TOWN_SOLIDS[5]
    expect(b.w).toBe(BLOCK)
    // A car right up against a kerb, nose on, isn't touching it; 2 cm further is.
    const kerb = blockCentre(1) - BLOCK / 2
    expect(TOWN_SOLIDS.some((s) => boxPush(carBox({ x: kerb - 0.8 - 1e-3, z: blockCentre(1), h: Math.PI / 2 }, { ...f, cz: 0 }), s))).toBe(false)
    expect(TOWN_SOLIDS.some((s) => boxPush(carBox({ x: kerb - 0.78, z: blockCentre(1), h: Math.PI / 2 }, { ...f, cz: 0 }), s))).toBe(true)
  })

  it('every pickup and drop-off spot has room for a car', () => {
    for (let bx = 0; bx < GRID; bx++) for (let bz = 0; bz < GRID; bz++) for (const side of [0, 2]) {
      const [x, z] = kerbSpot(bx, bz, side)
      for (const h of [Math.PI / 2, -Math.PI / 2]) expect(separate(carBox({ x, z, h }, f), TOWN_SOLIDS)).toBeNull()
    }
    expect(STREET).toBeGreaterThan(DROP_R * 2)
  })

  it('you arrive when your car is inside the painted ring', () => {
    const spot = { x: 3, z: 4 }
    expect(atDrop(3, 4, spot)).toBe(true)
    expect(atDrop(3 + DROP_R - 0.01, 4, spot)).toBe(true)
    expect(atDrop(3 + DROP_R + 0.05, 4, spot)).toBe(false)
    expect(atDrop(3 + 1.3, 4, spot)).toBe(false) // the old 1.4 reach fired outside the ring
  })

  it('random driving never ends a step inside a kerb', () => {
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const [sx, sz] = kerbSpot(1, 1, 1)
    let pose = { x: sx, z: sz, h: 0 }
    let v = 0
    let hits = 0
    for (let i = 0; i < 4000; i++) {
      v = Math.max(-3, Math.min(7, v + (rand() - 0.3) * 2))
      const h = pose.h + (rand() - 0.5) * 0.5
      const next = { x: pose.x + Math.sin(h) * v * 0.05, z: pose.z + Math.cos(h) * v * 0.05, h }
      const r = step(pose, v, next, f, TOWN_SOLIDS)
      if (r.impact) hits++
      pose = r.pose
      v = r.v
      expect(separate(carBox(pose, f), TOWN_SOLIDS, 1)).toBeNull()
    }
    expect(hits).toBeGreaterThan(20)
  })
})
