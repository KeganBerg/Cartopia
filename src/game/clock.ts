// The town clock. One in-game day lasts 20 real minutes, tied to the clock so
// every player sees the same time of day. ?time=0..1 pins it (0.5 is midnight)
// for testing. A live event from the server (night or day for everyone) pins
// it too; see liveEvents.ts.
import { forcedDayUntil, forcedPhase } from './liveEvents'

export const DAY_MS = 20 * 60 * 1000
const pinned = (() => {
  if (typeof location === 'undefined') return null
  const v = new URLSearchParams(location.search).get('time')
  return v === null ? null : Number(v)
})()

// 0 = noon, 0.5 = midnight.
export function dayPhase(now = Date.now()) {
  if (pinned !== null) return pinned
  const natural = (now % DAY_MS) / DAY_MS
  return forcedPhase(natural, now) ?? natural
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

// Night spots open halfway through dusk and close halfway through dawn
// (phase 0.3 to 0.7, 8 real minutes of every 20).
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
  const p = dayPhase(now)
  if (p >= OPEN_FROM && p < OPEN_TO) return 0
  return ((p < OPEN_FROM ? OPEN_FROM : 1 + OPEN_FROM) - p) * DAY_MS
}
