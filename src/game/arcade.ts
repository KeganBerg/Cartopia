// Arcade mini games: Getaway Chase (dodge traffic in three lanes with a cop on your tail)
// and Parking Pro (steer into a tight spot). The rules and payouts are pure functions here;
// the 3D scenes are scene/ChaseScene.tsx and scene/ParkScene.tsx.
// Payouts are small coins and XP, like a quick race, so the server's usual earning limits cover them.

import { boxPush, corners, hits, type Box, type Solid } from './collide'

export type ArcadeId = 'chase' | 'park'
export const ARCADE_FUEL = 2

// ---------- Getaway Chase ----------

export const CHASE_LANES = [-1.7, 0, 1.7]
export const CHASE_HEARTS = 3
// World units per second: starts easy and climbs to the top speed over about 90 seconds.
export const chaseSpeed = (t: number) => Math.min(30, 13 + t * 0.19)
// Each coin grabbed is worth this many score points; distance counts one point per meter.
export const CHASE_COIN_POINTS = 25
export const chaseScore = (dist: number, coins: number) => Math.floor(dist) + coins * CHASE_COIN_POINTS

export function chaseReward(score: number, level: number) {
  const cap = 120 + 40 * level
  return { coins: Math.min(cap, Math.floor(score / 6)), xp: Math.min(25, 4 + Math.floor(score / 150)) }
}

// One row of the road ahead: which lanes hold a car, and which lane holds a line of coins.
// There is always at least one open lane, and the coins never sit in a blocked lane.
export function chaseRow(rand: () => number, t: number): { cars: number[]; coins: number | null } {
  const lanes = [0, 1, 2]
  const blockTwo = rand() < Math.min(0.55, 0.15 + t * 0.006)
  const shuffled = lanes.sort(() => rand() - 0.5)
  const cars = shuffled.slice(0, blockTwo ? 2 : 1)
  const open = lanes.filter((l) => !cars.includes(l))
  const coins = rand() < 0.6 ? open[Math.floor(rand() * open.length)] : null
  return { cars: cars.sort(), coins }
}

// ---------- Parking Pro ----------

// Every car in the lot fits in PARK_LEN by PARKED_W (scaled down evenly to fit) and is
// checked at its own measured footprint, so what you see is what you hit.
export const PARK_LEN = 1.7
export const PARK_MAX_BUMPS = 3
export const PARKED_W = 0.8

export type Pose = { x: number; z: number; h: number } // h = 0 faces +z
export type { Box }
export type ParkLot = {
  name: string
  start: Pose
  spot: Box
  cars: Pose[]
  cones: { x: number; z: number }[]
  walls: Box[]
  w: number // lot width (x)
  l: number // lot length (z)
  par: number // seconds for three stars
}

const PI = Math.PI
const HALF = PI / 2
// The spot box is the car's size plus this much room, shrinking lot by lot.
const room = (w: number, l: number) => ({ w: 0.8 + w, l: PARK_LEN + l })

