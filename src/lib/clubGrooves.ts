// The nightclub's tracks: one plays all night, and every night it's a
// different one (clubSet.ts picks it from the town clock, the same for every
// player). They're different kinds of dance music, each with its own tempo,
// key, drum pattern, bass sound and hook, so no two nights sound alike even
// through the club's walls. ?groove=0..n pins one for testing.

export type Tone = 'organ' | 'piano' | 'chop' | 'pad'
export type KickTone = 'house' | 'punch' | 'hard' | 'boom'
export type SnareTone = 'clap' | 'snare' | 'rim'
export type BassTone = 'saw' | 'square' | 'sub' | 'reese' | 'wobble' | 'log'
export type LeadTone = 'supersaw' | 'pluck' | 'square' | 'bell' | 'brass' | 'marimba' | 'vox'
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
  // semitones above `root` (null = rest), each note `len` sixteenths long;
  // `stutter` steps play as two quick repeats.
  lead?: { root: number; notes: (number | null)[]; len: number; tone: LeadTone; stutter?: number[] }
  pump?: number // how far the chords and hooks duck under each kick, 0-1 (default 0.25)
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
  // UK garage: a skippy two-step kick, heavy swing, a clean bouncing sub,
  // short organ hits, rimshots and a stuttering bell hook in D minor.
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
    bass: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 2, 0, 1, 0, 0, 0],
    bassLen: 1.2,
    bassTone: 'sub',
    stabs: [[2, 7, 10], [2, 7], [2, 7, 10], [2, 7, 13]],
    stabLen: 1.1,
    tone: 'organ',
    kick: [0, 10],
    claps: [4, 12],
    snare: 'rim',
    openHats: off,
    closedHats: 'all',
    lead: { root: hz('D4'), notes: tune({ 3: 12, 5: 10, 9: 7, 13: 3 }, { 3: 10, 5: 8, 9: 5, 13: 3 }, { 3: 12, 5: 8, 9: 10, 13: 7 }, { 3: 11, 5: 7, 9: 4, 11: 7, 13: 9 }), len: 1.6, tone: 'bell', stutter: [3, 35] },
    pump: 0.35,
    gain: 1.1,
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
  // Electro swing: a heavy shuffle, a walking bass, oom-pah piano on the
  // off-beats and a trumpet-like melody over Bb6, G7, Cm7, F7 (a major key,
  // where most nights are minor).
  {
    name: 'Swing',
    bpm: 122,
    swing: 0.33,
    loop: [chord('Bb1', 'D4 F4 G4 Bb4'), chord('G1', 'B3 D4 F4 G4'), chord('C2', 'Bb3 C4 Eb4 G4'), chord('F1', 'A3 C4 Eb4 F4')],
    bass: [1, 0, 0, 0, 1.26, 0, 0, 0, 1.5, 0, 0, 0, 1.68, 0, 0, 0],
    bassLen: 3,
    bassTone: 'sub',
    stabs: [[2, 6, 10, 14]],
    stabLen: 1,
    tone: 'piano',
    kickTone: 'punch',
    claps: [4, 12],
    snare: 'snare',
    openHats: [],
    closedHats: 'odd',
    lead: { root: hz('Bb4'), notes: tune({ 0: 4, 2: 7, 4: 9, 6: 7, 8: 4, 12: 0 }, { 0: 13, 2: 9, 4: 7, 8: 4, 12: 1 }, { 0: 12, 2: 9, 4: 5, 6: 2, 8: 5, 12: 9 }, { 0: 11, 2: 7, 4: 5, 6: 2, 8: -1, 12: 7, 14: 11 }), len: 1.6, tone: 'brass' },
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
  // Liquid drum and bass: a fast broken beat (kick, snare, kick-kick, snare)
  // under warm electric-piano chords, a rolling reese bass and a bell melody in
  // Db major.
  {
    name: 'Liquid',
    bpm: 174,
    swing: 0,
    loop: [chord('Db2', 'F3 Ab3 C4 F4'), chord('C2', 'Eb3 G3 Bb3 Eb4'), chord('Bb1', 'Db3 F3 Ab3 Db4'), chord('Gb1', 'Db3 F3 Bb3 Db4')],
    bass: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    bassLen: 7,
    bassTone: 'reese',
    stabs: [[0, 3, 10]],
    stabLen: 3,
    tone: 'piano',
    kick: [0, 10],
    kickTone: 'punch',
    claps: [4, 12],
    snare: 'snare',
    openHats: [14],
    closedHats: 'eighths',
    lead: { root: hz('Db5'), notes: tune({ 0: 12, 4: 11, 6: 7, 10: 4, 12: 7 }, { 0: 11, 4: 9, 6: 6, 10: 2, 12: 6 }, { 0: 9, 4: 7, 6: 4, 10: 0, 12: 4 }, { 0: 16, 4: 12, 6: 9, 10: 5, 12: 7 }), len: 3, tone: 'bell' },
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
  // Amapiano: slow and laid back, a soft kick on one and three, a shaker,
  // the bouncing pitched "log drum" bass, jazzy piano chords and a marimba
  // melody in F# minor.
  {
    name: 'Amapiano',
    bpm: 113,
    swing: 0.16,
    loop: [chord('F#1', 'A3 C#4 E4 G#4'), chord('B1', 'A3 C#4 D4 F#4'), chord('F#1', 'A3 C#4 E4 G#4'), chord('C#2', 'G#3 B3 E4 F#4')],
    bass: [1, 0, 0, 1, 0, 0, 1.5, 0, 0, 0, 1, 2, 0, 0, 1.5, 0],
    bassLen: 2,
    bassTone: 'log',
    stabs: [[0, 7], [3, 10], [0, 7], [3, 10, 13]],
    stabLen: 2,
    tone: 'piano',
    kick: [0, 8],
    kickTone: 'punch',
    claps: [4, 12],
    snare: 'rim',
    openHats: [],
    closedHats: 'all',
    perc: [7, 15],
    lead: { root: hz('F#4'), notes: tune({ 0: 12, 3: 7, 6: 10, 8: 12, 10: 7, 12: 3 }, { 0: 5, 3: 8, 6: 12, 8: 15, 10: 8, 12: 3 }, { 0: 12, 3: 7, 6: 10, 8: 12, 10: 7, 12: 0 }, { 0: 7, 3: 10, 6: 14, 8: 17, 10: 10, 12: 5 }), len: 2, tone: 'marimba' },
    gain: 1.15,
  },
  // Stutter house (emotional club, in the style of Fred again.. or Swimming
  // Paul): a steady kick that makes everything pump, melancholic piano chords,
  // a warm sub and a chopped, stuttering vocal hook in F minor.
  {
    name: 'Stutter',
    bpm: 133,
    swing: 0.1,
    loop: [chord('F1', 'Ab3 C4 Eb4 G4'), chord('Db2', 'Ab3 C4 F4'), chord('Ab1', 'Ab3 C4 Eb4'), chord('Eb2', 'G3 Bb3 Eb4')],
    bass: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
    bassLen: 1.6,
    bassTone: 'sub',
    stabs: [[0, 6, 10], [0, 6, 10], [0, 6, 10], [0, 3, 6, 10]],
    stabLen: 3,
    tone: 'piano',
    kickTone: 'punch',
    claps: [4, 12],
    openHats: off,
    closedHats: 'odd',
    lead: {
      root: hz('F4'),
      notes: tune({ 0: 12, 1: 12, 2: 12, 4: 10, 6: 8, 8: 7, 10: 8, 11: 8, 12: 3 }, { 0: 8, 1: 8, 2: 8, 4: 7, 6: 3, 10: 5, 12: 7 }, { 0: 12, 1: 12, 2: 12, 4: 15, 6: 12, 8: 10, 10: 12, 11: 12, 12: 8 }, { 0: 10, 2: 10, 4: 7, 6: 3, 8: 2, 10: 3, 12: 3, 13: 3, 14: 3, 15: 3 }),
      len: 1.8,
      tone: 'vox',
      stutter: [0, 1, 10, 16, 17, 32, 33, 42, 60, 61, 62, 63],
    },
    pump: 0.6,
    gain: 0.88,
  },
  // Emotional two-step garage: a skipping kick, crisp snares and shuffled
  // hats under sad piano chords, a deep sub and an airy vocal line in D minor.
  {
    name: 'Two Step',
    bpm: 135,
    swing: 0.26,
    loop: [chord('D2', 'F3 A3 C4 E4'), chord('Bb1', 'F3 A3 D4'), chord('F2', 'F3 A3 C4 E4'), chord('C2', 'E3 G3 C4')],
    bass: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
    bassLen: 3.5,
    bassTone: 'sub',
    stabs: [[0, 3], [0, 3, 11], [0, 3], [0, 10, 13]],
    stabLen: 4,
    tone: 'piano',
    kick: [0, 7, 10],
    kickTone: 'punch',
    claps: [4, 12],
    snare: 'snare',
    openHats: [14],
    closedHats: 'all',
    perc: [11],
    lead: { root: hz('D5'), notes: tune({ 0: 7, 3: 3, 6: 2, 8: 0, 14: 2 }, { 0: 3, 3: 0, 6: -2, 8: -5 }, { 0: 7, 3: 10, 6: 7, 8: 3, 14: 5 }, { 0: 2, 3: 3, 6: 2, 8: -2, 11: -2, 12: -2 }), len: 2.6, tone: 'vox', stutter: [11, 59, 60] },
    pump: 0.45,
    gain: 0.82,
  },
  // Nostalgic rave breaks: a shuffled breakbeat, old-school rave piano stabs,
  // a rolling sub and a wistful plucked hook with stutters, in A minor.
  {
    name: 'Rave Breaks',
    bpm: 136,
    swing: 0.12,
    loop: [chord('A1', 'C4 E4 G4 A4'), chord('F1', 'C4 E4 F4 A4'), chord('D2', 'C4 D4 F4 A4'), chord('E2', 'B3 D4 E4 G#4')],
    bass: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    bassLen: 2,
    bassTone: 'sub',
    stabs: [[2, 6, 9, 14], [2, 6, 9], [2, 6, 9, 14], [2, 6, 11, 13]],
    stabLen: 1.2,
    tone: 'piano',
    kick: [0, 6, 10],
    kickTone: 'punch',
    claps: [4, 12],
    snare: 'snare',
    openHats: [6, 14],
    closedHats: 'all',
    perc: [7, 15],
    lead: { root: hz('A4'), notes: tune({ 0: 12, 2: 12, 3: 10, 6: 7, 10: 3, 12: 5 }, { 0: 8, 3: 7, 6: 3, 10: 0, 12: 3 }, { 0: 5, 3: 7, 6: 8, 10: 12, 12: 10 }, { 0: 11, 3: 7, 6: 4, 8: 2, 12: 4, 13: 4, 14: 4, 15: 4 }), len: 1.6, tone: 'pluck', stutter: [60, 61, 62, 63] },
    pump: 0.4,
    gain: 1,
  },
]

// ?groove=n plays only that track (for testing and rendering clips).
export const pinned = (() => {
  if (typeof location === 'undefined') return null
  const v = new URLSearchParams(location.search).get('groove')
  return v === null || !GROOVES[Number(v)] ? null : Number(v)
})()
