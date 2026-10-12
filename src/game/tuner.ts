// Tuner Trials: races you can only enter in a car built for them. Each one names
// the parts that must be fitted (game/data.ts MODS, by slot) and how far the
// engine (speed) and turbo (boost) must be tuned. The host drives a car already
// built that way. Every win pays coins; the first win over some hosts unlocks a
// custom paint pattern (data.ts PATTERNS with `trial`).
import { MODS, carDef, fittedMods, modFits, type ModSlot, type UpgradeSlot } from './data'
import type { RaceDist } from './distance'
import type { VenueId } from '../scene/venues'

// mods: a slot that must hold a part (true: any part; a list: one of those parts).
export type TunerBuild = { mods: Partial<Record<ModSlot, true | string[]>>; tune: Partial<Record<UpgradeSlot, number>> }
export type TunerTrial = {
  id: string; name: string; host: string; icon: string
  car: string; color: string; pi: number; tier: 1 | 2 | 3
  venue: VenueId; dist: RaceDist; night?: boolean
  build: TunerBuild
  pattern?: string // the pattern the first win unlocks
}

export const TUNER_TRIALS: TunerTrial[] = [
  { id: 'boostbox', name: 'Boost Box', host: 'Rev Rocket', icon: '🚀', car: 'civic', color: '#1e88e5', pi: 34, tier: 1, venue: 'main', dist: 'quarter',
    build: { mods: {}, tune: { turbo: 2 } } },
  { id: 'pipes', name: 'Loud Pipes', host: 'Dee Decibel', icon: '📢', car: 'stallion', color: '#e53935', pi: 40, tier: 1, venue: 'docks', dist: 'quarter',
    build: { mods: { exhaust: true }, tune: { engine: 2 } } },
  { id: 'downforce', name: 'Downforce Dash', host: 'Wren Wingate', icon: '🪽', car: 'kitsune', color: '#fafafa', pi: 50, tier: 1, venue: 'snow', dist: 'quarter',
    build: { mods: { spoiler: true, tires: ['snowstuds', 'allweather'] }, tune: { tires: 2 } }, pattern: 'hex' },
  { id: 'airgrab', name: 'Air Grab', host: 'Scoop Delgado', icon: '🌬️', car: 'rattler', color: '#fb8c00', pi: 58, tier: 2, venue: 'desert', dist: 'half',
    build: { mods: { hood: true, tires: ['sandtires', 'allweather'] }, tune: { turbo: 3 } } },
  { id: 'featherweight', name: 'Featherweight', host: 'Pip Featherby', icon: '🪶', car: 'miata', color: '#ec407a', pi: 66, tier: 2, venue: 'beach', dist: 'half',
    build: { mods: { kit: true, rims: true }, tune: { weight: 4 } }, pattern: 'splatter' },
  { id: 'stormcell', name: 'Storm Cell', host: 'Rainy Ruiz', icon: '⛈️', car: 'vette', color: '#3949ab', pi: 74, tier: 2, venue: 'farm', dist: 'half', night: true,
    build: { mods: { tires: ['raintires', 'allweather'], spoiler: true }, tune: { engine: 3, tires: 3 } } },
  { id: 'fullsend', name: 'Full Send', host: 'Max Overdrive', icon: '💥', car: 'nightfall', color: '#212121', pi: 90, tier: 3, venue: 'docks', dist: 'mile', night: true,
    build: { mods: { exhaust: true, hood: true, spoiler: true }, tune: { engine: 4, turbo: 4 } } },
  { id: 'tunerking', name: 'Tuner King', host: 'Baron Von Boost', icon: '👑', car: 'hyper', color: '#ffd700', pi: 106, tier: 3, venue: 'main', dist: 'mile', night: true,
    build: { mods: { exhaust: true, hood: true, spoiler: true, kit: true }, tune: { engine: 5, turbo: 5 } }, pattern: 'flames' },
]

export const tunerTrial = (id: string) => TUNER_TRIALS.find((t) => t.id === id)
export const trialForPattern = (pattern: string) => TUNER_TRIALS.find((t) => t.pattern === pattern)

type CarBuild = { model: string; mods?: string[]; upgrades: Record<UpgradeSlot, number> }

// One line per requirement, met or not: a part slot, or a tuning level.
export type BuildCheck = { kind: 'mod'; slot: ModSlot; ok: boolean; ids?: string[] } | { kind: 'tune'; slot: UpgradeSlot; need: number; have: number; ok: boolean }
export function buildChecks(t: TunerTrial, car: CarBuild): BuildCheck[] {
  const fit = fittedMods(car.mods, carDef(car.model).body)
  const out: BuildCheck[] = []
  for (const [slot, want] of Object.entries(t.build.mods) as [ModSlot, true | string[]][]) {
    const has = fit[slot]
    out.push({ kind: 'mod', slot, ok: !!has && (want === true || want.includes(has)), ids: want === true ? undefined : want })
  }
  for (const [slot, need] of Object.entries(t.build.tune) as [UpgradeSlot, number][]) {
    const have = car.upgrades[slot] ?? 0
    out.push({ kind: 'tune', slot, need, have, ok: have >= need })
  }
  return out
}
export const buildReady = (t: TunerTrial, car: CarBuild) => buildChecks(t, car).every((c) => c.ok)

// The parts the host's car wears: the build's own (the first of a list), else the
// first stock part for each slot that fits their car.
export function hostMods(t: TunerTrial) {
  const body = carDef(t.car).body
  return (Object.entries(t.build.mods) as [ModSlot, true | string[]][]).map(([slot, want]) =>
    (want === true ? MODS.find((m) => m.slot === slot && !m.bucks && modFits(m, body))?.id : want[0])).filter((id): id is string => !!id)
}

// What a win pays: a little more than a paint rival at the same PI, plus a first-win bonus.
export const tunerPrize = (t: TunerTrial, first: boolean) => Math.round(((320 + t.pi * 10) * (first ? 2 : 1)) / 10) * 10
// How cleanly the host shifts (0-1).
export const tunerShift = (t: TunerTrial) => Math.min(0.97, 0.45 + t.tier * 0.17)
