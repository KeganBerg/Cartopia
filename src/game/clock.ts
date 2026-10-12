// The town clock follows the player's real local time: the sun rises and sets
// when it does where they are (sun.ts works that out from the device's time
// zone), with gentle dusk and dawn ramps around it. ?time=0..1 pins it (0.5 is
// midnight) for testing. A live event from the server (night or day for
// everyone) pins it too; see liveEvents.ts.
import { forcedDayUntil, forcedPhase } from './liveEvents'
import { clockHour } from './hours'
import { PLACE, dayAt, south, sunDay, type Place } from './sun'

const MIN = 60_000
const pinned = (() => {
  if (typeof location === 'undefined') return null
  const v = new URLSearchParams(location.search).get('time')
  return v === null ? null : Number(v)
})()

// The phase at key moments of a real day, from one noon to the next. The light
// starts fading 40 minutes before sunset and is fully dark 50 minutes after,
// and the same the other way round at dawn.
const DUSK_FROM = 0.24, DARK = 0.36, DAWN_FROM = 0.64, DAY_FROM = 0.76
function keys(d: number, place: Place | null): [number, number][] {
  const a = sunDay(d, place), b = sunDay(d + 1, place)
  return [
    [a.noon, 0],
    [a.set - 40 * MIN, DUSK_FROM],
    [a.set + 50 * MIN, DARK],
    [(a.noon + b.noon) / 2, 0.5],
    [b.rise - 50 * MIN, DAWN_FROM],
    [b.rise + 40 * MIN, DAY_FROM],
    [b.noon, 1],
  ]
}

// The real-sky phase at `now`, ignoring pins and events. 0 = noon, 0.5 = midnight.
export function naturalPhase(now = Date.now(), place: Place | null = PLACE) {
  const k = keys(dayAt(now, place), place)
  for (let i = 1; i < k.length; i++) {
    const [t1, p1] = k[i]
    if (now < t1) {
      const [t0, p0] = k[i - 1]
      return (p0 + ((now - t0) / (t1 - t0)) * (p1 - p0)) % 1
    }
  }
  return 0
}

// The next moment (at or after `now`) the real sky reaches `phase`.
export function nextPhaseAt(phase: number, now = Date.now(), place: Place | null = PLACE) {
  for (let d = dayAt(now, place); ; d++) {
    const k = keys(d, place)
    for (let i = 1; i < k.length; i++) {
      const [t0, p0] = k[i - 1], [t1, p1] = k[i]
      if (phase >= p0 && phase < p1) {
        const t = t0 + ((phase - p0) / (p1 - p0)) * (t1 - t0)
        if (t >= now) return t
      }
    }
  }
}

// 0 = noon, 0.5 = midnight.
export function dayPhase(now = Date.now()) {
  if (pinned !== null) return pinned
  const natural = naturalPhase(now)
  return forcedPhase(natural, now) ?? natural
}

// Which night it is (counts up once a day, at noon), for things that change
// from one night to the next.
export const nightNumber = (now = Date.now()) => dayAt(now)

// The hour on the town clock as hours from noon to the next noon (12..36,
// midnight is 24): the device clock, or the pinned or forced time.
export function townHour(now = Date.now()) {
  if (pinned !== null || forcedPhase(0, now) !== null) return clockHour(dayPhase(now))
  const d = new Date(now)
  const h = d.getHours() + d.getMinutes() / 60
  return h < 12 ? h + 24 : h
}

// How dark it is, 0 (day) to 1 (night), with gentle dusk and dawn ramps.
export function nightAmount(phase: number) {
  const d = Math.abs(phase - 0.5) // 0 at midnight, 0.5 at noon
  if (d < 0.14) return 1
  if (d > 0.26) return 0
  return 1 - (d - 0.14) / 0.12
}

// How much of a sunset tint to add: peaks halfway through dusk and dawn.
export function duskAmount(phase: number) {
  const n = nightAmount(phase)
  return Math.max(0, 1 - Math.abs(n - 0.35) / 0.35)
}

// Night spots open halfway through dusk (just after sunset) and close halfway
// through dawn (just before sunrise).
export const OPEN_FROM = 0.3
export const OPEN_TO = 0.7
export const isNight = (now = Date.now()) => {
  const p = dayPhase(now)
  return p >= OPEN_FROM && p < OPEN_TO
}
// Milliseconds until the next opening (0 while open).
export function msUntilNight(now = Date.now()): number {
  // A forced day holds the night back until it ends.
  const dayEnds = pinned === null ? forcedDayUntil(now) : null
  if (dayEnds !== null) return dayEnds - now + msUntilNight(dayEnds)
  if (isNight(now)) return 0
  if (pinned !== null) return Infinity
  return nextPhaseAt(OPEN_FROM, now) - now
}

// "in 12 min" when the night is close, else the local time it opens ("at 7:05 PM").
export function opensLabel(now = Date.now()) {
  const ms = msUntilNight(now)
  if (!isFinite(ms)) return 'tonight'
  if (ms < 60 * MIN) return `in ${Math.max(1, Math.ceil(ms / MIN))} min`
  return `at ${new Date(now + ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

// Today's sunrise and sunset on the device clock (minutes after midnight), for
// the loading splash in index.html, which runs before any of this loads.
try {
  const s = sunDay(dayAt(Date.now()))
  const mins = (t: number) => {
    const d = new Date(t)
    return d.getHours() * 60 + d.getMinutes()
  }
  localStorage.setItem('cartopia-sun', JSON.stringify({ r: mins(s.rise), s: mins(s.set), south: south() }))
} catch {
  // No storage (tests, private mode): the splash falls back to 6am and 7pm.
}
