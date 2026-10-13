// Hats: car toppers, worn on the roof (or the rider's helmet on a bike). Pure looks, no stats.
// Hats are never bought: each is won by its own challenge (`challenge`), and some also drop from
// crates (`crates`); a few, like the Crown and Top Hat, only come from crates. Challenges never
// reset and have no streaks. Each owned car wears at most one hat.
import type { CounterKey } from './data'
import type { CrateId } from './crates'

// How a hat's colours are chosen:
// 'fixed': one look. 'pick': one colour from HAT_PAINTS. 'twoTone': one colour, or two
// (the crown, then the front panel and brim). string[]: one of these colours.
export type HatColors = 'fixed' | 'pick' | 'twoTone' | string[]

// What a challenge counts: a save counter (game/data.ts COUNTERS) since hats arrived, or one of the
// hat tracks in HatQuest: different cars that won a race, kart Grand Prix race wins, arcade games.
export type HatStat = CounterKey | 'raceCars' | 'kartWins' | 'arcade'
export type HatChallenge = { name: string; icon: string; text: string; stat: HatStat; goal: number }

export type HatDef = {
  id: string
  name: string
  icon: string
  colors: HatColors
  // The colours it comes in when none are picked.
  base: string[]
  // How it's won. A hat with none only comes from crates.
  challenge?: HatChallenge
  // The crates it can drop from (game/crates.ts crateHats).
  crates?: CrateId[]
}

// What a car wears: the hat and its colours (none: the hat's base colours).
export type HatFit = { id: string; colors?: string[] }

// Challenge progress on the save. base: each counter when the save first had hats, so only what's
// done since counts; cars: models that have won a race since; kart and arcade: wins and games since.
export type HatQuest = { base: Partial<Record<CounterKey, number>>; cars: string[]; kart: number; arcade: number }
export const newHatQuest = (stats?: Partial<Record<CounterKey, number>>): HatQuest => ({ base: { ...(stats ?? {}) }, cars: [], kart: 0, arcade: 0 })

// Colours for hats you pick a colour for.
export const HAT_PAINTS: { color: string; name: string }[] = [
  { color: '#d32f2f', name: 'Red' },
  { color: '#ff7043', name: 'Orange' },
  { color: '#fdd835', name: 'Yellow' },
  { color: '#43a047', name: 'Green' },
  { color: '#1e88e5', name: 'Blue' },
  { color: '#1a237e', name: 'Navy' },
  { color: '#8e24aa', name: 'Purple' },
  { color: '#ec407a', name: 'Pink' },
  { color: '#fafafa', name: 'White' },
  { color: '#757575', name: 'Grey' },
  { color: '#212121', name: 'Black' },
  { color: '#6d4c41', name: 'Brown' },
]

export const COWBOY_COLORS = ['#8d5a2b', '#5d3a1a', '#212121']

const ch = (name: string, icon: string, text: string, stat: HatStat, goal: number): HatChallenge => ({ name, icon, text, stat, goal })

export const HATS: HatDef[] = [
  { id: 'cap', name: 'Baseball Cap', icon: '🧢', colors: 'twoTone', base: ['#d32f2f', '#fafafa'], challenge: ch('Rookie', '🏁', 'Win 3 races', 'racesWon', 3) },
  { id: 'backcap', name: 'Backwards Cap', icon: '🧢', colors: 'twoTone', base: ['#1e88e5', '#fafafa'], challenge: ch('Hot Streak', '🏁', 'Win 15 races', 'racesWon', 15) },
  { id: 'beanie', name: 'Beanie', icon: '🧶', colors: 'pick', base: ['#43a047'], challenge: ch('Scavenger', '🔍', "Search Rusty's yard 10 times", 'searches', 10) },
  { id: 'party', name: 'Party Hat', icon: '🥳', colors: 'pick', base: ['#ec407a'], challenge: ch('Arcade Party', '🕹️', 'Finish 10 arcade games', 'arcade', 10), crates: ['street', 'garage'] },
  { id: 'hardhat', name: 'Hard Hat', icon: '👷', colors: 'fixed', base: ['#fbc02d'], challenge: ch('Builder', '🏗', 'Place 10 buildings', 'built', 10) },
  { id: 'cone', name: 'Traffic Cone', icon: '🚧', colors: 'fixed', base: ['#ff6d00'], challenge: ch('Road Crew', '🛣', 'Lay 40 road tiles', 'roads', 40) },
  // TODO(car classes): make this "win races in 5 different Muscle cars" once the class tags land.
  { id: 'cowboy', name: 'Cowboy Hat', icon: '🤠', colors: COWBOY_COLORS, base: [COWBOY_COLORS[0]], challenge: ch('Rodeo', '🤠', 'Win races in 5 different cars', 'raceCars', 5) },
  { id: 'fez', name: 'Fez', icon: '🟥', colors: 'fixed', base: ['#c62828'], challenge: ch('Restorer', '🛠', 'Restore 3 rescued cars', 'rescued', 3) },
  { id: 'chef', name: 'Chef Hat', icon: '👨‍🍳', colors: 'fixed', base: ['#fafafa'], challenge: ch('Head Chef', '🍕', 'Collect from 75 businesses', 'jobs', 75) },
  { id: 'propeller', name: 'Propeller Cap', icon: '🌀', colors: 'fixed', base: ['#e53935'], challenge: ch('Tinkerer', '⬆', 'Do 20 upgrades', 'upgrades', 20), crates: ['garage', 'gold'] },
  { id: 'pinkcowboy', name: 'Pink Fuzzy Cowboy', icon: '💖', colors: 'fixed', base: ['#f06292'], challenge: ch('Paint Rodeo', '🎨', 'Paint 10 cars', 'painted', 10), crates: ['garage', 'gold'] },
  { id: 'sombrero', name: 'Sombrero', icon: '🪅', colors: 'fixed', base: ['#e9c46a'], challenge: ch('Tire Fiesta', '🛞', 'Fix 10 flat tires', 'flatsFixed', 10), crates: ['street', 'garage'] },
  { id: 'pirate', name: 'Pirate Hat', icon: '🏴‍☠️', colors: 'fixed', base: ['#212121'], challenge: ch('Kart Pirate', '🏎️', 'Win 10 kart Grand Prix races', 'kartWins', 10), crates: ['gold', 'diamond'] },
  { id: 'viking', name: 'Viking Helmet', icon: '🪓', colors: 'fixed', base: ['#90a4ae'], challenge: ch('Conqueror', '🏆', 'Win 3 Grand Prix series', 'gpWins', 3), crates: ['diamond'] },
  { id: 'crown', name: 'Crown', icon: '👑', colors: 'fixed', base: ['#ffc107'], crates: ['diamond'] },
  { id: 'tophat', name: 'Top Hat', icon: '🎩', colors: 'fixed', base: ['#212121'], crates: ['gold', 'diamond'] },
]

