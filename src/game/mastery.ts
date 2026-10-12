// Mastery, like camo ladders: a ladder per car, then per class, then everything.
//   * Per car model, four steps earned only by racing it: Bronze, Silver, Signature, Master.
//     Every drag race in a car counts (time trials and ghost runs don't), in any mode. Each step
//     pays gems once; Signature also unlocks the Signature pattern for that car.
//   * Per class (game/classes.ts): Gold once CLASS_GOLD cars in it are mastered, Diamond once
//     CLASS_DIAMOND are (or every car, in a smaller class). Each unlocks that finish for every car
//     in the class, and only that class.
//   * Galaxy: Diamond in every class unlocks the Galaxy finish on every car.
// The server guard (econ_guard(), catalog key `mastery`) pays the same gems and trophies and
// checks the counts against the save's race wins. Class tiers pay looks, not gems.

import { PAINTS } from './data'
import { CAR_CLASSES, carsInClass, classesOf, inClass, type CarClassId } from './classes'

export type MasteryMode = 'drag' | 'campaign' | 'rival' | 'tuner' | 'tour' | 'event' | 'live' | 'cup' | 'gp'
// Saved per car model: races finished, races won, the modes won in, wins over a car with
// a higher PI, and how many tiers have been reached (and paid).
export type Mastery = { races: number; wins: number; modes: MasteryMode[]; upsets: number; tier: number }

export type MasteryTier = {
  id: 'bronze' | 'silver' | 'signature' | 'master'; name: string; icon: string
  bucks: number; trophies: number
  // What this tier needs on top of the tiers before it.
  need: { races?: number; wins?: number; modes?: number; upsets?: number }
}
export const MASTERY_TIERS: MasteryTier[] = [
  { id: 'bronze', name: 'Bronze', icon: '🥉', bucks: 1, trophies: 0, need: { races: 10 } },
  { id: 'silver', name: 'Silver', icon: '🥈', bucks: 1, trophies: 0, need: { wins: 10 } },
  { id: 'signature', name: 'Signature', icon: '✍️', bucks: 1, trophies: 0, need: { modes: 3 } },
  { id: 'master', name: 'Master', icon: '🎖️', bucks: 2, trophies: 5, need: { upsets: 5 } },
]

export const emptyMastery = (): Mastery => ({ races: 0, wins: 0, modes: [], upsets: 0, tier: 0 })

// A rival's id says which mode the race was in (see the rival builders in ui/Race.tsx).
// Solo runs (time trials, ghosts) return null: they don't count.
export function masteryMode(rivalId: string): MasteryMode | null {
  if (rivalId === 'trial' || rivalId === 'ghost') return null
  if (rivalId.startsWith('live:')) return 'live'
  const pre = rivalId.split('-')[0]
  if (pre === 'camp') return 'campaign'
  if (pre === 'row' || pre === 'rival') return 'rival'
  if (pre === 'tuner' || pre === 'tour' || pre === 'event' || pre === 'cup' || pre === 'gp') return pre
  return 'drag'
}

// How far a car is towards one need: [have, of].
export function needProgress(m: Mastery, t: MasteryTier): [number, number][] {
  const n = t.need
  const out: [number, number][] = []
  if (n.races) out.push([Math.min(m.races, n.races), n.races])
  if (n.wins) out.push([Math.min(m.wins, n.wins), n.wins])
  if (n.modes) out.push([Math.min(m.modes.length, n.modes), n.modes])
  if (n.upsets) out.push([Math.min(m.upsets, n.upsets), n.upsets])
  return out
}
const met = (m: Mastery, t: MasteryTier) => needProgress(m, t).every(([a, b]) => a >= b)

// The tiers a car has reached, in order: a tier only counts once the ones before it have.
export function tierReached(m: Mastery) {
  let n = 0
  while (n < MASTERY_TIERS.length && met(m, MASTERY_TIERS[n])) n++
  return n
}

// One finished race in this car. Returns the new counts and the tiers it newly reached.
export function noteRace(m: Mastery | undefined, won: boolean, mode: MasteryMode, upset: boolean) {
  const cur = m ?? emptyMastery()
  const next: Mastery = {
    races: cur.races + 1,
    wins: cur.wins + (won ? 1 : 0),
    modes: won && !cur.modes.includes(mode) ? [...cur.modes, mode] : cur.modes,
    upsets: cur.upsets + (won && upset ? 1 : 0),
    tier: cur.tier,
  }
  next.tier = Math.max(cur.tier, tierReached(next))
  return { next, reached: MASTERY_TIERS.slice(cur.tier, next.tier) }
}

export const masteryTier = (all: Record<string, Mastery> | undefined, model: string) => all?.[model]?.tier ?? 0
// The tier that shows on a car: its highest one, if any.
export const masteryBadge = (tier: number) => (tier > 0 ? MASTERY_TIERS[Math.min(tier, MASTERY_TIERS.length) - 1] : null)

// ---- Class mastery ----
export const CLASS_GOLD = 3
export const CLASS_DIAMOND = 6
export type ClassTier = { id: 'gold' | 'diamond' | 'galaxy'; name: string; icon: string }
export const CLASS_TIERS: ClassTier[] = [
  { id: 'gold', name: 'Gold', icon: '🥇' },
  { id: 'diamond', name: 'Diamond', icon: '💎' },
  { id: 'galaxy', name: 'Galaxy', icon: '🌌' },
]

// Car models mastered (every step) in a class.
export const masteredIn = (all: Record<string, Mastery> | undefined, cls: CarClassId) =>
  carsInClass(cls).filter((c) => (all?.[c.id]?.tier ?? 0) >= MASTERY_TIERS.length).length
// What each class tier needs: never more cars than the class has.
export const classNeed = (cls: CarClassId) => {
  const n = carsInClass(cls).length
  return { gold: Math.min(CLASS_GOLD, n), diamond: Math.min(CLASS_DIAMOND, n) }
}
// A class's tier: 0 none, 1 Gold, 2 Diamond.
export function classTier(all: Record<string, Mastery> | undefined, cls: CarClassId) {
  const have = masteredIn(all, cls)
  const need = classNeed(cls)
  return have >= need.diamond ? 2 : have >= need.gold ? 1 : 0
}
export const galaxy = (all: Record<string, Mastery> | undefined) => CAR_CLASSES.every((c) => classTier(all, c.id) >= 2)
// The best class tier any of a car's classes has, or 3 with Galaxy: what finishes it can wear.
export function carClassTier(all: Record<string, Mastery> | undefined, model: string) {
  if (galaxy(all)) return 3
  return Math.max(0, ...classesOf(model).map((c) => classTier(all, c.id)))
}

// ---- Car challenges ----
// The first win in a car of each class unlocks that class's colour (data.ts PAINTS with earn 'first').
const FIRST_PAINT: Record<CarClassId, string> = {
  compact: 'Bubblegum Pop', muscle: 'Zest', sport: 'Paddock Green', super: 'Afterburner', offroad: 'Sandstorm', oddball: 'Rust Orange',
}
export const firstPaint = (cls: CarClassId) => PAINTS.find((p) => p.earn === 'first' && p.name === FIRST_PAINT[cls])!.color
export const firstPaintClass = (color: string) => CAR_CLASSES.find((c) => firstPaint(c.id) === color)
// Has any car of this class won a race yet?
export const classWon = (all: Record<string, Mastery> | undefined, cls: CarClassId) =>
  Object.entries(all ?? {}).some(([model, m]) => m.wins > 0 && inClass(model, cls))
