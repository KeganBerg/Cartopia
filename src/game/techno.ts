// The Techno Night live event: the whole town drops into the night, a 150 bpm
// techno track plays everywhere, and the HUD, the club, the Vanguard Tower and
// the street lamps all go off on the kick.
//
// Turning it on and off: startEvent('techno', { until }) / stopEvent('techno').
// A live event row of kind 'techno' calls these when it starts and ends
// (Kegan: `select public.live_event_start('rave', 15);` for 15 minutes; it
// shows as RAVE MODE, and 'techno' works too); ?event=rave pins it on for testing.
//
// The music runs on the shared wall clock: sixteenth number n plays at
// n * 100 ms since 1970, so every player online hears the same bar, the same
// breakdown and the same drop at the same moment, and the lights still keep
// time while the sound is muted.
import { forceNight } from './clock'
import { registerLiveKind } from './liveEvents'

export type LiveEventKind = 'techno'

export const TECHNO_BPM = 150
export const SIXTEENTH_MS = 60000 / TECHNO_BPM / 4 // 100 ms
export const BAR_MS = SIXTEENTH_MS * 16 // 1.6 s
// The arrangement repeats every 24 bars (38.4 s): the drop, eight bars of
// groove, four with stabs and ride, four stripped back, then a four-bar
// breakdown and riser into the next drop.
export const CYCLE_BARS = 24
export type Section = 'drop' | 'groove' | 'peak' | 'tension' | 'break'
export function sectionOf(bar: number): Section {
  const p = ((bar % CYCLE_BARS) + CYCLE_BARS) % CYCLE_BARS
  return p < 4 ? 'drop' : p < 12 ? 'groove' : p < 16 ? 'peak' : p < 20 ? 'tension' : 'break'
}
// Whether the kick plays on a sixteenth (the breakdown drops it).
export const kickOn = (n: number) => n % 4 === 0 && sectionOf(Math.floor(n / 16)) !== 'break'

// How long the town takes to slide into the night and back out of it.
const EASE_MS = 4000

let from = -Infinity // when it last switched on (wall ms)
let until = 0 // when it ends (wall ms)
let endedAt = -Infinity
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

export const technoOn = (now = Date.now()) => now >= from && now < until

function changed() {
  listeners.forEach((l) => l())
}
export function onTechnoChange(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

// Starts (or extends) a live event. `until` is when it ends (ms since 1970);
// left out, it runs until stopEvent. `from` lets a late joiner keep the start
// time the server gave, so the town doesn't fade in twice.
export function startEvent(kind: LiveEventKind, opts: { until?: number; from?: number } = {}) {
  if (kind !== 'techno') return
  const now = Date.now()
  const end = opts.until ?? Infinity
  if (end <= now) return
  if (!technoOn(now)) from = Math.min(now, opts.from ?? now)
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

// Where the music is at a moment: what the HUD and the lights dance to.
export type TechnoBeat = {
  n: number // sixteenth number since 1970
  beat: number // quarter-note number
  bar: number
  section: Section
  kick: number // 0..1, peaks on each kick and dies away
  side: 1 | -1 // flips every beat, for things that rock left and right
  build: number // 0..1 through the breakdown, rising into the drop
  drop: number // 0..1, a big flash on the drop that fades over two bars
}
export function technoBeat(now = Date.now()): TechnoBeat {
  const n = Math.floor(now / SIXTEENTH_MS)
  const beat = Math.floor(n / 4)
  const bar = Math.floor(n / 16)
  const section = sectionOf(bar)
  const since = now - beat * 4 * SIXTEENTH_MS
  const kick = kickOn(beat * 4) ? Math.exp(-since / 130) : 0
  const p = ((bar % CYCLE_BARS) + CYCLE_BARS) % CYCLE_BARS
  const build = section === 'break' ? (p - 20 + (now - bar * BAR_MS) / BAR_MS) / 4 : 0
  const drop = section === 'drop' && p < 2 ? Math.exp(-(now - (bar - p) * BAR_MS) / 900) : 0
  return { n, beat, bar, section, kick, side: beat % 2 ? -1 : 1, build, drop }
}

for (const kind of ['rave', 'techno']) registerLiveKind(kind, { start: (e) => startEvent('techno', { from: e.from, until: e.to }), stop: () => stopEvent('techno') })

// ?event=rave (or techno) turns it on for testing, with no end.
if (typeof location !== 'undefined' && ['rave', 'techno'].includes(new URLSearchParams(location.search).get('event') ?? '')) startEvent('techno')
