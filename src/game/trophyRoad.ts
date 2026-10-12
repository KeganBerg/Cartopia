// Trophy Road: every ROAD_STEP trophies is a stop. Every stop pays coins and parts, rising for
// the first ROAD_STOPS stops and then the same for ever. Every MYSTERY_EVERY-th stop also opens a
// mystery cosmetic, like a loot crate: a random one, not yet won, from ROAD_POOL (colours from
// data.ts PAINTS with earn 'road', for the body, a panel or the wheels, and patterns from PATTERNS
// with road), none of which can be bought. Trophies are never spent: the save keeps how many stops
// were claimed (`road`) and the cosmetics won, in order (`roadItems`). The server guard
// (econ_guard(), catalog key `road`) pays the same coins and parts and won't let a claim run
// past the trophies.
import { PAINTS, PATTERNS } from './data'

export const ROAD_STEP = 25
export const ROAD_STOPS = 20
export const MYSTERY_EVERY = 3

// Coins and parts at stop i (0-based: stop 0 is at ROAD_STEP trophies).
export const roadPay = (i: number) => {
  const n = Math.min(i, ROAD_STOPS)
  return { coins: 2000 + 400 * n, parts: 5 + n }
}
export const roadMystery = (i: number) => i % MYSTERY_EVERY === MYSTERY_EVERY - 1
export const roadTrophies = (i: number) => (i + 1) * ROAD_STEP
// How many stops these trophies reach.
export const roadReached = (trophies: number) => Math.max(0, Math.floor(trophies / ROAD_STEP))

// What the mystery stops can give: road colours (by colour) and road patterns (by id).
export const ROAD_POOL: string[] = [...PAINTS.filter((p) => p.earn === 'road').map((p) => p.color), ...PATTERNS.filter((p) => p.road).map((p) => p.id)]

// A random cosmetic not yet won, or null once the pool is all won.
export function roadDraw(won: string[], rand: () => number = Math.random) {
  const left = ROAD_POOL.filter((x) => !won.includes(x))
  return left.length ? left[Math.floor(rand() * left.length)] : null
}

// Claims stops [from, to): the coins and parts, and the cosmetics drawn for the mystery stops.
export function roadClaim(from: number, to: number, won: string[], rand: () => number = Math.random) {
  let coins = 0
  let parts = 0
  const items = [...won]
  for (let i = from; i < to; i++) {
    const p = roadPay(i)
    coins += p.coins
    parts += p.parts
    if (roadMystery(i)) {
      const x = roadDraw(items, rand)
      if (x) items.push(x)
    }
  }
  return { coins, parts, items }
}

export const roadOpen = (won: string[] | undefined, id: string) => !!won?.includes(id)
