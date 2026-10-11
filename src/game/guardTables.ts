// Tables the server's save guard uses to check restores and Grand Prix wins
// (supabase/migrations/0016_econ_restore_gp.sql). guardTables.test.ts keeps them in step.
import { GP_ROUNDS, GP_SERIES, RARITY, RESCUE_SPOTS } from './data'
import { MAX_RACE_PI, freshRacer, raceFloor, stepRacer } from './race'

// The shortest restore time for each car: the rarity it has at the spot where it's commonest.
export function restoreMinutes(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const spot of RESCUE_SPOTS) {
    for (const c of spot.cars) out[c.model] = Math.min(out[c.model] ?? Infinity, RARITY[c.rarity].minutes)
  }
  return out
}

// Each series' hardest rival is the last round's: (basePi + 5 steps), plus 8% per earlier clear.
export function gpSeries(): Record<string, { last: number }> {
  return Object.fromEntries(GP_SERIES.map((s) => [s.id, { last: s.basePi + (GP_ROUNDS - 1) * s.step }]))
}

export const GP_RIVAL_MAX = 400

// The slowest a Grand Prix rival with this PI finishes: rivals shift perfectly (somewhere between
// 0.80 and 0.92 rpm), and the player's oil or freeze skill can slow them. Plus 3% for frame timing.
export function gpRivalSlowest(pi: number) {
  const drags: ((r: { gear: number }, t: number) => number)[] = [() => 1, (_, t) => (t < 2.5 ? 0.9 : 1), (r) => (r.gear === 1 ? 0.9 : 1)]
  let worst = 0
  for (const drag of drags) {
    for (let at = 0.8; at <= 0.92 + 1e-9; at += 0.01) {
      const r = freshRacer()
      const dt = 1 / 240
      let t = 0
      while (r.finished === null && t < 120) {
        t += dt
        if (r.gear < 3 && r.rpm >= at) {
          r.quality = 1.08
          r.gear++
          r.rpm = 0.35
        }
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
