// The nightclub's tracks: one plays all night, and every night it's a
// different one (clubSet.ts picks it from the town clock, the same for every
// player). They're different kinds of dance music, each with its own tempo,
// key, drum pattern, bass sound and hook, so no two nights sound alike even
// through the club's walls. ?groove=0..n pins one for testing.

export type Tone = 'organ' | 'piano' | 'chop' | 'pad'
export type KickTone = 'house' | 'punch' | 'hard' | 'boom'
export type SnareTone = 'clap' | 'snare' | 'rim'
export type BassTone = 'saw' | 'square' | 'sub' | 'reese' | 'wobble'
export type LeadTone = 'supersaw' | 'pluck' | 'square' | 'bell' | 'brass'
export type Groove = {
  name: string
  bpm: number
  swing: number // how late the in-between sixteenths land, as a share of one
  // One chord per bar: the bass root (Hz) and the chord's notes (Hz).
  loop: { root: number; notes: number[] }[]
  // Bass notes by sixteenth, as multiples of the bar's root (0 = rest).
  bass: number[]
  bassLen: number // in sixteenths
  bassTone?: BassTone // default saw
  wobble?: number // wobble bass: filter wobbles per beat
  // The sixteenths each bar's chord is stabbed on (by bar, looping).
  stabs: number[][]
  stabLen: number // in sixteenths
  tone: Tone
  kick?: number[] // the sixteenths the kick lands on (default four to the floor)
  kickTone?: KickTone // default house
  claps: number[]
  snare?: SnareTone // what plays on `claps` (default a hand clap)
  openHats: number[]
  closedHats: 'odd' | 'all' | 'eighths'
  perc?: number[] // hand drums (congas) on these sixteenths
  // A squelchy acid line instead of chords: semitones above the bar's root
  // two octaves up (null = rest), and the steps that are accented.
  acid?: { notes: (number | null)[]; accents: number[] }
  // The hook: a melody over whole bars (16 steps each, looping), in
  // semitones above `root` (null = rest), each note `len` sixteenths long.
  lead?: { root: number; notes: (number | null)[]; len: number; tone: LeadTone }
  sweep?: boolean // the chords' filter opens and closes over eight bars
  gain: number // evens the tracks out so each sits at the same level
}

// A note's pitch: hz('A4') = 440.
const NAMES: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 }
export function hz(note: string) {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(note)
  if (!m) throw new Error(`bad note ${note}`)
  return 440 * 2 ** ((NAMES[m[1]] + 12 * (Number(m[2]) + 1) - 69) / 12)
}
const chord = (root: string, notes: string) => ({ root: hz(root), notes: notes.split(' ').map(hz) })
// A melody, bar by bar: each bar maps sixteenths to semitones.
function tune(...bars: Record<number, number>[]): (number | null)[] {
  const out: (number | null)[] = []
  for (const b of bars) for (let k = 0; k < 16; k++) out.push(b[k] ?? null)
  return out
}

