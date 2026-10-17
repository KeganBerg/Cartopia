import { PLOT, TILE } from '../game/data'
import { footprint } from '../game/store'
import type { PlacedBuilding } from '../game/store'
import { toWorld } from './grid'

// Where the free camera may go, worked out from the town itself so it stays
// testable without a renderer.

// How far past the owned land the spot in view may drift: far enough to look
// back at the whole town from the fields, not so far the town is lost.
export const ROAM_MARGIN = 30

// The box (world units) the spot the free camera looks at stays inside.
export function roamBox(land: string[]) {
  let x0 = Infinity
  let x1 = -Infinity
  let z0 = Infinity
  let z1 = -Infinity
  for (const k of land) {
    const [px, pz] = k.split(',').map(Number)
    const [ax, az] = toWorld(px * PLOT, pz * PLOT)
    const [bx, bz] = toWorld(px * PLOT + PLOT - 1, pz * PLOT + PLOT - 1)
    x0 = Math.min(x0, ax - TILE / 2)
    z0 = Math.min(z0, az - TILE / 2)
    x1 = Math.max(x1, bx + TILE / 2)
    z1 = Math.max(z1, bz + TILE / 2)
  }
  if (!Number.isFinite(x0)) [x0, z0, x1, z1] = [-24, -24, 24, 24]
  return { x0: x0 - ROAM_MARGIN, x1: x1 + ROAM_MARGIN, z0: z0 - ROAM_MARGIN, z1: z1 + ROAM_MARGIN }
}

// A building's lot in world units, and its roof height once measured.
// `key` changes when anything that changes its shape does (see World's shapeOf).
export type Lot = { key: string; x0: number; x1: number; z0: number; z1: number; top?: number; at?: number }

export function lotsOf(buildings: PlacedBuilding[]): Lot[] {
  return buildings.filter((b) => !b.stored).map((b) => {
    const tiles = footprint(b.def, b.x, b.z, b.rot)
    const xs = tiles.map(([x]) => x)
    const zs = tiles.map(([, z]) => z)
    const [ax, az] = toWorld(Math.min(...xs), Math.min(...zs))
    const [bx, bz] = toWorld(Math.max(...xs), Math.max(...zs))
    return { key: `${b.uid}:${b.def}:${b.x}:${b.z}:${b.rot}:${b.level ?? 1}:${b.merge ?? ''}:${b.mturn ?? ''}`, x0: ax - TILE / 2, x1: bx + TILE / 2, z0: az - TILE / 2, z1: bz + TILE / 2 }
  })
}

// The camera rides up over a building as it nears the lot, reaching roof height
// plus CLEAR at the lot's edge (the walls stand inside it) from RAMP away, so a
// street between two lots stays at street level. The near plane up close
// (FREE.nearClose) is far smaller than the lot's inset, so walls are never cut open.
export const RAMP = 0.8
// Headroom over the roof.
export const CLEAR = 0.6

export const distToLot = (l: Lot, x: number, z: number) => Math.hypot(Math.max(l.x0 - x, 0, x - l.x1), Math.max(l.z0 - z, 0, z - l.z1))

// The lowest the camera may be at (x, z) to stay out of the measured buildings.
// Smooth in both directions, so sliding past a building rolls up and over it
// instead of popping.
// `pad` reaches that much further out (cameraSpot looks ahead with it).
export function roofFloor(lots: Lot[], x: number, z: number, pad = 0) {
  let floor = 0
  for (const l of lots) {
    if (l.top === undefined) continue
    const d = Math.max(0, distToLot(l, x, z) - pad)
    if (d >= RAMP) continue
    const t = 1 - d / RAMP
    floor = Math.max(floor, (l.top + CLEAR) * t * t * (3 - 2 * t))
  }
  return floor
}

// Where the camera goes for a pose: `view` is the spot it looks at and `off` the
// arm out to where the pose puts it. If the end of the arm is in or close to a
// building, the arm shortens until the camera is in front of it with room to
// spare, the way a game camera keeps the player in view; with no room for that
// (MIN_ARM, or a narrow street) it stays out and rides up over any roof it's
// on. The arm eases to its new length, quicker in than back out, and the camera
// rises at once but settles gently, so passing behind a building glides instead
// of snapping. `ground` is the lowest the camera may be at a spot for the land itself.
export const MIN_ARM = 1.5
const ARM_IN = 8
const ARM_OUT = 4
const SETTLE = 5
// The arm shortens once the camera comes this close to a building's ramp, so it's
// already in front of the building by the time it would have got there.
const LOOKAHEAD = 2
type V = { x: number; y: number; z: number }
export type Carry = { arm: number; lift: number }
export function armFor(view: V, off: V, lots: Lot[], ground: (x: number, z: number) => number) {
  const len = Math.hypot(off.x, off.y, off.z)
  const clear = (k: number) => {
    const x = view.x + off.x * k
    const z = view.z + off.z * k
    return Math.max(view.y + off.y * k, ground(x, z)) >= roofFloor(lots, x, z, LOOKAHEAD)
  }
  if (clear(1)) return 1
  const step = Math.max(0.2, len / 200)
  for (let s = len - step; s > MIN_ARM; s -= step) if (clear(s / len)) return s / len
  return 1
}
export function cameraSpot(view: V, off: V, lots: Lot[], ground: (x: number, z: number) => number, was: Carry, dt: number) {
  const want = armFor(view, off, lots, ground)
  const arm = was.arm + (want - was.arm) * (1 - Math.exp(-(want < was.arm ? ARM_IN : ARM_OUT) * dt))
  const x = view.x + off.x * arm
  const z = view.z + off.z * arm
  const base = Math.max(view.y + off.y * arm, ground(x, z))
  const lift = Math.max(roofFloor(lots, x, z) - base, was.lift * Math.exp(-SETTLE * dt), 0)
  return { x, y: base + lift, z, arm, lift }
}
