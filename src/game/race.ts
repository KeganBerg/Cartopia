// Drag race physics, shared by the race screen and the server's live race referee
// (supabase/migrations/0009_live_race_referee.sql, public.race_floor()).

export const TRACK = 400
export const GEAR_POWER = [1, 0.85, 0.72, 0.6]

// Boost: how hard it pushes in each gear (it only spins the tires in first), and how long a full tank lasts.
export const BOOST_MUL = [0.85, 1.1, 1.25, 1.35]
export const BOOST_SECONDS = 1.6
// What a launch fills the tank with by reaction time (seconds after GO), and what each shift adds.
export const LAUNCH_FILL = { perfect: 0.34, good: 0.15 }
export const SHIFT_FILL = { perfect: 0.22, good: 0.1 }
// Pressing before GO is a jump start: off the line this many seconds after GO, with wheelspin
// through first gear and nothing in the boost tank.
export const JUMP_START_DELAY = 0.6
export const JUMP_START_Q = 0.8
// A player who never presses goes anyway after this long.
export const AUTO_LAUNCH = 1.2

// launched: off the line yet (racers made for the floor and the stand-ins start launched).
// boost: the boost tank, 0-1, filled by a clean launch and clean shifts. burning: boost is firing.
// boostUsed: boost fires once a race. streak: clean shifts in a row.
export type Racer = {
  gear: number; rpm: number; speed: number; dist: number; quality: number; finished: number | null
  launched: boolean; boost: number; burning: boolean; boostUsed: boolean; streak: number
}
export const freshRacer = (launched = true): Racer => ({ gear: 0, rpm: 0, speed: 0, dist: 0, quality: 1, finished: null, launched, boost: launched ? LAUNCH_FILL.perfect : 0, burning: false, boostUsed: false, streak: 0 })

export function stepRacer(r: Racer, piVal: number, dt: number, t: number, mul = 1) {
  if (r.finished !== null || !r.launched) return
  const climb = (1.25 - r.gear * 0.16) * (0.85 + piVal / 300)
  // Top gear just holds near the redline; lower gears bounce off the limiter.
  r.rpm = Math.min(r.gear === 3 ? 0.95 : 1.05, r.rpm + climb * dt)
  const overRev = r.rpm >= 1
  if (r.burning) {
    mul *= BOOST_MUL[r.gear]
    r.boost -= dt / BOOST_SECONDS
    if (r.boost <= 0) {
      r.boost = 0
      r.burning = false
    }
  }
  const accel = (piVal / 100) * 70 * GEAR_POWER[r.gear] * r.quality * (overRev ? 0.25 : 1) * (0.4 + r.rpm * 0.6)
  r.speed += accel * mul * dt
  r.speed *= 1 - 0.04 * dt
  r.dist += r.speed * dt
  if (r.dist >= TRACK) r.finished = t
}

// lo..hi is the perfect window; rain and snow narrow it (see grip.ts).
export function shiftQuality(rpm: number, lo = 0.78, hi = 0.93) {
  if (rpm >= lo && rpm <= hi) return { q: 1.08, label: 'PERFECT!' }
  if (rpm >= 0.65 && rpm < lo) return { q: 0.95, label: 'Good' }
  if (rpm > hi) return { q: 0.85, label: 'Late' }
  return { q: 0.75, label: 'Early' }
}

// Off the line `reaction` seconds after GO (negative: a jump start, which the caller holds until
// JUMP_START_DELAY). Returns the call to show.
export function launchRacer(r: Racer, reaction: number) {
  r.launched = true
  if (reaction < 0) {
    r.quality = JUMP_START_Q
    r.boost = 0
    return 'JUMP START!'
  }
  if (reaction <= 0.25) {
    r.boost = LAUNCH_FILL.perfect
    return 'PERFECT LAUNCH!'
  }
  if (reaction <= 0.5) {
    r.boost = LAUNCH_FILL.good
    return 'Good launch'
  }
  r.boost = 0
  return 'Slow launch'
}

// Up a gear with shift quality q (1.08 perfect, 0.95 good). Clean shifts fill the boost tank.
export function shiftRacer(r: Racer, q: number) {
  r.quality = q
  r.gear++
  r.rpm = 0.35
  r.streak = q >= 1 ? r.streak + 1 : 0
  r.boost = Math.min(1, r.boost + (q >= 1 ? SHIFT_FILL.perfect : q >= 0.95 ? SHIFT_FILL.good : 0))
}

