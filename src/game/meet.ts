import type { OwnedCar } from './store'
import { carDef, performance } from './data'

// How many cars a player can put on show at the Car Meet and on Main Street.
export const SHOWCASE_MAX = 3

const pi = (c: OwnedCar) => performance(carDef(c.model), c.upgrades, c.mods)

// The cars on show: the player's picks that they still own, or their three best if they picked none.
export function showcaseOf(cars: OwnedCar[], picks: string[] | undefined | null): OwnedCar[] {
  const chosen = (picks ?? []).map((uid) => cars.find((c) => c.uid === uid)).filter((c): c is OwnedCar => !!c)
  if (chosen.length) return chosen.slice(0, SHOWCASE_MAX)
  return [...cars].sort((a, b) => pi(b) - pi(a)).slice(0, SHOWCASE_MAX)
}

// Adds or removes a car from the picks. A full display drops its oldest pick.
export function togglePick(picks: string[], uid: string): string[] {
  if (picks.includes(uid)) return picks.filter((p) => p !== uid)
  return [...picks, uid].slice(-SHOWCASE_MAX)
}
