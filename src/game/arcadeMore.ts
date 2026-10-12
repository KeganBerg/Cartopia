// Rules and payouts for the second wave of arcade games: Pit Stop, Car Wash Frenzy,
// Delivery Dash and Stunt Ramp. Every run ends in 0-3 stars; pay follows the stars,
// small like a quick race, so the server's usual earning limits cover it.

import type { Box } from './collide'

export type StarGameId = 'pit' | 'wash' | 'delivery' | 'stunt'

export function starReward(stars: number, level: number) {
  if (stars <= 0) return { coins: 0, xp: 0 }
  return { coins: Math.round(((80 + 25 * level) * [0, 0.5, 0.75, 1][stars]) / 5) * 5, xp: 6 + stars * 4 }
}

// ---------- Pit Stop ----------
// A whole stop: brake onto the box marks, run all four wheel guns at once (each corner's
// ring fills; tap when it's green to undo the nut, the crew swaps the wheel, tap again to
// do it up), then go the moment the lollipop turns green. The clock stops while the
// lollipop man holds you for traffic, so only what the player does counts.
export const PIT_WHEELS = 4
export const PIT_SPEED = 8 // pit lane limiter, world units a second
export const PIT_BRAKE = 12 // slowing while the brake is held
export const PIT_COAST = 0 // off the brake the limiter holds the speed
export const PIT_START = -17 // where the car enters, the box is at 0
export const PIT_PUSH = 0.45 // seconds lost per unit the crew must push the car to the marks
export const GUN_SLIP = 0.6 // a tap before green slips the nut: the ring drops back this far
export const PIT_JUMP = 1 // seconds added for going before the lollipop turns green

// How long each corner's ring takes to fill, for undoing then doing up the nut.
export function gunTimes(rand: () => number, wheels = PIT_WHEELS) {
  return Array.from({ length: wheels }, () => [0.5 + rand() * 0.45, 0.5 + rand() * 0.45] as [number, number])
}
// Where the car rolls to from `speed` with the brake held for the whole way.
export const brakeDistance = (speed: number) => (speed * speed) / (2 * PIT_BRAKE)
// How the stop went, from how far the car is past (+) or short of (-) the marks.
export type StopGrade = 'perfect' | 'good' | 'short' | 'long'
export function stopGrade(err: number): StopGrade {
  const e = Math.abs(err)
  return e <= 0.2 ? 'perfect' : e <= 0.5 ? 'good' : err < 0 ? 'short' : 'long'
}
// Seconds lost pushing the car onto the marks after a sloppy stop.
export function stopPenalty(err: number) {
  const e = Math.abs(err)
  return e <= 0.5 ? 0 : Math.min(2.5, 0.3 + (e - 0.5) * PIT_PUSH)
}
export function pitStars(time: number) {
  return time <= 5.8 ? 3 : time <= 7.5 ? 2 : 1
}

// ---------- Car Wash Frenzy ----------
// Mud spots on the car; each needs this much scrubbing (pointer travel in screen pixels).
export const WASH_TIME = 25
export const WASH_SPOTS = 12
export const SCRUB_PX = 260
export function washStars(cleaned: number, total: number, timeLeft: number) {
  if (cleaned < total) return cleaned >= total * 0.75 ? 1 : 0
  return timeLeft >= 8 ? 3 : timeLeft >= 3 ? 2 : 1
}

// ---------- Delivery Dash ----------
// Pick up at the pizza place, drop at the glowing house, beat the clock. Each drop adds time.
export const DASH_TIME = 45
export const DASH_BONUS = 12
export function dashStars(drops: number) {
  return drops >= 6 ? 3 : drops >= 4 ? 2 : drops >= 2 ? 1 : 0
}
// The town is a grid of blocks with roads between them.
export const BLOCK = 7 // block size (world units)
export const STREET = 3 // road width
export const GRID = 4 // blocks per side
export const CELL = BLOCK + STREET
export const TOWN = GRID * CELL + STREET // full width, roads on every edge
export const blockCentre = (i: number) => -TOWN / 2 + STREET + BLOCK / 2 + i * CELL
// Drive targets sit on the road beside a block's middle (side 0..3 = -z, +x, +z, -x).
export function kerbSpot(bx: number, bz: number, side: number) {
  const cx = blockCentre(bx), cz = blockCentre(bz)
  const off = BLOCK / 2 + STREET / 2
  return [[cx, cz - off], [cx + off, cz], [cx, cz + off], [cx - off, cz]][side] as [number, number]
}
export function insideBlock(x: number, z: number, pad: number) {
  for (let i = 0; i < GRID; i++) {
    const cx = blockCentre(i)
    if (Math.abs(x - cx) < BLOCK / 2 + pad) {
      for (let j = 0; j < GRID; j++) if (Math.abs(z - blockCentre(j)) < BLOCK / 2 + pad) return true
    }
  }
  return Math.abs(x) > TOWN / 2 - pad || Math.abs(z) > TOWN / 2 - pad
}