// Fires the boost: it burns until the tank is empty, and once a race.
export function fireBoost(r: Racer) {
  if (r.boostUsed || r.boost <= 0 || !r.launched || r.finished !== null) return false
  r.boostUsed = true
  r.burning = true
  return true
}

// AI rivals: reaction off the line by how cleanly they shift (0 sloppy to 1 clean; roll is 0-1
// random), and they fire their boost as they reach this gear.
export const aiReaction = (cleanness: number, roll: number) => 0.12 + (1 - cleanness) * 0.3 + roll * 0.12
export const AI_BOOST_GEAR = 2

// The fastest a car with this PI can finish: a perfect launch the instant the lights go green,
// every shift perfect at the best shift point, the boost fired at the best moment, with whichever
// skill helps most (see the race screen for how each one applies), less 2.5% for uneven frame
// timing. The referee raises any faster reported time to this.
export const MAX_RACE_PI = 250
// No skill at all is left out: Slipstream pushes at least as hard everywhere.
const SKILL_BOOST: Record<string, (r: Racer, t: number) => number> = {
  launch: (r) => (r.gear === 0 ? 1.2 : 1),
  nitro: (r) => (r.gear === 3 ? 1.15 : 1),
  slipstream: () => 1.08,
  oil: (_, t) => (t < 2.5 ? 1.1 : 1),
  torque: (r) => (r.gear <= 1 ? 1.1 : 1),
  freeze: (r) => (r.gear === 1 ? 1.1 : 1),
}
// One perfect run: shift at `at` rpm, fire the boost at `fireAt` seconds. Returns the finish
// time and when the last shift happened.
export function perfectRun(piVal: number, skill: (r: Racer, t: number) => number, at: number, fireAt: number) {
  const r = freshRacer()
  const dt = 1 / 240
  let t = 0
  let lastShift = 0
  while (r.finished === null && t < 120) {
    t += dt
    if (r.gear < 3 && r.rpm >= at) {
      shiftRacer(r, 1.08)
      lastShift = t
    }
    if (t >= fireAt) fireBoost(r)
    stepRacer(r, piVal, dt, t, skill(r, t))
  }
  return { time: r.finished ?? Infinity, lastShift }
}
// The best shift point is always near the top of the perfect band, and a time is only ever
// floored, so a few points and a coarse-then-fine search for the boost are plenty.
const floors = new Map<number, number>()
export function raceFloor(piVal: number) {
  const known = floors.get(piVal)
  if (known !== undefined) return known
  let best = Infinity
  for (const skill of Object.values(SKILL_BOOST)) {
    for (const at of [0.9, 0.92, 0.93]) {
      // Firing later than just after the tank is full only loses time.
      const { lastShift } = perfectRun(piVal, skill, at, Infinity)
      let near = 0
      let nearT = Infinity
      for (let fireAt = 0; fireAt <= lastShift + 0.6; fireAt += 0.1) {
        const { time } = perfectRun(piVal, skill, at, fireAt)
        if (time < nearT) [near, nearT] = [fireAt, time]
      }
      for (let fireAt = Math.max(0, near - 0.1); fireAt <= near + 0.1; fireAt += 0.02) nearT = Math.min(nearT, perfectRun(piVal, skill, at, fireAt).time)
      best = Math.min(best, nearT)
    }
  }
  const floor = Math.floor(best * 0.975 * 1000) / 1000
  floors.set(piVal, floor)
  return floor
}

// One clean pull, as the garage dyno runs it: every shift perfect at 85%, no skill.
// Calls `each` with the racer after every step, and returns the finish time.
export const DYNO_DT = 1 / 120
export function dynoPull(piVal: number, each?: (r: Racer, t: number) => void) {
  const r = freshRacer()
  let t = 0
  while (r.finished === null && t < 120) {
    t += DYNO_DT
    if (r.gear < 3 && r.rpm >= 0.85) {
      r.quality = 1.08
      r.gear++
      r.rpm = 0.35
    }
    stepRacer(r, piVal, DYNO_DT, t)
    each?.(r, t)
  }
  return Math.round((r.finished ?? t) * 100) / 100
}
