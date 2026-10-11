// Crates: bought with coins (Street, Garage) or gems (Gold, Diamond). Each holds one prize:
// coins, a part for one of your cars, or a car. Cars only come from what your level has already
// unlocked in the Showroom, so a crate never skips a level gate. A signed-in player's crates are
// rolled by the server (crate_open() in supabase/migrations/0040_crates.sql, same tables and
// rules); guests roll here. crates.test.ts keeps the server's tables in step.
import { CARS, MODS, carDef, modDef, modFits, ownedMods, type CarDef, type ModDef } from './data'

export type CrateId = 'street' | 'garage' | 'gold' | 'diamond'
export type ModTier = 'basic' | 'pro' | 'gem'
export type CrateOdds = { coins: number; jackpot: number; mod: number; car: number }

export type CrateDef = {
  id: CrateId
  name: string
  pay: 'coins' | 'bucks'
  unlockLevel: number
  // Price: base + perLevel x level (coins), or a flat gem price.
  base: number
  perLevel: number
  // Weights out of 100.
  odds: CrateOdds
  // Coin prizes as a share of what the crate is worth (see crateValue).
  coinMult: [number, number]
  jackpotMult: [number, number]
  // Which parts it can hold.
  mods: ModTier[]
  // The dearest car it can hold, as a multiple of what the crate is worth.
  carCap: number
  // Whether gem-priced Showroom cars are in it.
  gemCars: boolean
  // Look of the crate in the depot.
  look: { wood: string; band: string; glow: string }
}

export const CRATES: CrateDef[] = [
  {
    id: 'street', name: 'Street Crate', pay: 'coins', unlockLevel: 2, base: 300, perLevel: 120,
    odds: { coins: 62, jackpot: 6, mod: 28, car: 4 }, coinMult: [0.6, 1.1], jackpotMult: [2, 3],
    mods: ['basic'], carCap: 4, gemCars: false, look: { wood: '#b7844f', band: '#5d6670', glow: '#64b5f6' },
  },
  {
    id: 'garage', name: 'Garage Crate', pay: 'coins', unlockLevel: 6, base: 1500, perLevel: 500,
    odds: { coins: 48, jackpot: 8, mod: 32, car: 12 }, coinMult: [0.6, 1.1], jackpotMult: [2, 3],
    mods: ['basic', 'pro'], carCap: 8, gemCars: false, look: { wood: '#2e7d4f', band: '#cfd8dc', glow: '#69f0ae' },
  },
  {
    id: 'gold', name: 'Gold Crate', pay: 'bucks', unlockLevel: 3, base: 8, perLevel: 0,
    odds: { coins: 42, jackpot: 6, mod: 34, car: 18 }, coinMult: [0.6, 1.1], jackpotMult: [2, 3],
    mods: ['pro', 'gem'], carCap: 6, gemCars: false, look: { wood: '#d4a017', band: '#7a4b12', glow: '#ffd54f' },
  },
  {
    id: 'diamond', name: 'Diamond Crate', pay: 'bucks', unlockLevel: 8, base: 25, perLevel: 0,
    odds: { coins: 28, jackpot: 6, mod: 30, car: 36 }, coinMult: [0.8, 1.3], jackpotMult: [2.5, 3.5],
    mods: ['gem'], carCap: 6, gemCars: true, look: { wood: '#4fc3f7', band: '#e1f5fe', glow: '#b388ff' },
  },
]

export const crateDef = (id: string) => CRATES.find((c) => c.id === id)

// Roughly what a gem buys at this level, in coins (five fuel's worth of jobs).
export const GEM_COINS = { base: 300, perLevel: 100 }
export const gemCoins = (level: number) => GEM_COINS.base + GEM_COINS.perLevel * level
export const cratePrice = (c: CrateDef, level: number) => c.base + c.perLevel * level
export const crateCost = (c: CrateDef, level: number) =>
  c.pay === 'coins' ? { coins: cratePrice(c, level), bucks: 0 } : { coins: 0, bucks: cratePrice(c, level) }
// What a crate is worth in coins: its coin price, or its gems at gemCoins.
export const crateValue = (c: CrateDef, level: number) => (c.pay === 'coins' ? cratePrice(c, level) : cratePrice(c, level) * gemCoins(level))

export const modTier = (m: ModDef): ModTier => (m.bucks ? 'gem' : m.parts ? 'pro' : 'basic')
export const carValue = (car: CarDef, level: number) => car.price + (car.bucks ?? 0) * gemCoins(level)

// Cars a crate can hold at this level: Showroom cars the level has unlocked, up to its price cap.
export function crateCars(c: CrateDef, level: number): CarDef[] {
  const cap = crateValue(c, level) * c.carCap
  return CARS.filter((car) => !car.parked && !car.rescueOnly && !car.season && car.unlockLevel <= level && (c.gemCars || !car.bucks) && carValue(car, level) <= cap)
}

// The chance of each car among the car prizes: cheaper cars are likelier (weight 1 / value).
export function carOdds(c: CrateDef, level: number): { model: string; p: number }[] {
  const cars = crateCars(c, level)
  const total = cars.reduce((a, car) => a + 1 / carValue(car, level), 0)
  return cars.map((car) => ({ model: car.id, p: 1 / carValue(car, level) / total }))
}

type CarLike = { uid: string; model: string; mods?: string[] | null; ownedMods?: string[] | null }