export const PARK_LOTS: ParkLot[] = [
  {
    name: 'Easy Street', w: 10, l: 16, par: 9,
    start: { x: 0, z: 5.5, h: PI }, spot: { x: 0, z: -4, h: 0, ...room(0.9, 1.1) },
    cars: [], cones: [{ x: -1.6, z: -4 }, { x: 1.6, z: -4 }], walls: [],
  },
  {
    name: 'Corner Store', w: 10, l: 16, par: 11,
    start: { x: -2.5, z: 5.5, h: PI },
    spot: { x: 1.4, z: -5.6, h: 0, ...room(0.7, 0.9) },
    cars: [{ x: -2.8, z: -5.6, h: 0 }, { x: -1.4, z: -5.6, h: PI }, { x: 0, z: -5.6, h: 0 }, { x: 2.8, z: -5.6, h: PI }],
    cones: [], walls: [{ x: 0, z: -7.4, h: 0, w: 10, l: 0.4 }],
  },
  {
    name: 'Curbside', w: 10, l: 16, par: 14,
    start: { x: 0, z: 6, h: PI },
    spot: { x: 3.7, z: -1, h: 0, w: 1.15, l: PARK_LEN + 1.2 },
    cars: [{ x: 3.7, z: 2.3, h: PI }, { x: 3.7, z: -4.3, h: PI }],
    cones: [], walls: [{ x: 4.75, z: 0, h: 0, w: 0.5, l: 16 }],
  },
  {
    name: 'Mall Rush', w: 10, l: 16, par: 14,
    start: { x: 3.5, z: 6, h: PI },
    spot: { x: -1.4, z: -5.6, h: 0, ...room(0.55, 0.8) },
    cars: [{ x: -4, z: -5.6, h: 0 }, { x: -2.7, z: -5.6, h: 0 }, { x: 0, z: -5.6, h: PI }, { x: 1.3, z: -5.6, h: 0 }, { x: 2.6, z: -5.6, h: 0 },
      { x: -2.7, z: 1, h: PI }, { x: -1.4, z: 1, h: 0 }, { x: 0, z: 1, h: 0 }],
    cones: [{ x: 3.2, z: -1.5 }, { x: 4, z: -1.5 }], walls: [{ x: 0, z: -7.4, h: 0, w: 10, l: 0.4 }],
  },
  {
    name: 'Back Alley', w: 10, l: 16, par: 16,
    start: { x: -3.5, z: 6, h: PI },
    spot: { x: 3.3, z: -5.4, h: HALF, w: 0.8 + 0.6, l: PARK_LEN + 0.9 },
    cars: [{ x: 3.3, z: -3.9, h: HALF }, { x: 3.3, z: -6.9, h: -HALF }],
    cones: [{ x: -1, z: 3 }, { x: -1, z: 2.2 }, { x: 1.2, z: -0.5 }, { x: 1.2, z: -1.3 }],
    walls: [{ x: -2.5, z: 0.3, h: 0, w: 5, l: 0.5 }, { x: 2.2, z: 3, h: 0, w: 5.6, l: 0.5 }, { x: 4.75, z: 0, h: 0, w: 0.5, l: 16 }],
  },
  {
    name: 'Tight Squeeze', w: 10, l: 16, par: 16,
    start: { x: 0, z: 6, h: PI },
    spot: { x: 3.7, z: -1.5, h: 0, w: 1.05, l: PARK_LEN + 0.85 },
    cars: [{ x: 3.7, z: 1.6, h: 0 }, { x: 3.7, z: -4.6, h: PI }, { x: -3.7, z: -1.5, h: 0 }, { x: -3.7, z: 2, h: PI }],
    cones: [{ x: 1.8, z: -6 }], walls: [{ x: 4.75, z: 0, h: 0, w: 0.5, l: 16 }],
  },
  {
    name: 'Stadium Night', w: 10, l: 16, par: 18,
    start: { x: -3.8, z: 6.2, h: PI },
    spot: { x: 2.7, z: -5.6, h: 0, ...room(0.45, 0.7) },
    cars: [{ x: -4, z: -5.6, h: 0 }, { x: -2.7, z: -5.6, h: PI }, { x: -1.4, z: -5.6, h: 0 }, { x: 0, z: -5.6, h: 0 }, { x: 1.35, z: -5.6, h: PI }, { x: 4, z: -5.6, h: 0 },
      { x: -4, z: -0.3, h: HALF }, { x: -2.2, z: -0.3, h: HALF }, { x: 0.8, z: -0.3, h: -HALF }, { x: 2.6, z: -0.3, h: HALF }],
    cones: [{ x: -0.7, z: 3.5 }, { x: 0.7, z: 3.5 }], walls: [{ x: 0, z: -7.4, h: 0, w: 10, l: 0.4 }],
  },
  {
    name: 'Pro Valet', w: 10, l: 16, par: 20,
    start: { x: 0, z: 6.2, h: PI },
    spot: { x: -3.7, z: -4.2, h: 0, w: 1.0, l: PARK_LEN + 0.7 },
    cars: [{ x: -3.7, z: -1.2, h: 0 }, { x: -3.7, z: -7, h: 0 }, { x: 3.7, z: -4, h: PI }, { x: 3.7, z: -1, h: PI }, { x: 3.7, z: 2, h: 0 }],
    cones: [{ x: -1, z: 3.8 }, { x: 1, z: 2.2 }, { x: -1, z: 0.6 }, { x: 1, z: -1 }],
    walls: [{ x: -4.75, z: 0, h: 0, w: 0.5, l: 16 }],
  },
]

