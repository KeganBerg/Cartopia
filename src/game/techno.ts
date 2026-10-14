// Rave Mode (the techno live event): the whole town drops into the night and
// plays onte's "halcyon" (NCS): a ten-second warning while its build-up fades
// in, then its big drop, and the HUD, the club, the Vanguard Tower and the
// street lamps all go off on the kick.
//
// Kegan starts it from the Neon Owl's Rave button (only his account can: the
// server's rave_start() checks it), and the drop lands exactly ten seconds
// after the press for everyone. It also comes on by itself every Friday at
// 10:00 pm on each player's own clock, with the warning in the ten seconds
// before. A live event row of kind 'rave' (or 'techno') starts it too:
// `select public.live_event_start('rave', 15);` drops ten seconds after the
// row's start. ?event=rave pins it on for testing. In code:
// startEvent('techno', { until }) / stopEvent('techno').
//
// The music runs on the wall clock from the drop: sixteenth n plays at
// drop + n * SIXTEENTH_MS (negative through the warning), so everyone in the
// same event hears the same bar, and the lights keep time while the sound is muted.
import { forceNight } from './clock'
import { registerLiveKind } from './liveEvents'

export type LiveEventKind = 'techno'

// halcyon's tempo.
export const TECHNO_BPM = 132
export const SIXTEENTH_MS = 60000 / TECHNO_BPM / 4 // about 114 ms
export const BAR_MS = SIXTEENTH_MS * 16 // about 1.82 s
// The warning before the drop: the song's build-up, fading in.
export const BUILD_MS = 10_000
// After the drop its sixteen bars (about 29 s) loop: four bars of drop, eight
// of groove, four at the peak, then it drops again.
export const CYCLE_BARS = 16
export type Section = 'drop' | 'groove' | 'peak' | 'break'
// The section of a bar, counted from the drop (negative = the warning's build-up).
export function sectionOf(bar: number): Section {
  if (bar < 0) return 'break'
  const p = bar % CYCLE_BARS
  return p < 4 ? 'drop' : p < 12 ? 'groove' : 'peak'
}
const mod = (a: number, b: number) => ((a % b) + b) % b
// Whether the kick plays on sixteenth n (not through the build-up).
export const kickOn = (n: number) => mod(n, 4) === 0 && sectionOf(Math.floor(n / 16)) !== 'break'

// How long the town takes to slide into the night and back out of it.
const EASE_MS = 6000

let from = -Infinity // when it switched on, the start of the build-up (wall ms)
let dropAt = 0 // the drop (wall ms)
let until = 0 // when it ends (wall ms)
let endedAt = -Infinity
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

export const technoOn = (now = Date.now()) => now >= from && now < until
export const technoDrop = () => dropAt

function changed() {
  listeners.forEach((l) => l())
}
export function onTechnoChange(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

// Starts (or extends) the event. `from` is when the build-up starts (default
// now; a late joiner passes the server's start so everyone is on the same
// bar), `drop` when it drops (default a build-up after `from`), `until` when
// it ends (left out, it runs until stopEvent).
export function startEvent(kind: LiveEventKind, opts: { from?: number; drop?: number; until?: number } = {}) {
  if (kind !== 'techno') return
  const now = Date.now()
  const end = opts.until ?? Infinity
  if (end <= now) return
  if (!technoOn(now)) {
    from = Math.min(now, opts.from ?? now)
    dropAt = opts.drop ?? from + BUILD_MS
  }
  until = end
  if (timer) clearTimeout(timer)
  timer = null
  if (Number.isFinite(end)) timer = setTimeout(() => stopEvent('techno'), Math.min(end - now, 2 ** 31 - 1))
  changed()
}

export function stopEvent(kind: LiveEventKind = 'techno') {
  if (kind !== 'techno') return
  const now = Date.now()
  if (timer) clearTimeout(timer)
  timer = null
  // Ended on time (the timer lands right on `until`) or cut short.
  if (until > from && now >= from) endedAt = Math.min(now, until)
  until = 0
  changed()
}

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

// 0..1: how far the event pulls the town clock into the night.
export function technoNight(now = Date.now()) {
  if (technoOn(now)) return smooth((now - from) / EASE_MS)
  return 1 - smooth((now - endedAt) / EASE_MS)
}
forceNight(technoNight)

// Milliseconds left, or null when it has no set end.
export function technoLeft(now = Date.now()) {
  return technoOn(now) && Number.isFinite(until) ? until - now : null
}
// Milliseconds to the drop (0 once it has dropped).
export const technoToDrop = (now = Date.now()) => Math.max(0, dropAt - now)

// Where the music is at a moment: what the HUD and the lights dance to.
export type TechnoBeat = {
  n: number // sixteenth number from the drop (negative in the build-up)
  beat: number // quarter-note number
  bar: number
  section: Section
  kick: number // 0..1, peaks on each kick and dies away
  side: 1 | -1 // flips every beat, for things that rock left and right
  build: number // 0..1 through the build-up, rising into the drop
  drop: number // 0..1, a big flash on the drop that fades over two bars
}
export function technoBeat(now = Date.now(), at = dropAt): TechnoBeat {
  const rel = now - at
  const n = Math.floor(rel / SIXTEENTH_MS)
  const beat = Math.floor(n / 4)
  const bar = Math.floor(n / 16)
  const section = sectionOf(bar)
  const since = rel - beat * 4 * SIXTEENTH_MS
  const kick = kickOn(beat * 4) ? Math.exp(-since / 130) : 0
  const build = rel < 0 ? Math.max(0, 1 + rel / BUILD_MS) : 0
  const p = mod(bar, CYCLE_BARS)
  const drop = bar >= 0 && p < 2 ? Math.exp(-(rel - (bar - p) * BAR_MS) / 900) : 0
  return { n, beat, bar, section, kick, side: mod(beat, 2) ? -1 : 1, build, drop }
}

for (const kind of ['rave', 'techno']) registerLiveKind(kind, { start: (e) => startEvent('techno', { from: e.from, until: e.to }), stop: () => stopEvent('techno') })

// Every Friday at 10:00 pm on the player's own clock it drops, for one minute,
// after a build-up through the minute before.
export const WEEKLY = { day: 5, hour: 22, minutes: 1 }
// The weekly rave around `now` (build-up start, drop and end), or null outside it.
export function weeklyRave(now = Date.now()): { from: number; drop: number; to: number } | null {
  const d = new Date(now)
  d.setDate(d.getDate() + (WEEKLY.day - d.getDay()))
  d.setHours(WEEKLY.hour, 0, 0, 0)
  const drop = d.getTime()
  const w = { from: drop - BUILD_MS, drop, to: drop + WEEKLY.minutes * 60000 }
  return now >= w.from && now < w.to ? w : null
}
// Checked every second; it only starts one when nothing else is on, so a rave
// started from SQL keeps its own timing.
let weekly = 0
function checkWeekly() {
  const w = weeklyRave()
  if (w && weekly !== w.drop && !technoOn()) {
    weekly = w.drop
    startEvent('techno', { from: w.from, drop: w.drop, until: w.to })
  }
}
if (typeof window !== 'undefined') {
  checkWeekly()
  setInterval(checkWeekly, 1000)
}

// ?event=rave (or techno) turns it on for testing, with no end.
if (typeof location !== 'undefined' && ['rave', 'techno'].includes(new URLSearchParams(location.search).get('event') ?? '')) startEvent('techno')