// Parts a crate could give: for each of your cars, the parts of its tiers that fit it, that your
// level has unlocked and that the car doesn't already have.
export function modChoices(c: CrateDef, level: number, cars: CarLike[]): { car: string; mods: string[] }[] {
  const out: { car: string; mods: string[] }[] = []
  for (const car of cars) {
    const def = carDef(car.model)
    if (def.parked) continue
    const have = ownedMods(car)
    const mods = MODS.filter((m) => c.mods.includes(modTier(m)) && m.unlockLevel <= level && modFits(m, def.body) && !have.includes(m.id)).map((m) => m.id)
    if (mods.length) out.push({ car: car.uid, mods })
  }
  return out
}

// What a duplicate car turns into: 40% of its value, kept between half and 1.5x the crate's worth.
export const dupeCoins = (c: CrateDef, level: number, car: CarDef) => {
  const v = crateValue(c, level)
  return roundCoins(Math.min(v * 1.5, Math.max(v * 0.5, carValue(car, level) * 0.4)))
}
const roundCoins = (n: number) => Math.max(10, Math.round(n / 10) * 10)

export type CrateDrop =
  | { kind: 'coins'; coins: number; jackpot: boolean }
  | { kind: 'car'; model: string; uid: string; color: string }
  | { kind: 'dupe'; model: string; coins: number }
  | { kind: 'mod'; car: string; mod: string }
export type CrateOpen = { seq?: number; crate: CrateId; cost: { coins: number; bucks: number }; drop: CrateDrop }

const newUid = (rand: () => number) => 'k' + Array.from({ length: 14 }, () => Math.floor(rand() * 36).toString(36)).join('')

function pickWeighted<T>(items: T[], weight: (t: T) => number, rand: () => number): T {
  const total = items.reduce((a, t) => a + weight(t), 0)
  let r = rand() * total
  for (const t of items) {
    r -= weight(t)
    if (r <= 0) return t
  }
  return items[items.length - 1]
}

// Rolls one crate for a player at this level with these cars. A part with nothing left to fit, or
// a car prize with no cars in reach, becomes a coin prize instead.
export function rollCrate(c: CrateDef, level: number, cars: CarLike[], rand: () => number = Math.random): CrateDrop {
  const v = crateValue(c, level)
  const kinds = Object.entries(c.odds) as [keyof CrateOdds, number][]
  let kind = pickWeighted(kinds, (k) => k[1], rand)[0]
  if (kind === 'mod') {
    const choices = modChoices(c, level, cars)
    if (choices.length) {
      const pick = choices[Math.floor(rand() * choices.length)]
      return { kind: 'mod', car: pick.car, mod: pick.mods[Math.floor(rand() * pick.mods.length)] }
    }
    kind = 'coins'
  }
  if (kind === 'car') {
    const pool = crateCars(c, level)
    if (pool.length) {
      const car = pickWeighted(pool, (x) => 1 / carValue(x, level), rand)
      if (cars.some((o) => o.model === car.id)) return { kind: 'dupe', model: car.id, coins: dupeCoins(c, level, car) }
      return { kind: 'car', model: car.id, uid: newUid(rand), color: car.colors[Math.floor(rand() * car.colors.length)] }
    }
    kind = 'coins'
  }
  const [lo, hi] = kind === 'jackpot' ? c.jackpotMult : c.coinMult
  return { kind: 'coins', coins: roundCoins(v * (lo + (hi - lo) * rand())), jackpot: kind === 'jackpot' }
}

// How exciting a prize is, for the reveal's glow: 0 coins, 1 a jackpot or part, 2 a gem part, 3 a new car.
export function dropTier(d: CrateDrop): 0 | 1 | 2 | 3 {
  if (d.kind === 'car') return 3
  if (d.kind === 'mod') return modDef(d.mod)?.bucks ? 2 : 1
  if (d.kind === 'coins' && d.jackpot) return 1
  return 0
}

// The odds as a player sees them: coins (with jackpots), parts and cars, in whole percent.
export function crateOddsShown(c: CrateDef) {
  const t = c.odds.coins + c.odds.jackpot + c.odds.mod + c.odds.car
  return { coins: Math.round(((c.odds.coins + c.odds.jackpot) / t) * 100), mod: Math.round((c.odds.mod / t) * 100), car: Math.round((c.odds.car / t) * 100) }
}

// The tables crate_open() rolls from, as embedded in the server's SQL.
export function crateTables() {
  return {
    crates: Object.fromEntries(CRATES.map((c) => [c.id, {
      pay: c.pay, unlock: c.unlockLevel, base: c.base, perLevel: c.perLevel, odds: c.odds,
      coinMult: c.coinMult, jackpotMult: c.jackpotMult, mods: c.mods, carCap: c.carCap, gemCars: c.gemCars,
    }])),
    gem: GEM_COINS,
    // Every car's body (parts are rolled for any car you own); `pool` marks the ones a crate can hold.
    cars: Object.fromEntries(CARS.map((car) => [car.id, {
      body: car.body, pool: !car.rescueOnly && !car.season, unlock: car.unlockLevel, price: car.price, bucks: car.bucks ?? 0, colors: car.colors,
    }])),
    mods: Object.fromEntries(MODS.map((m) => [m.id, {
      tier: modTier(m), unlock: m.unlockLevel, ...(m.only ? { only: m.only } : {}), ...(m.notOn ? { notOn: m.notOn } : {}),
    }])),
  }
}
