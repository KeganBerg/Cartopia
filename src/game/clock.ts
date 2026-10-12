// The town clock: one in-game day lasts 20 real minutes, 10 of daylight and 10
// of night, tied to UTC so every player sees the same time of day. ?time=0..1
// pins it (0.5 is midnight) for testing. A live event from the server (night or
// day for everyone) pins it too; see liveEvents.ts.
import { forcedDayUntil, forcedPhase } from './liveEvents'
import { clockHour } from './hours'
import { south } from './sun'

const MIN = 60_000
export const DAY_MS = 20 * MIN
const pinned = (() => {
  if (typeof location === 'undefined') return null
  const v = new URLSearchParams(location.search).get('time')
  return v === null ? null : Number(v)
})()

// The phase at key minutes of each 20-minute day, starting at noon. Dusk is
// halfway done (phase 0.3) at 5 minutes and dawn (0.7) at 15, so day and night
// get 10 minutes each; the light fades over about two and a half minutes.
const KEYS: [number, number][] = [[0, 0], [5, 0.3], [15, 0.7], [20, 1]]

// The shared clock's phase at `now`, ignoring pins and events. 0 = noon, 0.5 = midnight.
export function naturalPhase(now = Date.now()) {
  const t = ((((now % DAY_MS) + DAY_MS) % DAY_MS) / MIN)
  for (let i = 1; i < KEYS.length; i++) {
    const [t1, p1] = KEYS[i]
    if (t < t1) {
      const [t0, p0] = KEYS[i - 1]
      return p0 + ((t - t0) / (t1 - t0)) * (p1 - p0)
    }
  }
  return 0
}

// The next moment (at or after `now`) the shared clock reaches `phase`.
export function nextPhaseAt(phase: number, now = Date.now()) {
  const start = now - ((((now % DAY_MS) + DAY_MS) % DAY_MS))
  for (let day = start; ; day += DAY_MS) {
    for (let i = 1; i < KEYS.length; i++) {
      const [t0, p0] = KEYS[i - 1], [t1, p1] = KEYS[i]
      if (phase >= p0 && phase < p1) {
        const t = day + (t0 + ((phase - p0) / (p1 - p0)) * (t1 - t0)) * MIN
        if (t >= now) return t
      }
    }
  }
}

// A feature with its own night (Techno Night, techno.ts) pulls the town into
// it: `force` says how far, 0 (the clock as it is) to 1 (midnight), so it can
// ease in and out.
let force: ((now: number) => number) | null = null
export function forceNight(f: ((now: number) => number) | null) {
  force = f
}

// 0 = noon, 0.5 = midnight.
export function dayPhase(now = Date.now()) {
  if (pinned !== null) return pinned
  const natural = naturalPhase(now)
  const p = forcedPhase(natural, now) ?? natural
  const w = force ? Math.min(1, Math.max(0, force(now))) : 0
  return w > 0 ? p + (0.5 - p) * w : p
}

// Which night it is (counts up once a town day, at noon), for things that
// change from one night to the next.
export const nightNumber = (now = Date.now()) => Math.floor(now / DAY_MS)

// The hour on the town clock as hours from noon to the next noon (12..36,
// midnight is 24).
export const townHour = (now = Date.now()) => clockHour(dayPhase(now))

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

// Night spots open halfway through dusk and close halfway through dawn: the
// 10 minutes of night in every 20.
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
  if (pinned !== null) return ((pinned < OPEN_FROM ? OPEN_FROM : 1 + OPEN_FROM) - pinned) * DAY_MS
  return nextPhaseAt(OPEN_FROM, now) - now
}

// "in 4 min", or "in 40s" in the last minute.
export function opensLabel(now = Date.now()) {
  const ms = msUntilNight(now)
  if (ms < MIN) return `in ${Math.max(1, Math.ceil(ms / 1000))}s`
  return `in ${Math.ceil(ms / MIN)} min`
}

// The hemisphere, for the loading splash in index.html (it picks the season
// before any of this loads).
try {
  localStorage.setItem('cartopia-sun', JSON.stringify({ south: south() }))
} catch {
  // No storage (tests, private mode): the splash assumes the north.
}
