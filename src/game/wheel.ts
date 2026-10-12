// The daily prize wheel: one free spin a UTC day, in place of the old daily log-in bonus. Eight
// slices, each one prize; the more a slice gives, the rarer it is. A signed-in player's spin is
// rolled by the server (wheel_spin() in supabase/pending/wheel_spin.sql) and kept in crate_opens
// like a crate open, so the save guard already pays it; guests roll here. wheel.test.ts keeps the
// server's table in step.
//   coins: a share of what a Street Crate costs at your level, so it grows as you do.
//   gems: a few gems (the jackpot is a pile of them).
//   part: a part for one of your cars, from the Garage Crate's parts (the Street's when none fit).
//   skin: a body or part skin of the Garage Crate's tiers; one you have already pays coins.
import { cratePrice, crateDef, crateSkins, modChoices, SKIN_WEIGHT, type CrateDrop, type CrateOpen, type OwnedSkins } from './crates'

export type WheelTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
export type WheelSlice =
  | { id: string; kind: 'coins'; mult: number; weight: number; tier: WheelTier }
  | { id: string; kind: 'gems'; gems: number; weight: number; tier: WheelTier }
  | { id: string; kind: 'jackpot'; gems: number; weight: number; tier: WheelTier }
  | { id: string; kind: 'part'; weight: number; tier: WheelTier }
  | { id: string; kind: 'skin'; weight: number; tier: WheelTier }

// In order round the wheel, clockwise from the top. Weights add up to 100.
export const WHEEL: WheelSlice[] = [
  { id: 'coins-s', kind: 'coins', mult: 0.3, weight: 31, tier: 'common' },
  { id: 'part', kind: 'part', weight: 14, tier: 'uncommon' },
  { id: 'coins-m', kind: 'coins', mult: 0.7, weight: 22, tier: 'common' },
  { id: 'gems-1', kind: 'gems', gems: 1, weight: 12, tier: 'uncommon' },
  { id: 'coins-l', kind: 'coins', mult: 2, weight: 9, tier: 'rare' },
  { id: 'skin', kind: 'skin', weight: 4, tier: 'epic' },
  { id: 'gems-3', kind: 'gems', gems: 3, weight: 7, tier: 'rare' },
  { id: 'jackpot', kind: 'jackpot', gems: 15, weight: 1, tier: 'legendary' },
]

// What a part or skin slice pays when there's no part left to fit or no skin to give, and what a
// skin you already have turns into.
export const WHEEL_FALLBACK = 'coins-m'
export const WHEEL_DUPE = 'coins-l'

export const TIER_COLOR: Record<WheelTier, string> = {
  common: '#42a5f5', uncommon: '#43c463', rare: '#ab47bc', epic: '#ff7043', legendary: '#ffc400',
}

export const wheelSlice = (id: string) => WHEEL.find((s) => s.id === id)
const roundCoins = (n: number) => Math.max(10, Math.round(n / 10) * 10)
const street = () => crateDef('street')!
const garage = () => crateDef('garage')!

// The coins a coin slice pays at this level.
export const wheelCoins = (mult: number, level: number) => roundCoins(cratePrice(street(), level) * mult)

// A slice's chance in whole percent.
export const wheelPct = (s: WheelSlice) => (s.weight / WHEEL.reduce((a, x) => a + x.weight, 0)) * 100

export type WheelSpin = { slice: string; open: CrateOpen }
type CarLike = { uid: string; model: string; mods?: string[] | null; ownedMods?: string[] | null }

function coinsOpen(id: string, level: number, jackpotFlag = false): WheelSpin {
  const s = wheelSlice(id) as Extract<WheelSlice, { kind: 'coins' }>
  return { slice: id, open: { crate: 'wheel', cost: { coins: 0, bucks: 0 }, drop: { kind: 'coins', coins: wheelCoins(s.mult, level), jackpot: jackpotFlag } } }
}

// Spins the wheel for a guest. Gems are a negative gem cost, as the server stores them.
export function rollWheel(level: number, cars: CarLike[], owned: OwnedSkins, rand: () => number = Math.random): WheelSpin {
  const total = WHEEL.reduce((a, s) => a + s.weight, 0)
  let r = rand() * total
  let s = WHEEL[WHEEL.length - 1]
  for (const x of WHEEL) {
    r -= x.weight
    if (r <= 0) { s = x; break }
  }
  if (s.kind === 'coins') return coinsOpen(s.id, level)
  if (s.kind === 'gems' || s.kind === 'jackpot') {
    return { slice: s.id, open: { crate: 'wheel', cost: { coins: 0, bucks: -s.gems }, drop: { kind: 'coins', coins: 0, jackpot: s.kind === 'jackpot' } } }
  }
  if (s.kind === 'part') {
    const choices = modChoices(garage(), level, cars)
    if (!choices.length) return coinsOpen(WHEEL_FALLBACK, level)
    const pick = choices[Math.floor(rand() * choices.length)]
    return { slice: s.id, open: { crate: 'wheel', cost: { coins: 0, bucks: 0 }, drop: { kind: 'mod', car: pick.car, mod: pick.mods[Math.floor(rand() * pick.mods.length)] } } }
  }
  const pool = crateSkins(garage())
  if (!pool.length) return coinsOpen(WHEEL_FALLBACK, level)
  const sum = pool.reduce((a, x) => a + SKIN_WEIGHT[x.def.tier], 0)
  let q = rand() * sum
  let x = pool[pool.length - 1]
  for (const y of pool) {
    q -= SKIN_WEIGHT[y.def.tier]
    if (q <= 0) { x = y; break }
  }
  const have = (x.part ? owned.modSkins : owned.skins).includes(x.id)
  const drop: CrateDrop = have
    ? { kind: 'skindupe', skin: x.id, part: x.part, coins: wheelCoins((wheelSlice(WHEEL_DUPE) as { mult: number }).mult, level) }
    : { kind: 'skin', skin: x.id, part: x.part }
  return { slice: s.id, open: { crate: 'wheel', cost: { coins: 0, bucks: 0 }, drop } }
}

// The gems a spin gave (stored as a negative gem cost).
export const spinGems = (o: CrateOpen) => Math.max(0, -o.cost.bucks)

// The table wheel_spin() rolls from, as embedded in the server's SQL.
export function wheelTables() {
  return {
    slices: WHEEL.map((s) => ({ id: s.id, kind: s.kind, weight: s.weight, ...('mult' in s ? { mult: s.mult } : {}), ...('gems' in s ? { gems: s.gems } : {}) })),
    fallback: WHEEL_FALLBACK,
    dupe: WHEEL_DUPE,
  }
}
