// The nightclub's DJ set: the club never plays one beat all night. It runs
// through its grooves (clubGrooves.ts) a few minutes each, mixing from one
// into the next, and each groove has its own arrangement: parts drop in and
// out, there's a breakdown and a drop, fills at the ends of phrases. All of
// it hangs off the wall clock at one tempo, so every player in every town
// hears the same moment of the same set. Pure numbers: ambience.ts plays it.
import { GROOVES, pinned } from './clubGrooves'

export const SET_BPM = 125
export const SIXTEENTH_MS = 60000 / SET_BPM / 4 // 120 ms
export const BAR_MS = SIXTEENTH_MS * 16 // 1.92 s
// Each groove leads the set for this long (about 3 minutes), so a ten-minute
// night hears three or four of them.
export const RUN_BARS = 96
// Two grooves play together over the mix. Halfway through, the incoming
// groove's kick and bass take over and the outgoing one fades away on top.
export const MIX_BARS = 16
export const SWAP_BARS = 8
export const SET_MS = RUN_BARS * BAR_MS

// A little hash for picking things that every player picks the same.
function hash(a: number, b: number) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h ^= h >>> 12
  return (h >>> 0) / 4294967296
}

// The groove that leads the set's k-th run. Every groove plays once in each
// round, in a shuffled order, never the same one twice in a row.
export function grooveOf(k: number): number {
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
  const r = Math.floor(k / n)
  const o = order(r)
  // The round's first groove can't be the last one of the round before.
  if (o[0] === order(r - 1)[n - 1]) [o[0], o[1]] = [o[1], o[0]]
  return o[((k % n) + n) % n]
}

// What one deck plays on one sixteenth.
export type Deck = {
  groove: number
  run: number // which run of the set this groove leads
  bar: number // bars since this groove started mixing in (0 .. RUN_BARS + MIX_BARS - 1)
  k: number // sixteenth in the bar
  lows: boolean // its kick and bass are in
  kick: boolean
  bass: boolean
  highs: number // 0..1, how loud its chords, hats, claps and acid line are
  bright: number // 0..1, how open its filter is
  stabs: boolean
  closedHats: boolean
  claps: boolean
  variant: boolean // the second half's bass line, with octave jumps
  roll: number // 0..1, a clap roll building into the next phrase (0: none)
  crash: boolean // a cymbal on the downbeat of a new section
  riser: number // 0..1 through a noise riser (0: none)
}

const ramp = (x: number, a: number, b: number) => Math.min(1, Math.max(0, (x - a) / (b - a)))

// A groove's arrangement, bar by bar from when it starts mixing in:
//   0-7     mixing in under the last groove: hats and filtered chords only
//   8-15    its kick and bass take over (the last groove fades out on top)
//   16-47   the groove, parts dropping in and out every eight bars
//   48-55   breakdown: no kick or bass, the chords open up, a riser and a clap roll
//   56-95   the drop, then the groove again with its second bass line
//   96-103  the next groove mixes in on top
//   104-111 kick and bass hand over, the rest fades out darker
function deck(run: number, bar: number, k: number): Deck {
  const groove = grooveOf(run)
  const end = RUN_BARS + MIX_BARS
  const lows = bar >= SWAP_BARS && bar < end - SWAP_BARS && !(bar >= 48 && bar < 56)
  let highs = 1
  let bright = 1
  if (bar < SWAP_BARS) {
    highs = 0.25 + 0.75 * ramp(bar + k / 16, 0, SWAP_BARS)
    bright = 0.3 + 0.5 * ramp(bar + k / 16, 0, SWAP_BARS)
  } else if (bar < MIX_BARS) bright = 0.8 + 0.2 * ramp(bar, SWAP_BARS, MIX_BARS)
  else if (bar >= end - SWAP_BARS) {
    const out = ramp(bar + k / 16, end - SWAP_BARS, end)
    highs = 1 - out
    bright = 1 - 0.75 * out
  } else if (bar >= 48 && bar < 56) bright = 0.3 + 0.7 * ramp(bar + k / 16, 48, 56)
  // Every eight bars of the groove, some parts sit out for a while.
  const block = Math.floor(bar / 8)
  const r = bar >= 24 && bar < 96 && !(bar >= 48 && bar < 64) ? hash(run * 31 + groove, block) : 1
  const stabs = r >= 0.2
  const closedHats = r < 0.2 || r >= 0.38
  // The last bar of an eight-bar phrase: the kick skips beat four and a clap
  // roll builds into the next one. The breakdown's last bar rolls all through.
  const phraseEnd = bar % 8 === 7 && lows && bar >= 16 && bar < 96
  const breakEnd = bar === 55
  const roll = breakEnd && k >= 4 ? (k - 3) / 12 : phraseEnd && k >= 12 ? (k - 11) / 4 : 0
  return {
    groove,
    run,
    bar,
    k,
    lows,
    kick: lows && k % 4 === 0 && !(phraseEnd && k === 12),
    bass: lows,
    highs,
    bright,
    stabs,
    closedHats,
    claps: lows || breakEnd,
    variant: bar >= 72 && bar < 96,
    roll,
    crash: k === 0 && (bar === 56 || bar === 16 || (bar >= 16 && bar < 96 && bar % 16 === 0)),
    riser: bar >= 52 && bar < 56 ? ramp(bar + k / 16, 52, 56) : 0,
  }
}

// Every deck playing on sixteenth n (counted from 1970 on the wall clock):
// one, or two while the set mixes from one groove into the next.
export function decksAt(n: number): Deck[] {
  const bar = Math.floor(n / 16)
  const k = ((n % 16) + 16) % 16
  // Run j leads from bar j*RUN_BARS; it starts mixing in MIX_BARS before.
  const run = Math.floor((bar + MIX_BARS) / RUN_BARS)
  const into = bar + MIX_BARS - run * RUN_BARS // bars since run `run` started mixing in
  const out: Deck[] = [deck(run, into, k)]
  // The run before is still mixing out over this run's first MIX_BARS.
  if (into < MIX_BARS) out.unshift(deck(run - 1, into + RUN_BARS, k))
  return out
}

// The groove whose kick and bass lead at sixteenth n: what the lights follow.
export function leadAt(n: number): Deck {
  const d = decksAt(n)
  return d.find((x) => x.lows) ?? d[d.length - 1]
}
