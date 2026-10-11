// Tables the server's save guard uses to check restores and Grand Prix wins
// (supabase/migrations/0016_econ_restore_gp.sql, 0022_rescue_rolls.sql). guardTables.test.ts keeps them in step.
import { BARN_PER_DAY, BARN_RARITY, GP_ROUNDS, GP_SERIES, RARITY, RESCUE_CAR_CHANCE, RESCUE_PINS, RESCUE_SPOTS, VISITORS, VISIT_GAP_MIN, VISITS_PER_DAY, type Rarity } from './data'
import { AI_BOOST_GEAR, MAX_RACE_PI, OIL_SECONDS, TOP_GEAR, aiReaction, fireBoost, freshRacer, launchRacer, raceFloor, shiftRacer, stepRacer } from './race'

// Pins in one search, and the chance each one hides a car.
export const rescueRoll = () => ({ pins: RESCUE_PINS, car: RESCUE_CAR_CHANCE })

// The shortest restore time for each car: the rarity it has at the spot where it's commonest.
export function restoreMinutes(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const spot of RESCUE_SPOTS) {
    for (const c of spot.cars) out[c.model] = Math.min(out[c.model] ?? Infinity, RARITY[c.rarity].minutes)
  }
  return out
}

// Rusty's search spots as the server rolls them (rescue_roll()): the level each opens at, and its
// cars with their rarities. Plus each rarity's weight in a roll and its restore minutes.
export function rescueSpots(): Record<string, { unlock: number; cars: [string, Rarity][] }> {
  return Object.fromEntries(RESCUE_SPOTS.map((s) => [s.id, { unlock: s.unlockLevel, cars: s.cars.map((c): [string, Rarity] => [c.model, c.rarity]) }]))
}
// What a search at each spot costs; rescue_roll() splits it over the cars found, and a restore's
// payout is checked against its share (0024_season_track.sql).
export const spotCosts = (): Record<string, number> => Object.fromEntries(RESCUE_SPOTS.map((s) => [s.id, s.cost]))
export function rarities(): Record<Rarity, { weight: number; minutes: number }> {
  return Object.fromEntries(Object.entries(RARITY).map(([k, r]) => [k, { weight: r.weight, minutes: r.minutes }])) as Record<Rarity, { weight: number; minutes: number }>
}

// Each series' hardest rival is the last round's: (basePi + 5 steps), plus 8% per earlier clear.
export function gpSeries(): Record<string, { last: number }> {
  return Object.fromEntries(GP_SERIES.map((s) => [s.id, { last: s.basePi + (GP_ROUNDS - 1) * s.step }]))
}

export const GP_RIVAL_MAX = 400

// The slowest a Grand Prix rival with this PI finishes: rivals react as slowly as a clean driver
// can (aiReaction), shift perfectly (somewhere between 0.80 and 0.92 rpm) and fire their boost on
// reaching AI_BOOST_GEAR, and the player's oil or freeze skill can slow them. Plus 3% for frame timing.
export function gpRivalSlowest(pi: number) {
  const drags: ((r: { gear: number }, t: number) => number)[] = [() => 1, (_, t) => (t < OIL_SECONDS ? 0.9 : 1), (r) => (r.gear === 1 ? 0.9 : 1)]
  let worst = 0
  for (const drag of drags) {
    for (let at = 0.8; at <= 0.92 + 1e-9; at += 0.01) {
      const r = freshRacer(false)
      const dt = 1 / 240
      const reaction = aiReaction(1, 1)
      let t = 0
      while (r.finished === null && t < 120) {
        t += dt
        if (!r.launched && t >= reaction) launchRacer(r, reaction)
        if (r.launched && r.gear < TOP_GEAR && r.rpm >= at) shiftRacer(r, 1.08)
        if (r.gear >= AI_BOOST_GEAR) fireBoost(r)
        stepRacer(r, pi, dt, t, drag(r, t))
      }
      worst = Math.max(worst, r.finished ?? 120)
    }
  }
  return worst * 1.03
}

// For each rival PI (index = PI - 1), the lowest car PI whose fastest possible run beats that
// rival's slowest one; MAX_RACE_PI + 1 when no car can.
export function gpBeatTable(): number[] {
  const floors = Array.from({ length: MAX_RACE_PI }, (_, i) => raceFloor(i + 1))
  return Array.from({ length: GP_RIVAL_MAX }, (_, i) => {
    const slowest = gpRivalSlowest(i + 1)
    const k = floors.findIndex((f) => f < slowest)
    return k < 0 ? MAX_RACE_PI + 1 : k + 1
  })
}

// Surprise visitors as the server rolls them (visitor_next() in 0032_town_visitors.sql).
export function visitorTable() {
  return {
    kinds: Object.fromEntries(Object.entries(VISITORS).map(([k, v]) => [k, { weight: v.weight, minutes: v.minutes, ...v.pay }])),
    gap: VISIT_GAP_MIN,
    perDay: VISITS_PER_DAY,
    barn: BARN_RARITY,
    barnPerDay: BARN_PER_DAY,
  }
}
