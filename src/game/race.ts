// Drag race physics, shared by the race screen and the server's live race referee
// (supabase/migrations/0009_live_race_referee.sql, public.race_floor()).

export const TRACK = 400

// A six-speed box: revs follow road speed, so each gear runs longer than the one before and the
// shifting lasts most of the race. RATIO is the share of the car's top speed each gear reaches
// at the redline (rpm 1). Speeds are metres per second.
export const RATIO = [0.22, 0.38, 0.55, 0.73, 0.9, 1]
export const TOP_GEAR = RATIO.length - 1
// The car's top speed and its pull, from PI.
export const topSpeed = (pi: number) => 70 + pi * 0.3
const pull = (pi: number) => 5.4 + pi * 0.048
// Torque across the rev range (0-1), peaking near the redline.
const torque = (rpm: number) => 0.62 + 0.55 * rpm - 0.25 * rpm * rpm
// Lower gears multiply the engine's pull.
const GEAR_PULL = RATIO.map((k) => (1 / k) ** 0.55)
// Revs at a standstill: the needle never drops below this.
export const IDLE = 0.25
// The perfect band narrows gear by gear (as a share of the band from grip.ts), since the needle
// climbs slower in a tall gear. The player's band (BAND) is wider than AI rivals' (AI_BAND), which
// keeps the rivals' pace, and the fair-rival margins measured from it, as they were.
export const BAND = [1.2, 0.85, 0.65, 0.5, 0.42]
export const AI_BAND = [1, 0.55, 0.32, 0.22, 0.16]
export function shiftBand(gear: number, lo = 0.78, hi = 0.93, bands = BAND) {
  return { lo: hi - (hi - lo) * bands[Math.min(gear, bands.length - 1)], hi }
}
// Holding the pedal before GO revs the engine; where the needle sits at GO sets the launch.
// Inside the band the needle climbs at REV_HOLD of its speed, so it's easy to hold in the green.
export const LAUNCH_BAND = { lo: 0.5, hi: 0.8 }
export const REV_UP = 1.3
export const REV_HOLD = 0.4
export const REV_DOWN = 1.2

// Boost: how hard it pushes in each gear (it only spins the tires in first), and how long a full tank lasts.
export const BOOST_MUL = [0.85, 1.05, 1.15, 1.25, 1.3, 1.35]
export const BOOST_SECONDS = 2.2
// What a launch fills the tank with, and what each shift adds.
export const LAUNCH_FILL = { perfect: 0.34, good: 0.15 }
export const SHIFT_FILL = { perfect: 0.2, good: 0.08 }
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
export const freshRacer = (launched = true): Racer => ({ gear: 0, rpm: IDLE, speed: 0, dist: 0, quality: 1, finished: null, launched, boost: launched ? LAUNCH_FILL.perfect : 0, burning: false, boostUsed: false, streak: 0 })

export function stepRacer(r: Racer, piVal: number, dt: number, t: number, mul = 1, track = TRACK) {
  if (r.finished !== null || !r.launched) return
  const vTop = topSpeed(piVal)
  const rev = Math.max(IDLE, r.speed / (vTop * RATIO[r.gear]))
  r.rpm = Math.min(1.05, rev)
  // Lower gears bounce off the limiter; top gear just stops pulling there.
  const limiter = rev >= 1 ? (r.gear === TOP_GEAR ? 0 : 0.15) : 1
  if (r.burning) {
    mul *= BOOST_MUL[r.gear]
    r.boost -= dt / BOOST_SECONDS
    if (r.boost <= 0) {
      r.boost = 0
      r.burning = false
    }
  }
  const p = pull(piVal)
  const drive = p * GEAR_PULL[r.gear] * torque(Math.min(1, rev)) * r.quality * limiter * mul
  const drag = 0.9 * p * (r.speed / vTop) ** 2
  r.speed = Math.max(0, r.speed + (drive - drag) * dt)
  r.dist += r.speed * dt
  if (r.dist >= track) r.finished = t
}

