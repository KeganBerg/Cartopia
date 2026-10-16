// What the whole town makes and burns in an hour if every business keeps a job running: coins
// and parts from every job (drivers and merge bonuses included), the fuel those jobs take, the
// fuel that refills on its own (faster at level milestones), and how much the tank holds. Shown at the top of Shop > Upgrades.
import { buildingDef, buildingLevel, driverPayout, fuelPerMin, mergedParts, upgradeJobSeconds } from './data'
import { fuelCap, workingDriver, type SaveState } from './store'
import { mergeBoosts } from './merge'

export type TownRates = { coins: number; parts: number; fuelUse: number; fuelIn: number; tank: number; jobs: number }

export function townRates(s: Pick<SaveState, 'level' | 'buildings' | 'cars'>): TownRates {
  const boosts = mergeBoosts(s.buildings)
  let coins = 0
  let parts = 0
  let fuelUse = 0
  let jobs = 0
  for (const b of s.buildings) {
    const d = buildingDef(b.def)
    if (!d.jobSeconds || d.kind === 'obstacle') continue
    const lvl = buildingLevel(b)
    const perHour = 3600 / upgradeJobSeconds(d, lvl)
    const boost = boosts.get(b.uid) ?? 0
    coins += driverPayout(d, lvl, workingDriver(s, b), boost) * perHour
    parts += mergedParts(d, lvl, boost) * perHour
    fuelUse += (d.fuelCost ?? 0) * perHour
    jobs++
  }
  return { coins: Math.round(coins), parts: Math.round(parts), fuelUse: Math.round(fuelUse), fuelIn: fuelPerMin(s.level) * 60, tank: fuelCap(s), jobs }
}
