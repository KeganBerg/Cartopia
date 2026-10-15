// XP audit: hours of play per level, before and after level-scaled XP.
// Not a test. Run with: npx vite-node scripts/xpAudit.ts
//
// Fuel is the limit (1 a minute, so 60 an hour). A builder spends it on town jobs at the six best
// XP-per-fuel businesses their level allows; a racer spends it on races (RACE_FUEL each, winning
// WIN of them). "Before" is the flat 30/8 race XP and plain job XP.
import { BUILDINGS, RACE_FUEL, raceXp, townXpMult, xpToNext } from '../src/game/data'

const WIN = Number(process.env.WIN ?? 0.75)
const FUEL_PER_HOUR = 60
const jobXpPerFuel = (l: number) => {
  const best = BUILDINGS.filter((b) => b.jobSeconds && b.fuelCost && b.unlockLevel <= l && !b.bucks && !b.event)
    .map((b) => (b.xp ?? 0) / b.fuelCost!).sort((a, b) => b - a).slice(0, 6)
  return best.reduce((a, b) => a + b, 0) / best.length
}
const raceXpPerFuel = (l: number, after: boolean) =>
  (WIN * (after ? raceXp(true, l) : 30) + (1 - WIN) * (after ? raceXp(false, l) : 8)) / RACE_FUEL

const rows = [3, 5, 10, 15, 20, 25, 30, 35, 40].map((l) => {
  const need = xpToNext(l)
  const h = (perFuel: number) => +(need / (perFuel * FUEL_PER_HOUR)).toFixed(1)
  return {
    level: l, need,
    buildBefore: h(jobXpPerFuel(l)), buildAfter: h(jobXpPerFuel(l) * townXpMult(l)),
    raceBefore: h(raceXpPerFuel(l, false)), raceAfter: h(raceXpPerFuel(l, true)),
    mixBefore: h((jobXpPerFuel(l) + raceXpPerFuel(l, false)) / 2), mixAfter: h((jobXpPerFuel(l) * townXpMult(l) + raceXpPerFuel(l, true)) / 2),
  }
})
console.table(rows)
