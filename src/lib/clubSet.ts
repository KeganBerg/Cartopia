// What the nightclub plays: one track all night, a different one every night.
// The track is picked from the town clock's night number (the same for every
// player), and its sixteenths are counted from the start of that night at its
// own tempo, so every player in every town hears the same moment of it. Each
// track runs through an arrangement over and over: a groove, the hook comes
// in, a breakdown with a riser, the drop, parts dropping in and out every
// eight bars, fills at the ends of phrases. Pure numbers: ambience.ts plays it.
import { GROOVES, pinned } from './clubGrooves'
import { DAY_MS } from '../game/clock'

// One pass of the arrangement, in bars (about two minutes at house tempo).
export const CYCLE_BARS = 64
// The breakdown: no kick or bass, a riser into the drop.
export const BREAK_FROM = 32
export const DROP_AT = 40

// A little hash for picking things that every player picks the same.
function hash(a: number, b: number) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h ^= h >>> 12
  return (h >>> 0) / 4294967296
}

// The track for a night (nightNumber in clock.ts). Every track plays once in
// each round of nights, in a shuffled order, never the same one twice in a row.
export function trackOf(night: number): number {
  if (pinned !== null) return pinned
  const n = GROOVES.length
  const order = (r: number) => {
    const o = GROOVES.map((_, i) => i)
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(hash(r, i) * (i + 1))
      ;[o[i], o[j]] = [o[j], o[i]]
    }
    return o
  }
  const r = Math.floor(night / n)
  const o = order(r)
  // The round's first track can't be the last one of the round before.
  if (o[0] === order(r - 1)[n - 1]) [o[0], o[1]] = [o[1], o[0]]
  return o[((night % n) + n) % n]
}

// A track's sixteenth and bar, in ms.
export const sixteenthMs = (g: number) => 60000 / GROOVES[g].bpm / 4
export const barMs = (g: number) => sixteenthMs(g) * 16
const nightOf = (wall: number) => Math.floor(wall / DAY_MS)

// Where the music is at a moment on the wall clock: which night, and which
// sixteenth of that night's track (counted from the night's start).
export function sixAt(wall: number) {
  const night = nightOf(wall)
  return { night, n: Math.floor((wall - night * DAY_MS) / sixteenthMs(trackOf(night))) }
}
// When sixteenth n of a night's track plays, on the wall clock.
export const wallOf = (night: number, n: number) => night * DAY_MS + n * sixteenthMs(trackOf(night))
// The tempo playing at a moment (the lights' gentle pulse keeps it while muted).
export const bpmAt = (wall = Date.now()) => GROOVES[trackOf(nightOf(wall))].bpm
// The first night at or after `from` that plays track g, and when it starts
// (for clips and tests).
export function nightWith(g: number, from = 0) {
  for (let night = from; ; night++) if (trackOf(night) === g) return night
}

// What the track plays on one sixteenth.
export type Deck = {
  groove: number
  night: number
  cycle: number // which pass of the arrangement
  bar: number // bar of the arrangement (0 .. CYCLE_BARS - 1)
  k: number // sixteenth in the bar
  lows: boolean // the kick and bass are in
  kick: boolean
  bass: boolean
  highs: number // 0..1, how loud the chords, hats, claps and lines are
  bright: number // 0..1, how open their filter is
  stabs: boolean
  closedHats: boolean
  claps: boolean
  lead: boolean // the hook plays
  variant: boolean // the second half's bass line, with octave jumps
  roll: number // 0..1, a snare roll building into the next phrase (0: none)
  crash: boolean // a cymbal on the downbeat of a new section
  riser: number // 0..1 through a noise riser (0: none)
}

const ramp = (x: number, a: number, b: number) => Math.min(1, Math.max(0, (x - a) / (b - a)))

// The arrangement, bar by bar, played over and over all night:
//   0-15   the groove; parts drop in and out
//   16-31  the hook comes in
//   32-39  breakdown: no kick or bass, the chords open up, a riser and a snare roll
//   40-63  the drop, then the groove again with its second bass line
// Something always plays (at least the chords, hats or hook), so the music
// never goes quiet, and the last bar flows straight into the first.
export function deckAt(night: number, n: number): Deck {
  const groove = trackOf(night)
  const g = GROOVES[groove]
  const k = ((n % 16) + 16) % 16
  const total = Math.floor(n / 16)
  const cycle = Math.floor(total / CYCLE_BARS)
  const bar = total - cycle * CYCLE_BARS
  const broken = bar >= BREAK_FROM && bar < DROP_AT
  const lows = !broken
  const bright = broken ? 0.3 + 0.7 * ramp(bar + k / 16, BREAK_FROM, DROP_AT) : 1
  // Every eight bars of the groove, some parts sit out for a while (never in
  // the first eight bars, the breakdown or the first half of the drop).
  const block = Math.floor(bar / 8)
  const r = (bar >= 8 && bar < BREAK_FROM) || bar >= DROP_AT + 16 ? hash(night * 131 + cycle * 7 + groove, block) : 1
  const stabs = r >= 0.2
  const closedHats = r < 0.2 || r >= 0.38
  // The hook: from bar 16 to the end, but resting for eight bars now and then.
  const lead = !!g.lead && bar >= 16 && !(bar >= DROP_AT + 16 && r < 0.3)
  // The last bar of an eight-bar phrase: the kick skips the last beat and a
  // snare roll builds into the next one. The breakdown's last bar rolls all through.
  const phraseEnd = bar % 8 === 7 && lows
  const breakEnd = bar === DROP_AT - 1
  const roll = breakEnd && k >= 4 ? (k - 3) / 12 : phraseEnd && k >= 12 && (bar % 16 === 15 || hash(night, total) < 0.5) ? (k - 11) / 4 : 0
  const kicks = g.kick ?? [0, 4, 8, 12]
  return {
    groove,
    night,
    cycle,
    bar,
    k,
    lows,
    kick: lows && kicks.includes(k) && !(roll > 0 && k >= 12),
    bass: lows,
    highs: 1,
    bright,
    stabs: stabs || broken,
    closedHats: closedHats && !(broken && bar < BREAK_FROM + 4),
    claps: lows || breakEnd,
    lead,
    variant: bar >= DROP_AT + 8,
    roll,
    crash: k === 0 && (bar === 0 || bar === 16 || bar === DROP_AT || bar === DROP_AT + 16),
    riser: bar >= DROP_AT - 4 && bar < DROP_AT ? ramp(bar + k / 16, DROP_AT - 4, DROP_AT) : 0,
  }
}
