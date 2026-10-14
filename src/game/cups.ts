// Class Cups: three races per car class (game/classes.ts) that only a car of that class can
// enter (either of its class tags counts). The hosts are cars of the class itself, from its
// slowest to its fastest, tuned a little more each race. Every win pays coins (double the first
// time), and the first win in each race gives a free CUP_CRATE, one tier up from the cheapest
// crate: the server's crate_open() checks the save's cup wins and gives each race's crate once.
// Pay goes through finishRace like any race, so the server guard's coin bank covers it.
import { performance, type UpgradeSlot } from './data'
import { CAR_CLASSES, carsInClass, inClass, type CarClassId } from './classes'
import type { CrateId } from './crates'
import type { RaceDist } from './distance'
import type { VenueId } from '../scene/venues'

export type CupRace = { id: string; cls: CarClassId; tier: 1 | 2 | 3; car: string; color: string; pi: number; venue: VenueId; dist: RaceDist; night?: boolean }

const VENUE: Record<CarClassId, VenueId> = { compact: 'main', muscle: 'docks', sport: 'beach', super: 'main', offroad: 'desert', oddball: 'farm' }
export const CUP_CRATE: CrateId = 'garage'
// The free crate a race's first win gives, by its source id (crate_open()'s p_free).
export const cupCrateSource = (id: string) => `cup:${id}`
// Which crate a free source opens: weekly arcade prizes (arcade:<week>:<game>) are Gold, cup prizes CUP_CRATE.
export const freeCrateOf = (source: string): CrateId => (source.startsWith('arcade:') ? 'gold' : CUP_CRATE)
const TUNE = [0, 2, 3]
const DIST: RaceDist[] = ['quarter', 'half', 'mile']
const tuned = (n: number): Record<UpgradeSlot, number> => ({ engine: n, turbo: n, tires: n, weight: n })

function racesOf(cls: CarClassId): CupRace[] {
  const cars = carsInClass(cls).map((c) => ({ c, pi: performance(c, tuned(0)) })).sort((a, b) => a.pi - b.pi)
  if (!cars.length) return []
  const picks = [cars[0], cars[Math.floor((cars.length - 1) / 2)], cars[cars.length - 1]]
  return picks.map(({ c }, i) => ({
    id: `${cls}-${i + 1}`, cls, tier: (i + 1) as 1 | 2 | 3, car: c.id, color: c.colors[i % c.colors.length],
    pi: performance(c, tuned(TUNE[i])), venue: VENUE[cls], dist: DIST[i], night: i === 2 || undefined,
  }))
}

export const CUP_RACES: CupRace[] = CAR_CLASSES.flatMap((c) => racesOf(c.id))
export const cupRace = (id: string) => CUP_RACES.find((r) => r.id === id)
export const cupRacesOf = (cls: CarClassId) => CUP_RACES.filter((r) => r.cls === cls)

// Can this car race in this cup?
export const cupFits = (r: CupRace, model: string) => inClass(model, r.cls)
// Has a whole class's cup been won (each of its races at least once)?
export const cupWon = (cups: Record<string, number> | undefined, cls: CarClassId) => cupRacesOf(cls).every((r) => (cups?.[r.id] ?? 0) > 0)

// What a win pays: a little more than a Tuner Trial at the same PI, doubled the first time.
export const cupPrize = (r: CupRace, first: boolean) => Math.round(((340 + r.pi * 10) * (first ? 2 : 1)) / 10) * 10
// How cleanly the host shifts (0-1).
export const cupShift = (r: CupRace) => Math.min(0.95, 0.4 + r.tier * 0.17)