// lo..hi is the perfect window; rain and snow narrow it (see grip.ts). The player (soft) also gets
// a Good just past the band and smaller losses for a late or early shift; AI rivals keep the strict
// calls, so their pace doesn't change.
export function shiftQuality(rpm: number, lo = 0.78, hi = 0.93, soft = true) {
  if (rpm >= lo && rpm <= hi) return { q: 1.08, label: 'PERFECT!' }
  if (rpm >= 0.65 && rpm < lo) return { q: 0.97, label: 'Good' }
  if (soft && rpm > hi && rpm <= hi + 0.05) return { q: 0.97, label: 'Good' }
  if (rpm > hi) return { q: soft ? 0.92 : 0.88, label: 'Late' }
  return { q: soft ? 0.88 : 0.8, label: 'Early' }
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

// Off the line at GO with the revs at `rpm`: in the launch band is a perfect launch, too few revs
// bog the car down and too many spin the tires. Returns the call to show.
export function revLaunch(r: Racer, rpm: number) {
  r.launched = true
  const { lo, hi } = LAUNCH_BAND
  if (rpm >= lo && rpm <= hi) {
    r.boost = LAUNCH_FILL.perfect
    return 'PERFECT LAUNCH!'
  }
  if (rpm >= lo - 0.2 && rpm <= hi + 0.15) {
    r.quality = 0.97
    r.boost = LAUNCH_FILL.good
    return 'Good launch'
  }
  r.quality = rpm > hi ? 0.88 : 0.9
  r.boost = 0
  return rpm > hi ? 'WHEELSPIN!' : 'Bogged down'
}

// Up a gear with shift quality q (1.08 perfect, 0.97 good). Clean shifts fill the boost tank.
export function shiftRacer(r: Racer, q: number) {
  if (r.gear >= TOP_GEAR) return
  r.quality = q
  r.gear++
  r.rpm = Math.max(IDLE, r.rpm * RATIO[r.gear - 1] / RATIO[r.gear])
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
export const AI_BOOST_GEAR = 3
// Nitro Burst works in the top two gears; Oil Slick for the first few seconds.
export const NITRO_GEAR = TOP_GEAR - 1
export const OIL_SECONDS = 4

// The fastest a car with this PI can finish: a perfect launch the instant the lights go green,
// every shift perfect at the best shift point, the boost fired at the best moment, with whichever
// skill helps most (see the race screen for how each one applies), less 2.5% for uneven frame
// timing. The referee raises any faster reported time to this.
export const MAX_RACE_PI = 250
// The race screen steps the race at this fixed rate whatever the frame rate.
export const RACE_DT = 1 / 240
// No skill at all is left out: Slipstream pushes at least as hard everywhere.
const SKILL_BOOST: Record<string, (r: Racer, t: number) => number> = {
  launch: (r) => (r.gear === 0 ? 1.2 : 1),
  nitro: (r) => (r.gear >= NITRO_GEAR ? 1.15 : 1),
  slipstream: () => 1.08,
  oil: (_, t) => (t < OIL_SECONDS ? 1.1 : 1),
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
    if (r.gear < TOP_GEAR && r.rpm >= at) {
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

// One clean pull, as the garage dyno runs it: every shift perfect at 90%, no skill.
// Calls `each` with the racer after every step, and returns the finish time.
export const DYNO_DT = 1 / 120
export function dynoPull(piVal: number, each?: (r: Racer, t: number) => void) {
  const r = freshRacer()
  let t = 0
  while (r.finished === null && t < 120) {
    t += DYNO_DT
    if (r.gear < TOP_GEAR && r.rpm >= 0.9) shiftRacer(r, 1.08)
    stepRacer(r, piVal, DYNO_DT, t)
    each?.(r, t)
  }
  return Math.round((r.finished ?? t) * 100) / 100
}
