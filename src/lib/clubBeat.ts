// The nightclub's beat, shared from the music to the club's LED windows. The
// club track (ambience.ts) reports each kick and bass note as it schedules it,
// at the moment it will be heard, so the lights land on the note without
// listening to the sound. With no music (muted, sound off, or too far from the
// club to hear it) the lights keep a gentle pulse at the night's tempo instead.
import { GROOVES, grooveFor } from './clubGrooves'
import { technoBeat, technoOn } from '../game/techno'

type Hit = { at: number; kick: boolean }
const hits: Hit[] = []
// After this long without a real hit, the gentle pulse takes over.
const QUIET_MS = 1200
// How fast a flash dies away.
const FADE_MS = 140

let step = 0
let flashAt = -Infinity
let flashOf = 0
let heard = -Infinity
let pulse = -1

// A kick or bass note that will be heard at `at` (performance.now() time, ms).
export function clubHit(at: number, kick: boolean) {
  hits.push({ at, kick })
  if (hits.length > 64) hits.splice(0, hits.length - 64)
}

export type ClubPulse = {
  step: number // goes up by one on every bass note: the colours move on
  flash: number // 0..1, peaks on each hit and fades
  live: boolean // following the music (false: the muted pulse)
}

export function clubPulse(now = performance.now(), bpm = GROOVES[grooveFor()].bpm): ClubPulse {
  // Techno Night: everything follows the event's kick, on the shared clock
  // (so it keeps time while muted too), a new colour on every beat.
  const wall = Date.now() - (performance.now() - now)
  if (technoOn(wall)) {
    const b = technoBeat(wall)
    return { step: b.beat, flash: Math.max(b.kick, b.drop), live: true }
  }
  hits.sort((a, b) => a.at - b.at)
  while (hits.length && hits[0].at <= now) {
    const h = hits.shift()!
    // A hit that is long gone (the tab slept) just moves the colours on.
    step++
    heard = h.at
    if (now - h.at < FADE_MS * 3) {
      flashAt = h.at
      flashOf = h.kick ? 1 : 0.6
    }
  }
  const live = now - heard < QUIET_MS
  if (!live) {
    const beat = Math.floor(now / (60000 / bpm))
    if (beat !== pulse) {
      if (pulse >= 0 && beat - pulse < 4) {
        step++
        flashAt = beat * (60000 / bpm)
        flashOf = 0.3
      }
      pulse = beat
    }
  } else pulse = -1
  const flash = flashOf * Math.exp(-Math.max(0, now - flashAt) / FADE_MS)
  return { step, flash, live }
}

// For tests.
export function resetClubBeat() {
  hits.length = 0
  step = 0
  flashAt = -Infinity
  flashOf = 0
  heard = -Infinity
  pulse = -1
}