// A cone stands on a square rubber base; that's what you see from above and what you hit.
export const CONE_BASE = 0.4
// The kerb round the lot, as four thick slabs just outside its edges.
const KERB = 3

export { corners }
export const boxesHit = (a: Box, b: Box) => boxPush(a, b) !== null

const inside = (b: Box, [x, z]: [number, number]) => {
  const c = Math.cos(b.h), s = Math.sin(b.h)
  const dx = x - b.x, dz = z - b.z
  return Math.abs(dx * c - dz * s) <= b.w / 2 + 1e-6 && Math.abs(dx * s + dz * c) <= b.l / 2 + 1e-6
}

// Parked: every corner of the car sits inside the spot (either way round counts).
export const parkedIn = (car: Box, spot: Box) => corners(car).every((p) => inside(spot, p))

// Everything solid in a lot, drawn size for drawn size: its kerbs, the walls with their
// capstones, each parked car's own footprint (the scene measures them) and the cone bases.
export function lotSolids(lot: ParkLot, parked: Box[] = lot.cars.map((p) => ({ ...p, w: PARKED_W, l: PARK_LEN }))): Solid[] {
  const W = lot.w / 2, L = lot.l / 2
  return [
    { x: -W - KERB / 2, z: 0, h: 0, w: KERB, l: lot.l + KERB * 2 },
    { x: W + KERB / 2, z: 0, h: 0, w: KERB, l: lot.l + KERB * 2 },
    { x: 0, z: -L - KERB / 2, h: 0, w: lot.w + KERB * 2, l: KERB },
    { x: 0, z: L + KERB / 2, h: 0, w: lot.w + KERB * 2, l: KERB },
    ...lot.walls.map((w) => ({ ...w, w: w.w + 0.06, l: w.l + 0.06 })),
    ...parked,
    ...lot.cones.map((c) => ({ x: c.x, z: c.z, h: 0, w: CONE_BASE, l: CONE_BASE })),
  ]
}

export const carHits = (car: Box, lot: ParkLot, parked?: Box[]) => lotSolids(lot, parked).some((s) => hits(car, s))

// Bicycle steering: speed in units/s, steer in radians, wheelbase from the car length.
export function drive(p: Pose, speed: number, steer: number, dt: number): Pose {
  const h = p.h + (speed / (PARK_LEN * 0.62)) * Math.tan(steer) * dt
  return { x: p.x + Math.sin(h) * speed * dt, z: p.z + Math.cos(h) * speed * dt, h }
}

export function parkStars(time: number, bumps: number, par: number) {
  if (bumps === 0 && time <= par) return 3
  if (bumps <= 1 && time <= par * 1.7) return 2
  return 1
}

export function parkReward(lot: number, stars: number, level: number) {
  if (stars <= 0) return { coins: 0, xp: 0 }
  const base = (90 + 30 * level) * (1 + lot * 0.12)
  return { coins: Math.round((base * [0, 0.5, 0.75, 1][stars]) / 5) * 5, xp: 6 + stars * 4 + lot }
}

// Best scores and lot stars stay on this device; they're bragging rights, not currency.
const KEY = 'cartopia-arcade'
type Bests = { chase: number; park: number[] }
export function loadBests(): Bests {
  try {
    const b = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return { chase: Number(b.chase) || 0, park: Array.isArray(b.park) ? b.park.map((n: unknown) => Number(n) || 0) : [] }
  } catch {
    return { chase: 0, park: [] }
  }
}
export function saveBests(b: Bests) {
  try {
    localStorage.setItem(KEY, JSON.stringify(b))
  } catch {
    // Private mode: bests just don't stick.
  }
}
// Lots open one after another: clear a lot with any stars to open the next.
export const lotOpen = (stars: number[], i: number) => i === 0 || (stars[i - 1] ?? 0) > 0