export const hatDef = (id: string | null | undefined) => (id ? HATS.find((h) => h.id === id) : undefined)

// The colours a hat may wear, or null when there's no choice.
export function hatChoices(d: HatDef): string[] | null {
  if (d.colors === 'fixed') return null
  if (Array.isArray(d.colors)) return d.colors
  return HAT_PAINTS.map((p) => p.color)
}

// A hat as a car may wear it: a known hat with colours its rule allows, else null. Colours
// equal to the base ones are left out, and a two-tone cap with both colours the same is one colour.
export function cleanHat(h: unknown): HatFit | null {
  if (!h || typeof h !== 'object') return null
  const d = hatDef((h as HatFit).id)
  if (!d) return null
  const raw = (h as HatFit).colors
  const list = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === 'string') : []
  const ok = hatChoices(d)
  if (!ok || !list.length || !ok.includes(list[0])) return { id: d.id }
  const colors = d.colors === 'twoTone' && list[1] && list[1] !== list[0] && ok.includes(list[1]) ? [list[0], list[1]] : [list[0]]
  return colors.length === d.base.length && colors.every((c, i) => c === d.base[i]) ? { id: d.id } : { id: d.id, colors }
}

// The colours a hat is drawn in: [main, second]. A one-colour cap uses its colour for both.
export function hatPaint(h: HatFit): string[] {
  const d = hatDef(h.id)
  if (!d) return []
  const c = h.colors?.length ? h.colors : d.base
  return d.colors === 'twoTone' ? [c[0], c[1] ?? c[0]] : [c[0]]
}

export const sameHat = (a: HatFit | null | undefined, b: HatFit | null | undefined) => JSON.stringify(cleanHat(a)) === JSON.stringify(cleanHat(b))

// Hats this save owns (won by a challenge or from a crate).
export const ownedHats = (s: { hats?: string[] }) => (s.hats ?? []).filter((id) => hatDef(id))

// How far a save is through a hat's challenge (0 for a crate-only hat).
type QuestSave = { stats: Partial<Record<CounterKey, number>>; hatQuest?: HatQuest | null }
export function hatProgress(d: HatDef, s: QuestSave): number {
  const c = d.challenge
  if (!c) return 0
  const q = s.hatQuest ?? newHatQuest(s.stats)
  if (c.stat === 'raceCars') return q.cars.length
  if (c.stat === 'kartWins') return q.kart
  if (c.stat === 'arcade') return q.arcade
  return Math.max(0, (s.stats[c.stat] ?? 0) - (q.base[c.stat] ?? 0))
}

// Challenge hats the save has finished but doesn't own yet.
export const earnedHats = (s: QuestSave & { hats?: string[] }) =>
  HATS.filter((d) => d.challenge && !ownedHats(s).includes(d.id) && hatProgress(d, s) >= d.challenge.goal).map((d) => d.id)

// A save's hat quest: the one it has, or a fresh one counting from its stats now (a save from
// before hats, so what was done before doesn't count).
export const hatQuestOf = (s: { stats?: Partial<Record<CounterKey, number>>; hatQuest?: HatQuest | null }): HatQuest => {
  const q = s.hatQuest
  if (q && typeof q === 'object' && q.base && typeof q.base === 'object') {
    return { base: q.base, cars: Array.isArray(q.cars) ? q.cars.filter((c) => typeof c === 'string') : [], kart: Number(q.kart) || 0, arcade: Number(q.arcade) || 0 }
  }
  return newHatQuest(s.stats)
}

// Hats a crate can drop.
export const crateHats = (crate: CrateId) => HATS.filter((d) => d.crates?.includes(crate))
