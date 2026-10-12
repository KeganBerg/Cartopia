// The nightclub's house grooves. Each town night plays a different one, picked
// from the shared town clock so every player hears the same set on the same
// night, and a reload doesn't change it. ?groove=0..4 pins one for testing.
import { nightNumber } from '../game/clock'

export type Tone = 'organ' | 'piano' | 'chop'
export type Groove = {
  name: string
  bpm: number
  swing: number // how late the in-between sixteenths land, as a share of one
  // One chord per bar: the bass root (Hz) and the chord's notes (Hz).
  loop: { root: number; notes: number[] }[]
  // Bass notes by sixteenth, as multiples of the bar's root (0 = rest).
  bass: number[]
  bassLen: number // in sixteenths
  // The sixteenths each bar's chord is stabbed on (by bar, looping).
  stabs: number[][]
  stabLen: number // in sixteenths
  tone: Tone
  claps: number[]
  openHats: number[]
  closedHats: 'odd' | 'all'
  // A squelchy acid line instead of chords: semitones above the bar's root
  // two octaves up (null = rest), and the steps that are accented.
  acid?: { notes: (number | null)[]; accents: number[] }
  sweep?: boolean // the chords' filter opens and closes over eight bars
  gain: number // evens the grooves out so each sits at the same level
}

const off = [2, 6, 10, 14]
export const GROOVES: Groove[] = [
  // Deep house: minor-ninth organ stabs over Am9, Fmaj9, Cmaj9, G6/9.
  {
    name: 'Deep',
    bpm: 124,
    swing: 0.14,
    loop: [
      { root: 55, notes: [220, 261.63, 329.63, 392, 493.88] },
      { root: 43.65, notes: [174.61, 220, 261.63, 329.63, 392] },
      { root: 65.41, notes: [164.81, 196, 246.94, 293.66, 392] },
      { root: 49, notes: [196, 246.94, 293.66, 329.63, 440] },
    ],
    bass: [0, 0, 1, 0, 0, 0, 1, 1.5, 0, 0, 1, 0, 0, 0, 2, 1],
    bassLen: 1.7,
    stabs: [[3, 6, 10], [3, 6, 10, 13], [3, 6, 10], [3, 6, 14]],
    stabLen: 1.6,
    tone: 'organ',
    claps: [4, 12],
    openHats: off,
    closedHats: 'odd',
    gain: 1,
  },
  // Piano house: bright Chicago-style piano chords and a bouncing octave bass.
  {
    name: 'Piano',
    bpm: 125,
    swing: 0.08,
    loop: [
      { root: 87.31, notes: [261.63, 329.63, 349.23, 440, 523.25] },
      { root: 98, notes: [293.66, 329.63, 392, 493.88, 587.33] },
      { root: 82.41, notes: [246.94, 293.66, 329.63, 392, 493.88] },
      { root: 110, notes: [261.63, 329.63, 392, 440, 523.25] },
    ],
    bass: [0, 0, 0.5, 0, 0, 0, 1, 0, 0, 0, 0.5, 0, 0, 1, 0.5, 0],
    bassLen: 1.4,
    stabs: [[0, 3, 6, 8, 11, 14], [3, 6, 10], [0, 3, 6, 8, 11, 14], [3, 6, 10, 13]],
    stabLen: 1.4,
    tone: 'piano',
    claps: [4, 12],
    openHats: off,
    closedHats: 'all',
    gain: 1,
  },
  // Garage: heavy swing, long rolling bass notes and short organ hits in D minor.
  {
    name: 'Garage',
    bpm: 130,
    swing: 0.3,
    loop: [
      { root: 73.42, notes: [174.61, 220, 261.63, 329.63] },
      { root: 49, notes: [174.61, 233.08, 293.66, 349.23] },
      { root: 58.27, notes: [174.61, 220, 233.08, 293.66] },
      { root: 55, notes: [196, 220, 293.66, 329.63] },
    ],
    bass: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 1, 0, 0],
    bassLen: 2.6,
    stabs: [[2, 7, 10], [2, 7], [2, 7, 10], [2, 7, 13]],
    stabLen: 1.1,
    tone: 'organ',
    claps: [4, 12],
    openHats: off,
    closedHats: 'all',
    gain: 1,
  },
  // Acid house: a squelchy, resonant bassline in A that slowly opens up.
  {
    name: 'Acid',
    bpm: 126,
    swing: 0.1,
    loop: [{ root: 55, notes: [] }],
    bass: Array(16).fill(0),
    bassLen: 1,
    stabs: [[]],
    stabLen: 1,
    tone: 'organ',
    claps: [4, 12],
    openHats: off,
    closedHats: 'all',
    acid: { notes: [0, null, 12, 0, null, 3, 0, null, 12, 0, 7, null, 3, 12, null, 10], accents: [2, 8, 13] },
    sweep: true,
    gain: 1,
  },
  // Disco house: funky chopped chords that a filter sweeps open and shut, over
  // an octave-hopping disco bass in Eb, Dm, Cm, F.
  {
    name: 'Disco',
    bpm: 122,
    swing: 0.06,
    loop: [
      { root: 77.78, notes: [311.13, 392, 466.16, 587.33] },
      { root: 73.42, notes: [293.66, 349.23, 440, 523.25] },
      { root: 65.41, notes: [261.63, 311.13, 392, 466.16] },
      { root: 87.31, notes: [349.23, 440, 523.25, 587.33] },
    ],
    bass: [0.5, 0, 1, 0, 0.5, 0, 1, 0, 0.5, 0, 1, 0, 0.5, 0, 1, 0],
    bassLen: 1.6,
    stabs: [[2, 3, 6, 10, 11, 14], [2, 6, 10, 14], [2, 3, 6, 10, 11, 14], [2, 6, 9, 12, 14]],
    stabLen: 0.9,
    tone: 'chop',
    claps: [4, 12],
    openHats: off,
    closedHats: 'odd',
    sweep: true,
    gain: 1,
  },
]

const pinned = (() => {
  if (typeof location === 'undefined') return null
  const v = new URLSearchParams(location.search).get('groove')
  return v === null ? null : Number(v)
})()

// The groove for the night that's on at a given moment. The night number counts
// up at noon, so a whole night keeps one groove, and stepping through the list
// means two nights in a row never repeat.
export function grooveFor(now = Date.now()): number {
  if (pinned !== null && GROOVES[pinned]) return pinned
  return nightNumber(now) % GROOVES.length
}