// What a delivery car can't drive through: each block's raised sidewalk, kerb edge to
// kerb edge (the lamps, hydrants, trees and shops all stand on it), and the end of the
// asphalt all round town.
const EDGE = 4
export const TOWN_SOLIDS: Box[] = [
  ...Array.from({ length: GRID * GRID }, (_, i) => ({ x: blockCentre(i % GRID), z: blockCentre(Math.floor(i / GRID)), h: 0, w: BLOCK, l: BLOCK })),
  { x: -TOWN / 2 - EDGE / 2, z: 0, h: 0, w: EDGE, l: TOWN + EDGE * 2 },
  { x: TOWN / 2 + EDGE / 2, z: 0, h: 0, w: EDGE, l: TOWN + EDGE * 2 },
  { x: 0, z: -TOWN / 2 - EDGE / 2, h: 0, w: TOWN + EDGE * 2, l: EDGE },
  { x: 0, z: TOWN / 2 + EDGE / 2, h: 0, w: TOWN + EDGE * 2, l: EDGE },
]
// The pickup and drop-off ring painted on the road: you're there once the middle of
// your car is inside its outer edge.
export const DROP_R = 1.05
export const DROP_LINE = 0.2 // the ring's painted width
export const atDrop = (x: number, z: number, spot: { x: number; z: number }) => Math.hypot(x - spot.x, z - spot.z) <= DROP_R

// ---------- Stunt Ramp ----------
// Three jumps. Stop the power needle, then hold to flip in the air and let go to land flat.
export const STUNT_JUMPS = 3
export const GRAVITY = 18
// Power 0..1 (from the needle) sets take-off speed; the sweet spot is near the top.
export const launchSpeed = (power: number) => 9 + power * 9
// How far the car flies off a ramp of this angle, landing back at take-off height.
export function jumpLength(power: number, angle = 0.5) {
  const v = launchSpeed(power)
  return (v * v * Math.sin(2 * angle)) / GRAVITY
}
// A landing is clean when the car is within this many radians of flat.
export const LAND_OK = 0.45
export function landed(spin: number) {
  const r = ((spin % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  return Math.min(r, Math.PI * 2 - r) <= LAND_OK
}
export const flips = (spin: number) => Math.floor((Math.abs(spin) + LAND_OK) / (Math.PI * 2))
// One jump's points: distance, a big bonus per flip, nothing if you crash.
export function jumpScore(dist: number, spin: number) {
  return landed(spin) ? Math.round(dist * 10) + flips(spin) * 150 : 0
}
export function stuntStars(score: number) {
  return score >= 900 ? 3 : score >= 500 ? 2 : score >= 150 ? 1 : 0
}

// ---------- Bests ----------
// Best stars and best result per game, on this device only (like the first arcade games).
// Pit Stop's best is the fastest time; the others keep the highest number.
export type StarBest = { stars: number; best: number }
export type StarBests = Record<StarGameId, StarBest>
const KEY = 'cartopia-arcade-stars'
const EMPTY: StarBests = { pit: { stars: 0, best: 0 }, wash: { stars: 0, best: 0 }, delivery: { stars: 0, best: 0 }, stunt: { stars: 0, best: 0 } }
export const lowerIsBetter = (id: StarGameId) => id === 'pit'
export function loadStars(): StarBests {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    const out = { ...EMPTY }
    for (const id of Object.keys(EMPTY) as StarGameId[]) {
      const v = raw?.[id]
      if (v && typeof v.stars === 'number' && typeof v.best === 'number') out[id] = { stars: Math.max(0, Math.min(3, v.stars)), best: v.best }
    }
    return out
  } catch {
    return { ...EMPTY }
  }
}
// Records a finished run; returns true when the result beats the old best.
export function recordStars(id: StarGameId, stars: number, result: number) {
  const all = loadStars()
  const old = all[id]
  const better = stars > 0 && (old.best === 0 || (lowerIsBetter(id) ? result < old.best : result > old.best))
  all[id] = { stars: Math.max(old.stars, stars), best: better ? result : old.best }
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // Private mode: bests just don't stick.
  }
  return better
}
