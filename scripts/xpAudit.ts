// XP audit: hours of play per level for a typical player, now and with levelXpBoost.
// Not a test. Run with: npx vite-node scripts/xpAudit.ts
//
// A typical player plays an hour a day. They log in to a full tank (base cap + 3 gas stations),
// then play on the fuel that refills during the hour (faster at levels 15, 30, 50, 75). Half the
// fuel runs town jobs at the six best XP-per-fuel businesses their level allows, half goes on
// races (RACE_FUEL each, winning 75%). On top: the day's 3 tasks, a seventh of the weekly ones,
// 4 endless goals, 2 building upgrades and a story goal while they last.
import { BUILDINGS, GOALS, QUEST_PAY, RACE_FUEL, baseFuelCap, buildingUpgradeXp, fuelPerMin, levelXpBoost, payAt, raceXp, townXpMult, xpToNext } from '../src/game/data'
import { endlessPay } from '../src/game/endless'

const WIN = 0.75
const jobXpPerFuel = (l: number) => {
  const best = BUILDINGS.filter((b) => b.jobSeconds && b.fuelCost && b.unlockLevel <= l && !b.bucks && !b.event)
    .map((b) => (b.xp ?? 0) / b.fuelCost!).sort((a, b) => b - a).slice(0, 6)
  return (best.reduce((a, b) => a + b, 0) / best.length) * townXpMult(l)
}
const raceXpPerFuel = (l: number) => (WIN * raceXp(true, l) + (1 - WIN) * raceXp(false, l)) / RACE_FUEL
const storyAvg = GOALS.filter((g) => !g.event).reduce((a, g) => a + g.xp, 0) / GOALS.filter((g) => !g.event).length

// Base XP (before the level boost) one play hour earns at level l.
export function hourXp(l: number) {
  const fuel = baseFuelCap(l) + 30 + 60 * fuelPerMin(l)
  const play = (fuel / 2) * jobXpPerFuel(l) + (fuel / 2) * raceXpPerFuel(l)
  const tasks = 3 * payAt(QUEST_PAY.daily.task, l).xp + (3 * payAt(QUEST_PAY.weekly.task, l).xp) / 7
  const extra = 4 * endlessPay(1, l).xp + 2 * buildingUpgradeXp(3) + (l < 40 ? storyAvg : 0)
  return { play, extra: tasks + extra }
}

const LEVELS = [2, 3, 5, 8, 10, 15, 20, 25, 30, 40, 50, 60]
const rows = LEVELS.map((l) => {
  const h = hourXp(l)
  const per = h.play + h.extra
  return { level: l, need: xpToNext(l), xpPerHour: Math.round(per), hoursNow: +(xpToNext(l) / per).toFixed(2), boost: +levelXpBoost(l).toFixed(2), hoursNew: +(xpToNext(l) / (per * levelXpBoost(l))).toFixed(2) }
})
console.table(rows)
const total = (to: number, b: boolean) => { let t = 0; for (let l = 1; l < to; l++) { const h = hourXp(l); t += xpToNext(l) / ((h.play + h.extra) * (b ? levelXpBoost(l) : 1)) } return Math.round(t) }
for (const to of [10, 20, 30, 40, 50]) console.log(`hours to L${to}: now ${total(to, false)}, new ${total(to, true)}`)