const off = [2, 6, 10, 14]
export const GROOVES: Groove[] = [
  // Deep house: minor-ninth organ stabs over Am9, Fmaj9, Cmaj9, G6/9, and a
  // soft bell hook.
  {
    name: 'Deep',
    bpm: 120,
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
    lead: { root: hz('A4'), notes: tune({ 0: 7, 6: 12, 10: 10 }, { 0: 7, 6: 3, 10: 0 }, { 0: 10, 6: 14, 10: 7 }, { 0: 5, 6: 2, 10: 7 }), len: 3, tone: 'bell' },
    gain: 1,
  },
  // Piano house: bright Chicago-style piano chords and a bouncing octave bass.
  {
    name: 'Piano',
    bpm: 124,
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
  // UK garage: a skippy two-step kick, heavy swing, long rolling bass notes,
  // short organ hits and chopped-up vocal-like plucks in D minor.
  {
    name: 'Garage',
    bpm: 132,
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
    kick: [0, 7, 10],
    claps: [4, 12],
    snare: 'snare',
    openHats: off,
    closedHats: 'all',
    lead: { root: hz('D4'), notes: tune({ 3: 12, 5: 10, 9: 7, 13: 3 }, { 3: 10, 5: 8, 9: 5, 13: 3 }, { 3: 12, 5: 8, 9: 10, 13: 7 }, { 3: 11, 5: 7, 9: 4, 11: 7, 13: 9 }), len: 1.2, tone: 'pluck' },
    gain: 1,
  },
  // Acid house: a squelchy, resonant bassline in A that slowly opens up.
  {
    name: 'Acid',
    bpm: 128,
    swing: 0.1,
    loop: [{ root: 55, notes: [] }],
    bass: Array(16).fill(0),
    bassLen: 1,
    stabs: [[]],
    stabLen: 1,
    tone: 'organ',
    kickTone: 'punch',
    claps: [4, 12],
    openHats: off,
    closedHats: 'all',
    acid: { notes: [0, null, 12, 0, null, 3, 0, null, 12, 0, 7, null, 3, 12, null, 10], accents: [2, 8, 13] },
    sweep: true,
    gain: 1,
  },
  // Disco house: funky chopped chords that a filter sweeps open and shut, over
  // an octave-hopping disco bass in Eb, Dm, Cm, F, with a string riff.
  {
    name: 'Disco',
    bpm: 116,
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
    lead: { root: hz('Eb4'), notes: tune({ 0: 12, 12: 7, 14: 12 }, { 0: 11, 12: 6, 14: 11 }, { 0: 9, 12: 4, 14: 9 }, { 0: 14, 10: 9, 12: 11, 14: 14 }), len: 2.5, tone: 'brass' },
    sweep: true,
    gain: 1,
  },
  // Tech house: a rolling off-beat bass, sparse chopped hits and busy hats in F minor.
  {
    name: 'Tech',
    bpm: 126,
    swing: 0.1,
    loop: [
      { root: 43.65, notes: [174.61, 207.65, 261.63, 311.13, 392] },
      { root: 43.65, notes: [174.61, 207.65, 261.63, 311.13, 392] },
      { root: 69.3, notes: [138.59, 174.61, 207.65, 261.63, 311.13] },
      { root: 58.27, notes: [233.08, 277.18, 349.23, 415.3] },
    ],
    bass: [0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 2],
    bassLen: 0.9,
    stabs: [[7], [7, 13], [7], [3, 7, 13]],
    stabLen: 0.8,
    tone: 'chop',
    kickTone: 'punch',
    claps: [4, 12],
    openHats: off,
    closedHats: 'all',
    perc: [3, 11, 14],
    sweep: true,
    gain: 1,
  },
  // Jackin' house: a bouncy sixteenth bass and swung organ jabs in G minor.
  {
    name: 'Jackin',
    bpm: 125,
    swing: 0.22,
    loop: [
      { root: 49, notes: [196, 233.08, 293.66, 349.23] },
      { root: 65.41, notes: [261.63, 329.63, 392, 466.16] },
      { root: 77.78, notes: [155.56, 196, 233.08, 293.66] },
      { root: 73.42, notes: [185, 220, 261.63, 293.66] },
    ],
    bass: [1, 0, 2, 0, 0, 1, 0, 2, 0, 0, 1, 0, 2, 0, 1, 0],
    bassLen: 1.2,
    stabs: [[2, 6, 10, 14], [2, 6, 11], [2, 6, 10, 14], [2, 5, 8, 11]],
    stabLen: 1,
    tone: 'organ',
    claps: [4, 12],
    openHats: off,
    closedHats: 'odd',
    gain: 1,
  },
  // Trance: a galloping off-beat bass, held pads and a soaring supersaw
  // arpeggio over Am, F, C, G.
  {
    name: 'Trance',
    bpm: 138,
    swing: 0,
    loop: [chord('A1', 'A3 C4 E4'), chord('F1', 'F3 A3 C4'), chord('C2', 'G3 C4 E4'), chord('G1', 'G3 B3 D4')],
    bass: [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1],
    bassLen: 0.8,
    stabs: [[0]],
    stabLen: 15,
    tone: 'pad',
    claps: [4, 12],
    openHats: off,
    closedHats: 'all',
    lead: {
      root: hz('A4'),
      notes: tune(
        { 0: 7, 1: 3, 2: 0, 3: 3, 4: 7, 5: 12, 6: 7, 7: 3, 8: 7, 9: 3, 10: 0, 11: 3, 12: 7, 13: 12, 14: 7, 15: 3 },
        { 0: 8, 1: 3, 2: 0, 3: 3, 4: 8, 5: 12, 6: 8, 7: 3, 8: 8, 9: 3, 10: 0, 11: 3, 12: 8, 13: 12, 14: 8, 15: 3 },
        { 0: 10, 1: 7, 2: 3, 3: 7, 4: 10, 5: 15, 6: 10, 7: 7, 8: 10, 9: 7, 10: 3, 11: 7, 12: 10, 13: 15, 14: 10, 15: 7 },
        { 0: 10, 1: 5, 2: 2, 3: 5, 4: 10, 5: 14, 6: 17, 7: 14, 8: 10, 9: 5, 10: 2, 11: 5, 12: 10, 13: 14, 14: 17, 15: 14 },
      ),
      len: 0.8,
      tone: 'supersaw',
    },
    gain: 1,
  },
  // Drum and bass: a fast broken beat (kick, snare, kick-kick, snare), a deep
  // growling reese bass, dark pads and a pluck melody in F minor.
  {
    name: 'Jungle',
    bpm: 172,
    swing: 0,
    loop: [chord('F1', 'F3 Ab3 C4'), chord('Db2', 'F3 Ab3 Db4'), chord('Ab1', 'Eb3 Ab3 C4'), chord('Eb2', 'Eb3 G3 Bb3')],
    bass: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    bassLen: 7,
    bassTone: 'reese',
    stabs: [[0]],
    stabLen: 15,
    tone: 'pad',
    kick: [0, 10],
    kickTone: 'punch',
    claps: [4, 12],
    snare: 'snare',
    openHats: [14],
    closedHats: 'eighths',
    lead: { root: hz('F4'), notes: tune({ 0: 7, 3: 3, 6: 0, 10: 2, 12: 3 }, { 0: 12, 3: 8, 6: 3, 10: 5, 12: 7 }, { 0: 10, 3: 7, 6: 3, 10: 5, 12: 7 }, { 0: 10, 3: 5, 6: 2, 12: 5, 14: 7 }), len: 2, tone: 'pluck' },
    gain: 1,
  },
  // Dubstep: half-time drums (a kick, then a big snare on beat three) under a
  // wobbling bass that speeds up in the drop, in E minor.
  {
    name: 'Wobble',
    bpm: 140,
    swing: 0,
    loop: [chord('E1', 'E3 G3 B3'), chord('C2', 'E3 G3 C4'), chord('G1', 'D3 G3 B3'), chord('D2', 'D3 F#3 A3')],
    bass: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2, 0, 0, 0],
    bassLen: 5.8,
    bassTone: 'wobble',
    wobble: 2,
    stabs: [[]],
    stabLen: 1,
    tone: 'pad',
    kick: [0, 3, 11],
    kickTone: 'boom',
    claps: [8],
    snare: 'snare',
    openHats: [],
    closedHats: 'eighths',
    lead: { root: hz('E4'), notes: tune({ 0: 12, 3: 10, 6: 7 }, { 0: 3, 3: 5, 6: 7, 10: 10 }, { 0: 7, 3: 10, 6: 12 }, { 0: 14, 3: 12, 6: 10, 10: 7 }), len: 2.5, tone: 'square' },
    gain: 0.75,
  },
  // Synthwave: slow and moody, a driving sixteenth bass, big gated snares,
  // held pads and a brassy lead melody over Dm, Bb, F, C.
  {
    name: 'Neon',
    bpm: 108,
    swing: 0,
    loop: [chord('D2', 'D3 F3 A3'), chord('Bb1', 'D3 F3 Bb3'), chord('F2', 'C3 F3 A3'), chord('C2', 'C3 E3 G3')],
    bass: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    bassLen: 0.8,
    bassTone: 'square',
    stabs: [[0]],
    stabLen: 15,
    tone: 'pad',
    kick: [0, 8],
    kickTone: 'punch',
    claps: [4, 12],
    snare: 'snare',
    openHats: [],
    closedHats: 'eighths',
    lead: { root: hz('D4'), notes: tune({ 0: 7, 4: 12, 6: 10, 8: 12, 12: 15 }, { 0: 15, 4: 12, 6: 10, 8: 8, 12: 7 }, { 0: 7, 4: 10, 6: 12, 8: 15, 12: 12 }, { 0: 14, 4: 12, 6: 10, 12: 7 }), len: 3.5, tone: 'brass' },
    gain: 1.25,
  },
  // Reggaeton: the dembow rhythm ("boom, ch-boom, chick"), a deep 808 kick
  // and bass, and a marimba-like pluck hook over C#m, A, E, B.
  {
    name: 'Dembow',
    bpm: 96,
    swing: 0,
    loop: [chord('C#2', 'C#4 E4 G#4'), chord('A1', 'C#4 E4 A4'), chord('E2', 'B3 E4 G#4'), chord('B1', 'B3 D#4 F#4')],
    bass: [1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0],
    bassLen: 3,
    bassTone: 'sub',
    stabs: [[]],
    stabLen: 1,
    tone: 'pad',
    kickTone: 'boom',
    claps: [3, 6, 11, 14],
    snare: 'rim',
    openHats: [],
    closedHats: 'eighths',
    lead: { root: hz('C#4'), notes: tune({ 0: 7, 3: 3, 6: 7, 8: 12, 11: 10, 14: 7 }, { 0: 8, 3: 3, 6: 8, 8: 12, 11: 10, 14: 8 }, { 0: 10, 3: 7, 6: 3, 8: 7, 11: 10, 14: 15 }, { 0: 10, 3: 5, 6: 10, 8: 14, 11: 12, 14: 10 }), len: 1.5, tone: 'pluck' },
    gain: 1,
  },
  // Hardstyle: fast, a hard distorted kick with a pitched tail, off-beat
  // bass stabs and a screaming supersaw melody over Gm, Eb, Bb, F.
  {
    name: 'Hard',
    bpm: 150,
    swing: 0,
    loop: [chord('G1', 'G3 Bb3 D4'), chord('Eb2', 'G3 Bb3 Eb4'), chord('Bb1', 'F3 Bb3 D4'), chord('F1', 'F3 A3 C4')],
    bass: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    bassLen: 1.4,
    stabs: [[]],
    stabLen: 1,
    tone: 'pad',
    kickTone: 'hard',
    claps: [4, 12],
    openHats: off,
    closedHats: 'odd',
    lead: { root: hz('G4'), notes: tune({ 0: 7, 3: 7, 6: 10, 8: 12, 11: 10, 12: 7, 14: 3 }, { 0: 8, 3: 8, 6: 7, 8: 3, 11: 7, 12: 8, 14: 12 }, { 0: 10, 3: 10, 6: 12, 8: 15, 11: 12, 12: 10, 14: 7 }, { 0: 14, 3: 12, 6: 10, 8: 5, 11: 10, 12: 12, 14: 14 }), len: 2.6, tone: 'supersaw' },
    gain: 1,
  },
  // Afro house: rolling congas and a shaker over a four-to-the-floor kick, a
  // syncopated sub bass, warm pads and a kalimba-like bell melody.
  {
    name: 'Afro',
    bpm: 121,
    swing: 0.12,
    loop: [chord('A1', 'G3 C4 E4'), chord('D2', 'F3 A3 C4'), chord('A1', 'G3 C4 E4'), chord('E2', 'G3 B3 D4')],
    bass: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    bassLen: 1.8,
    bassTone: 'sub',
    stabs: [[0]],
    stabLen: 15,
    tone: 'pad',
    claps: [4, 12],
    snare: 'rim',
    openHats: [],
    closedHats: 'all',
    perc: [3, 6, 7, 10, 14],
    lead: { root: hz('A4'), notes: tune({ 0: 12, 3: 7, 6: 10, 10: 7, 12: 3 }, { 0: 5, 3: 8, 6: 12, 10: 8, 12: 3 }, { 0: 12, 3: 7, 6: 10, 10: 7, 12: 0 }, { 0: 7, 3: 10, 6: 14, 10: 10, 12: 5 }), len: 2.5, tone: 'bell' },
    gain: 1,
  },
]

// ?groove=n plays only that track (for testing and rendering clips).
export const pinned = (() => {
  if (typeof location === 'undefined') return null
  const v = new URLSearchParams(location.search).get('groove')
  return v === null || !GROOVES[Number(v)] ? null : Number(v)
})()
