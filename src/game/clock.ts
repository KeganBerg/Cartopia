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

// The phase over each 20-minute day, starting at noon: a gentle S-curve so
// dusk is halfway done (phase 0.3) at 5 minutes and dawn (0.7) at 15, giving
// day and night 10 minutes each, with no sudden change of pace anywhere.
const WARP = 0.05
const cyclePhase = (t: number) => t + WARP * Math.sin(2 * Math.PI * t) // t: 0..1 of the day

// The shared clock's phase at `now`, ignoring pins and events. 0 = noon, 0.5 = midnight.
export function naturalPhase(now = Date.now()) {
  return cyclePhase((((now % DAY_MS) + DAY_MS) % DAY_MS) / DAY_MS)
}

// The next moment (at or after `now`) the shared clock reaches `phase`.
export function nextPhaseAt(phase: number, now = Date.now()) {
  // cyclePhase only ever climbs, so halve the interval until it pins the moment.
  let lo = 0, hi = 1
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (cyclePhase(mid) < phase) lo = mid
    else hi = mid
  }
  const day = now - (((now % DAY_MS) + DAY_MS) % DAY_MS)
  const t = day + Math.round(hi * DAY_MS)
  return t >= now ? t : t + DAY_MS
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

// How dark it is, 0 (day) to 1 (night). The light eases out over about four
// minutes of every dusk (and back in at dawn), slow at both ends so neither the
// first lamps nor the last glow of sunset arrive with a jump.
const ease = (x: number) => x * x * (3 - 2 * x)
export function nightAmount(phase: number) {
  const d = Math.abs(phase - 0.5) // 0 at midnight, 0.5 at noon
  if (d <= 0.1) return 1
  if (d >= 0.3) return 0
  return ease((0.3 - d) / 0.2)
}

// How much of a sunset tint to add: swells through dusk and dawn over about
// five minutes, peaking just before the light is half gone, and fades away
// smoothly on both sides.
export function duskAmount(phase: number) {
  const d = Math.abs(phase - 0.5)
  return ease(Math.max(0, 1 - Math.abs(d - 0.22) / 0.13))
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
