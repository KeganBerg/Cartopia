import { step, type Box, type Footprint, type Solid } from './collide'

// Driving your own car round town by hand: no race, no prize, no fuel. The car is a
// bicycle model at town scale (TILE 2, lanes 0.6) that scrapes along buildings, the
// edge of the town's land and the other cars instead of driving through them.

export type CruisePose = { x: number; z: number; h: number; v: number; steer: number }
export type CruiseInput = { steer: number; gas: number; brake: number }

// Units a second, and how hard it speeds up, brakes and rolls to a stop on its own.
// Top speed is a little over the quickest town traffic, reverse a crawl.
export const CRUISE = { top: 4, back: 1.2, accel: 2.2, brake: 6, coast: 1.2, lock: 0.6, steerRate: 4 }

// Full lock at a walk, less at speed, so the car doesn't spin out at the top end.
export const lockAt = (v: number) => CRUISE.lock / (1 + Math.abs(v) * 0.18)

export function cruiseStep(p: CruisePose, input: CruiseInput, dt: number, foot: Footprint, solids: Solid[]): { pose: CruisePose; impact: number } {
  dt = Math.min(dt, 0.1)
  let v = p.v
  if (input.gas > 0) v = v < 0 ? Math.min(0, v + CRUISE.brake * dt) : Math.min(CRUISE.top, v + CRUISE.accel * input.gas * dt)
  else if (input.brake > 0) v = v > 0 ? Math.max(0, v - CRUISE.brake * dt) : Math.max(-CRUISE.back, v - CRUISE.accel * input.brake * dt)
  else v = Math.sign(v) * Math.max(0, Math.abs(v) - CRUISE.coast * dt)
  // The wheels turn towards where the player is steering rather than snapping there.
  const want = input.steer * lockAt(v)
  const steer = p.steer + Math.max(-CRUISE.steerRate * dt, Math.min(CRUISE.steerRate * dt, want - p.steer))
  const h = p.h + (v / (foot.l * 0.62)) * Math.tan(steer) * dt
  const next = { x: p.x + Math.sin(h) * v * dt, z: p.z + Math.cos(h) * v * dt, h }
  const r = step({ x: p.x, z: p.z, h: p.h }, v, next, foot, solids)
  return { pose: { ...r.pose, v: r.v, steer }, impact: r.impact }
}

// The walls round the town's land: four long boxes just outside it.
export function landWalls(b: { x0: number; x1: number; z0: number; z1: number }): Box[] {
  const w = b.x1 - b.x0, l = b.z1 - b.z0, t = 2
  return [
    { x: b.x0 - t / 2, z: (b.z0 + b.z1) / 2, h: 0, w: t, l: l + t * 2 },
    { x: b.x1 + t / 2, z: (b.z0 + b.z1) / 2, h: 0, w: t, l: l + t * 2 },
    { x: (b.x0 + b.x1) / 2, z: b.z0 - t / 2, h: 0, w, l: t },
    { x: (b.x0 + b.x1) / 2, z: b.z1 + t / 2, h: 0, w, l: t },
  ]
}

// A building's lot as a solid, a little inside its edge so the car can hug the kerb.
export const lotSolid = (l: { x0: number; x1: number; z0: number; z1: number }, inset = 0.15): Box => ({
  x: (l.x0 + l.x1) / 2, z: (l.z0 + l.z1) / 2, h: 0, w: l.x1 - l.x0 - inset * 2, l: l.z1 - l.z0 - inset * 2,
})

// A traffic car's slab (traffic/sim.ts boxes: centre, unit heading, half sizes) as a solid.
export const slabSolid = (b: { x: number; z: number; ux: number; uz: number; hl: number; hw: number }): Box => ({
  x: b.x, z: b.z, h: Math.atan2(b.ux, b.uz), w: b.hw * 2, l: b.hl * 2,
})
