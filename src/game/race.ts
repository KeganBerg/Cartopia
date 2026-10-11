// Drag race physics, shared by the race screen and the server's live race referee
// (supabase/migrations/0009_live_race_referee.sql, public.race_floor()).

export const TRACK = 400
export const GEAR_POWER = [1, 0.85, 0.72, 0.6]

export type Racer = { gear: number; rpm: number; speed: number; dist: number; quality: number; finished: number | null }
export const freshRacer = (): Racer => ({ gear: 0, rpm: 0, speed: 0, dist: 0, quality: 1, finished: null })

export function stepRacer(r: Racer, piVal: number, dt: number, t: number, mul = 1) {
  if (r.finished !== null) return
  const climb = (1.25 - r.gear * 0.16) * (0.85 + piVal / 300)
  // Top gear just holds near the redline; lower gears bounce off the limiter.
  r.rpm = Math.min(r.gear === 3 ? 0.95 : 1.05, r.rpm + climb * dt)
  const overRev = r.rpm >= 1
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

// The fastest a car with this PI can finish: every shift perfect at the best shift point,
// with whichever skill helps most (see the race screen for how each one applies), less 2.5%
// for uneven frame timing. The referee raises any faster reported time to this.
export const MAX_RACE_PI = 250
const SKILL_BOOST: Record<string, (r: Racer, t: number) => number> = {
  none: () => 1,
  launch: (r) => (r.gear === 0 ? 1.2 : 1),
  nitro: (r) => (r.gear === 3 ? 1.15 : 1),
  slipstream: () => 1.08,
  oil: (_, t) => (t < 2.5 ? 1.1 : 1),
  // Never the fastest, so they leave the floors as they were.
  torque: (r) => (r.gear <= 1 ? 1.1 : 1),
  freeze: (r) => (r.gear === 1 ? 1.1 : 1),
}
export function raceFloor(piVal: number) {
  let best = Infinity
  for (const boost of Object.values(SKILL_BOOST)) {
    for (let at = 0.78; at <= 0.93 + 1e-9; at += 0.01) {
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
        stepRacer(r, piVal, dt, t, boost(r, t))
      }
      best = Math.min(best, r.finished ?? Infinity)
    }
  }
  return Math.floor(best * 0.975 * 1000) / 1000
}
