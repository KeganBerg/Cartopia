// The nightclub's beat, shared from the music to the club's lights. The club
// track (ambience.ts) reports every note it schedules as a cue, timed to the
// moment it will be heard, so the lights land on the note without listening to
// the sound. Only the kick moves the colour on, once a beat ("doot doot doot
// doot"); the other parts (bass, chords, hats, claps, the acid line, the hook,
// hand drums) only make the lights flash, each of the club's tracks in its own
// way (clubLeds.ts). With no music (muted, sound off, or too far from the club
// to hear it) the lights keep a gentle pulse at the night's tempo instead.
import { bpmAt } from './clubSet'
import { SIXTEENTH_MS, technoBeat, technoDrop, technoOn } from '../game/techno'

// 'beat' marks every beat of the set, kick or not (a breakdown has none), so
// the dancers keep time; it never flashes.
export type CueKind = 'kick' | 'bass' | 'stab' | 'acid' | 'clap' | 'hat' | 'open' | 'lead' | 'perc' | 'beat'
export const CUES: CueKind[] = ['kick', 'bass', 'stab', 'acid', 'clap', 'hat', 'open', 'lead', 'perc', 'beat']
// How fast each part's flash dies away (ms): a hat is a blink, a chord rings.
const FADE: Record<CueKind, number> = { kick: 140, bass: 220, stab: 240, acid: 110, clap: 110, hat: 45, open: 150, lead: 180, perc: 90, beat: 1 }

type Hit = { at: number; kind: CueKind; amt: number; groove: number }
const hits: Hit[] = []
// After this long without a real hit, the gentle pulse takes over.
const QUIET_MS = 1200

let step = 0
let heard = -Infinity
let pulse = -1
let rave = 0
let raveBeat = -1
let kickAt = -Infinity
let groove = -1
const last = Object.fromEntries(CUES.map((k) => [k, { at: -Infinity, amt: 0 }])) as Record<CueKind, { at: number; amt: number }>

// A note that will be heard at `at` (performance.now() time, ms): which part
// played it, how strongly (0..1) and in which groove.
export function clubHit(at: number, kind: CueKind, amt = 1, g = -1) {
  hits.push({ at, kind, amt, groove: g })
  if (hits.length > 256) hits.splice(0, hits.length - 256)
}

export type ClubPulse = {
  step: number // goes up by one on every kick: the colours move on
  flash: number // 0..1, peaks on each kick and fades
  live: boolean // following the music (false: the muted pulse)
  groove: number // the track playing (-1: none, the muted pulse or Rave Mode)
  beat: number // 0..1 through the current beat
  env: Record<CueKind, number> // 0..1 per part, peaking on each of its notes
}

const env = (now: number) => Object.fromEntries(CUES.map((k) => [k, last[k].amt * Math.exp(-Math.max(0, now - last[k].at) / FADE[k]) * (now >= last[k].at ? 1 : 0)])) as Record<CueKind, number>

export function clubPulse(now = performance.now(), bpm = bpmAt(Date.now() - (performance.now() - now))): ClubPulse {
  // Rave Mode: everything follows the event's kick, on the shared clock (so
  // it keeps time while muted too), a new colour on every kick. Through the
  // kickless breakdown the colour holds.
  const wall = Date.now() - (performance.now() - now)
  if (technoOn(wall)) {
    const b = technoBeat(wall)
    if (b.kick > 0 && b.beat !== raveBeat) {
      rave++
      raveBeat = b.beat
    }
    const beat = (wall - technoDrop()) / (4 * SIXTEENTH_MS) - b.beat
    const e = Object.fromEntries(CUES.map((k) => [k, 0])) as Record<CueKind, number>
    e.kick = b.kick
    return { step: rave, flash: Math.max(b.kick, b.drop), live: true, groove: -1, beat, env: e }
  }
  hits.sort((a, b) => a.at - b.at)
  while (hits.length && hits[0].at <= now) {
    const h = hits.shift()!
    heard = h.at
    groove = h.groove
    if (h.kind === 'kick') {
      // A kick that is long gone (the tab slept) just moves the colours on.
      step++
      kickAt = h.at
    }
    if (h.kind === 'beat') kickAt = h.at
    if (now - h.at < FADE[h.kind] * 3) last[h.kind] = { at: h.at, amt: h.amt }
  }
  const live = now - heard < QUIET_MS
  const beatMs = 60000 / bpm
  if (!live) {
    const beat = Math.floor(now / beatMs)
    if (beat !== pulse) {
      if (pulse >= 0 && beat - pulse < 4) {
        step++
        last.kick = { at: beat * beatMs, amt: 0.3 }
      }
      pulse = beat
    }
    kickAt = Math.floor(now / beatMs) * beatMs
  } else pulse = -1
  const e = env(now)
  return { step, flash: e.kick, live, groove: live ? groove : -1, beat: Math.min(1, Math.max(0, (now - kickAt) / beatMs)), env: e }
}

// For tests.
export function resetClubBeat() {
  hits.length = 0
  step = 0
  heard = -Infinity
  pulse = -1
  rave = 0
  raveBeat = -1
  kickAt = -Infinity
  groove = -1
  for (const k of CUES) last[k] = { at: -Infinity, amt: 0 }
}
