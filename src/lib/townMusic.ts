// Background music for the town: a soundtrack of smooth, dreamy songs, all
// synthesised: warm electric piano, airy "aah" choirs and string pads, a round
// bass, vibraphone and flute leads over a laid-back beat, in a big soft room.
// Like a game soundtrack it shuffles: one song, a quiet spell with just the
// town, then a different one. Every season has its own three day songs and
// three night songs, picked at random, and a reload opens on a fresh one. Each song always has the same tune, so players get to know them.
// It sits under the town sounds, stops for races and arcade games, and gives
// way to the nightclub's beat when the club is on screen.
import { audioContext, audioOut, isMuted, onMuteChange } from './sound'
import { choir, epiano, flute, hz, pad, rim, shaker, softBass, softKick, vibes } from './instruments'
import { dayPhase, nightAmount } from '../game/clock'
import { SEASON, type Season } from '../scene/season'
import { onTownHold, townHeld } from '../scene/renderGate'
import { weatherNow } from '../game/weather'
import { clubOpen, keptBuffer } from './ambience'
import { onTechnoChange, technoOn } from '../game/techno'

type Lead = 'epiano' | 'vibes' | 'flute'
// A chord: its bass note, then the voicing played above it.
type Chord = [string, ...string[]]
export type Song = {
  name: string
  when: 'day' | 'night'
  seasons: Season[]
  bpm: number
  chords: Chord[] // one per bar, looping
  scale: string[] // the notes the tune is made of
  lead: Lead
  bass: 'root' | 'bounce' | 'walk'
  air: 'choir' | 'pad' // the sustained layer floating over the chords
  arp: 'keys' | 'none' // electric piano broken chords
  groove: 'none' | 'brush' | 'chill'
  comp?: boolean // offbeat electric piano stabs
  swing?: number // how late the in-between sixteenths land, as a share of one
  gain?: number // evens the songs out
}

const day = 'day' as const
const night = 'night' as const
export const SONGS: Song[] = [
  { name: 'Sunny Side Street', when: day, seasons: ['spring'], bpm: 88, lead: 'vibes', bass: 'bounce', air: 'choir', arp: 'keys', groove: 'chill', swing: 0.12,
    chords: [['G2', 'B3', 'D4', 'F#4', 'A4'], ['E2', 'G3', 'B3', 'D4', 'F#4'], ['C3', 'E3', 'G3', 'B3', 'D4'], ['D2', 'F#3', 'A3', 'B3', 'E4']],
    scale: ['D4', 'E4', 'G4', 'A4', 'B4', 'D5', 'E5', 'G5', 'A5'] },
  { name: 'Lemonade Stand', when: day, seasons: ['summer'], bpm: 92, lead: 'flute', bass: 'bounce', air: 'pad', arp: 'none', groove: 'chill', comp: true, swing: 0.14,
    chords: [['F2', 'A3', 'C4', 'E4', 'G4'], ['D2', 'F3', 'A3', 'C4', 'E4'], ['G2', 'Bb3', 'D4', 'F4', 'A4'], ['C3', 'E3', 'Bb3', 'D4', 'G4']],
    scale: ['C4', 'D4', 'F4', 'G4', 'A4', 'C5', 'D5', 'F5', 'G5'] },
  { name: 'Paper Route', when: day, seasons: ['spring'], bpm: 90, lead: 'vibes', bass: 'root', air: 'choir', arp: 'keys', groove: 'brush',
    chords: [['C3', 'E3', 'G3', 'B3', 'E4'], ['A2', 'E3', 'G3', 'C4', 'E4'], ['F2', 'A3', 'C4', 'E4'], ['G2', 'F3', 'A3', 'B3', 'E4'],
      ['C3', 'E3', 'G3', 'B3', 'E4'], ['E2', 'D3', 'G3', 'B3', 'E4'], ['F2', 'A3', 'C4', 'E4'], ['G2', 'F3', 'B3', 'D4', 'G4']],
    scale: ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6'] },
  { name: 'Garage Sale', when: day, seasons: ['summer'], bpm: 86, lead: 'flute', bass: 'walk', air: 'pad', arp: 'none', groove: 'chill', comp: true, swing: 0.16,
    chords: [['D2', 'F#3', 'A3', 'C#4', 'E4'], ['C3', 'E3', 'G3', 'B3', 'D4'], ['G2', 'F#3', 'B3', 'D4'], ['D2', 'F#3', 'A3', 'C#4', 'E4']],
    scale: ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5'] },
  { name: 'Picnic Hill', when: day, seasons: ['spring'], bpm: 84, lead: 'flute', bass: 'bounce', air: 'choir', arp: 'keys', groove: 'chill', swing: 0.1,
    chords: [['A2', 'C#4', 'E4', 'G#4', 'B4'], ['F#2', 'A3', 'C#4', 'E4'], ['D3', 'F#3', 'A3', 'C#4', 'E4'], ['E2', 'G#3', 'B3', 'C#4', 'E4']],
    scale: ['E4', 'F#4', 'A4', 'B4', 'C#5', 'E5', 'F#5', 'A5'] },
  { name: 'Rainy Window', when: day, seasons: ['fall'], bpm: 72, lead: 'epiano', bass: 'root', air: 'pad', arp: 'keys', groove: 'brush',
    chords: [['E2', 'G3', 'B3', 'D4', 'F#4'], ['C3', 'E3', 'G3', 'B3'], ['A2', 'C4', 'E4', 'G4', 'B4'], ['B2', 'A3', 'E4', 'F#4']],
    scale: ['E4', 'G4', 'A4', 'B4', 'D5', 'E5', 'G5'] },
  { name: 'Maple Drive', when: day, seasons: ['fall'], bpm: 80, lead: 'epiano', bass: 'bounce', air: 'choir', arp: 'keys', groove: 'chill', comp: true, swing: 0.12,
    chords: [['D2', 'F3', 'A3', 'C4', 'E4'], ['G2', 'B3', 'E4', 'F4', 'A4'], ['C3', 'E3', 'G3', 'B3', 'D4'], ['A2', 'G3', 'C4', 'E4']],
    scale: ['A3', 'C4', 'D4', 'F4', 'G4', 'A4', 'C5', 'D5', 'F5'] },
  { name: 'Cider Mill', when: day, seasons: ['fall'], bpm: 82, lead: 'vibes', bass: 'bounce', air: 'pad', arp: 'none', groove: 'chill', comp: true, swing: 0.12,
    chords: [['G2', 'Bb3', 'D4', 'F4', 'A4'], ['C3', 'E3', 'Bb3', 'D4'], ['Eb3', 'G3', 'Bb3', 'D4'], ['D2', 'G3', 'A3', 'C4']],
    scale: ['G4', 'Bb4', 'C5', 'D5', 'F5', 'G5'] },
  { name: 'First Snow', when: day, seasons: ['winter'], bpm: 72, lead: 'vibes', bass: 'root', air: 'choir', arp: 'keys', groove: 'none',
    chords: [['A2', 'C4', 'E4', 'G4', 'B4'], ['F2', 'A3', 'C4', 'E4', 'G4'], ['C3', 'E3', 'G3', 'B3', 'D4'], ['G2', 'B3', 'D4', 'E4', 'A4']],
    scale: ['G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6'] },
  { name: 'Cocoa Break', when: day, seasons: ['winter'], bpm: 80, lead: 'flute', bass: 'walk', air: 'pad', arp: 'none', groove: 'brush', comp: true, swing: 0.14,
    chords: [['F2', 'A3', 'C4', 'E4', 'G4'], ['A2', 'G3', 'C4', 'E4'], ['Bb2', 'A3', 'D4', 'F4'], ['C3', 'E3', 'A3', 'D4']],
    scale: ['C4', 'D4', 'F4', 'G4', 'A4', 'C5', 'D5', 'F5'] },
  { name: 'Streetlights', when: night, seasons: ['summer'], bpm: 66, lead: 'epiano', bass: 'root', air: 'choir', arp: 'keys', groove: 'brush',
    chords: [['F2', 'A3', 'C4', 'E4'], ['E2', 'G3', 'B3', 'D4'], ['D2', 'F3', 'A3', 'C4'], ['C3', 'E3', 'G3', 'B3'],
      ['F2', 'A3', 'C4', 'E4'], ['E2', 'G3', 'B3', 'D4'], ['D2', 'F3', 'C4', 'E4'], ['G2', 'B3', 'D4', 'E4']],
    scale: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'] },
  { name: 'Night Shift', when: night, seasons: ['fall'], bpm: 74, lead: 'flute', bass: 'walk', air: 'pad', arp: 'none', groove: 'chill', comp: true, swing: 0.14,
    chords: [['A2', 'C4', 'E4', 'G4', 'B4'], ['D2', 'F3', 'A3', 'C4', 'E4'], ['G2', 'B3', 'E4', 'F4', 'A4'], ['C3', 'E3', 'G3', 'B3', 'D4']],
    scale: ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'] },
  { name: 'Porch Light', when: night, seasons: ['spring'], bpm: 62, lead: 'vibes', bass: 'root', air: 'choir', arp: 'keys', groove: 'none',
    chords: [['Bb2', 'D4', 'F4', 'A4'], ['G2', 'Bb3', 'D4', 'F4'], ['Eb3', 'G3', 'Bb3', 'D4'], ['F2', 'A3', 'C4', 'D4']],
    scale: ['Bb4', 'C5', 'D5', 'F5', 'G5', 'Bb5', 'C6'] },
  { name: 'Moon Garage', when: night, seasons: ['summer'], bpm: 70, lead: 'epiano', bass: 'bounce', air: 'choir', arp: 'keys', groove: 'chill', swing: 0.12,
    chords: [['E2', 'G3', 'B3', 'D4', 'F#4'], ['A2', 'G3', 'C#4', 'F#4'], ['G2', 'B3', 'D4', 'F#4'], ['F#2', 'A3', 'C#4', 'E4']],
    scale: ['E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5'] },
  { name: 'Pool Party', when: day, seasons: ['summer'], bpm: 94, lead: 'vibes', bass: 'bounce', air: 'pad', arp: 'keys', groove: 'chill', swing: 0.12,
    chords: [['Bb2', 'D4', 'F4', 'A4'], ['C3', 'Eb3', 'G3', 'Bb3', 'D4'], ['D3', 'F3', 'A3', 'C4'], ['Eb3', 'G3', 'Bb3', 'D4', 'F4']],
    scale: ['F4', 'G4', 'Bb4', 'C5', 'D5', 'F5', 'G5'] },
  { name: 'Snow Day', when: day, seasons: ['winter'], bpm: 76, lead: 'flute', bass: 'root', air: 'choir', arp: 'keys', groove: 'brush',
    chords: [['D3', 'F#3', 'A3', 'C#4', 'E4'], ['B2', 'D4', 'F#4', 'A4'], ['G2', 'B3', 'D4', 'F#4'], ['A2', 'C#4', 'E4', 'F#4']],
    scale: ['A4', 'B4', 'D5', 'E5', 'F#5', 'A5', 'B5'] },
  { name: 'Peeper Pond', when: night, seasons: ['spring'], bpm: 68, lead: 'vibes', bass: 'bounce', air: 'choir', arp: 'keys', groove: 'brush',
    chords: [['G2', 'B3', 'D4', 'F#4'], ['A2', 'G3', 'C4', 'E4'], ['B2', 'A3', 'D4', 'F#4'], ['C3', 'E3', 'G3', 'B3', 'D4']],
    scale: ['D4', 'E4', 'G4', 'A4', 'B4', 'D5', 'E5'] },
  { name: 'April Rain', when: night, seasons: ['spring'], bpm: 64, lead: 'epiano', bass: 'root', air: 'pad', arp: 'keys', groove: 'none',
    chords: [['Eb3', 'G3', 'Bb3', 'D4'], ['C3', 'Eb3', 'G3', 'Bb3', 'D4'], ['Ab2', 'C4', 'Eb4', 'G4'], ['Bb2', 'D4', 'F4', 'G4']],
    scale: ['Bb3', 'C4', 'Eb4', 'F4', 'G4', 'Bb4', 'C5', 'Eb5'] },
  { name: 'Fireflies', when: night, seasons: ['summer'], bpm: 72, lead: 'flute', bass: 'bounce', air: 'choir', arp: 'keys', groove: 'chill', swing: 0.12,
    chords: [['A2', 'C4', 'E4', 'G4', 'B4'], ['D2', 'F#3', 'C4', 'E4'], ['G2', 'B3', 'D4', 'F#4'], ['C3', 'E3', 'G3', 'B3']],
    scale: ['E4', 'G4', 'A4', 'B4', 'D5', 'E5', 'G5'] },
  { name: 'Harvest Moon', when: night, seasons: ['fall'], bpm: 66, lead: 'epiano', bass: 'walk', air: 'choir', arp: 'none', groove: 'brush', comp: true, swing: 0.14,
    chords: [['D2', 'F3', 'A3', 'C4', 'E4'], ['Bb2', 'D4', 'F4', 'A4'], ['G2', 'Bb3', 'D4', 'F4', 'A4'], ['A2', 'G3', 'D4', 'E4']],
    scale: ['A3', 'C4', 'D4', 'F4', 'G4', 'A4', 'C5', 'D5'] },
  { name: 'Hayride Home', when: night, seasons: ['fall'], bpm: 70, lead: 'vibes', bass: 'bounce', air: 'pad', arp: 'keys', groove: 'chill', swing: 0.1,
    chords: [['F#2', 'A3', 'C#4', 'E4'], ['D3', 'F#3', 'A3', 'C#4'], ['B2', 'A3', 'D4', 'F#4'], ['E2', 'G#3', 'C#4', 'E4']],
    scale: ['E4', 'F#4', 'A4', 'B4', 'C#5', 'E5', 'F#5'] },
  { name: 'Silent Lot', when: night, seasons: ['winter'], bpm: 60, lead: 'vibes', bass: 'root', air: 'choir', arp: 'keys', groove: 'none',
    chords: [['C3', 'E3', 'G3', 'B3', 'D4'], ['A2', 'C4', 'E4', 'G4', 'B4'], ['F2', 'A3', 'C4', 'E4'], ['G2', 'C4', 'D4', 'G4']],
    scale: ['E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5'] },
  { name: 'Frosted Glass', when: night, seasons: ['winter'], bpm: 64, lead: 'flute', bass: 'root', air: 'pad', arp: 'keys', groove: 'brush',
    chords: [['E2', 'G3', 'B3', 'D4', 'F#4'], ['C3', 'E3', 'G3', 'B3'], ['G2', 'B3', 'D4', 'F#4'], ['D2', 'A3', 'D4', 'E4']],
    scale: ['B3', 'D4', 'E4', 'G4', 'A4', 'B4', 'D5'] },
  { name: 'Fireside', when: night, seasons: ['winter'], bpm: 68, lead: 'epiano', bass: 'walk', air: 'pad', arp: 'none', groove: 'brush', comp: true, swing: 0.14,
    chords: [['F2', 'A3', 'C4', 'E4', 'G4'], ['D2', 'F3', 'A3', 'C4', 'E4'], ['G2', 'Bb3', 'D4', 'F4', 'A4'], ['C3', 'E3', 'Bb3', 'D4', 'A4']],
    scale: ['C4', 'D4', 'F4', 'G4', 'A4', 'C5', 'D5'] },
]

// The note's name without its octave, to match melody notes to chords.
const pc = (n: string) => n.replace(/\d+$/, '')

// A small seeded random, so each song always plays its own tune.
export function seeded(text: string) {
  let a = 0
  for (const ch of text) a = (Math.imul(a, 31) + ch.charCodeAt(0)) | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Rhythms for a two-bar phrase, in sixteenths (0..31): long, unhurried notes,
// each phrase ending on a held one.
const RHYTHMS = [
  [0, 6, 8, 16, 22, 24],
  [0, 4, 8, 14, 16, 24],
  [2, 8, 12, 16, 24],
  [0, 3, 8, 16, 19, 24],
  [0, 8, 10, 12, 16, 24],
  [0, 6, 12, 16, 20, 24],
]

export type Note = { at: number; note: string; len: number }

// A two-bar melody: steps around the scale, landing on a note of the bar's
// chord on each strong beat, and ending on one. `chords` are the two bars' chords.
export function phrase(song: Pick<Song, 'scale'>, chords: [Chord, Chord], random = Math.random, rhythm?: number[]): Note[] {
  const r = rhythm ?? RHYTHMS[Math.floor(random() * RHYTHMS.length)]
  const s = song.scale
  let i = Math.floor(s.length / 2 + (random() - 0.5) * 3)
  return r.map((at, k) => {
    const last = k === r.length - 1
    // Mostly steps, so the line sings rather than jumps.
    const step = [-1, -1, 1, 1, 0, -2, 2][Math.floor(random() * 7)]
    i = Math.max(0, Math.min(s.length - 1, i + step))
    if (at % 8 === 0 || last) {
      // Strong beat: move to the nearest chord tone.
      const tones = new Set(chords[at < 16 ? 0 : 1].slice(1).map(pc))
      let best = i
      for (let d = 0; d < s.length; d++) {
        if (i - d >= 0 && tones.has(pc(s[i - d]))) { best = i - d; break }
        if (i + d < s.length && tones.has(pc(s[i + d]))) { best = i + d; break }
      }
      i = best
    }
    const next = last ? 32 : r[k + 1]
    return { at, note: s[i], len: next - at }
  })
}

// The songs for this season and time of day, leaving out the last few played
// if there are others.
export function songsFor(isNight: boolean, season: Season, recent: string[] = []) {
  const fit = SONGS.filter((s) => s.when === (isNight ? 'night' : 'day') && s.seasons.includes(season))
  // Forget the oldest plays first until something is left, so the song just
  // played never comes straight back.
  for (let k = 0; k < recent.length; k++) {
    const fresh = fit.filter((s) => !recent.slice(k).includes(s.name))
    if (fresh.length) return fresh
  }
  return fit
}

// A song: an intro, the tune, the tune again, a quieter break, and the tune
// once more, then it rings out on its first chord.
const BARS = 40
const VERSES = [[8, 16], [16, 24], [32, 40]]
const inVerse = (bar: number) => VERSES.some(([a, b]) => bar >= a && bar < b)

// The last few songs played, kept across reloads so a fresh visit opens on a
// different song (and a race or a menu doesn't bring the same one back).
const RECENT_KEY = 'cartopia-music-recent'
const recent: string[] = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(-3) : []
  } catch {
    return []
  }
})()
let playing: Song | null = null
const nowListeners = new Set<() => void>()
export const nowPlaying = () => playing?.name ?? null
export function onNowPlaying(l: () => void) {
  nowListeners.add(l)
  return () => nowListeners.delete(l)
}
function setPlaying(s: Song | null) {
  if (playing === s) return
  playing = s
  nowListeners.forEach((l) => l())
}

export class TownMusic {
  private ctx: BaseAudioContext
  private input: GainNode
  private songGain: GainNode
  private out: GainNode
  private echo: DelayNode
  private next = 0 // when the next sixteenth plays
  private pos = 0 // sixteenths into the song
  private song: Song | null = null
  private resting = 0 // while between songs: when the next one starts
  private motifs = new Map<string, Note[]>()
  private random = Math.random
  private nodes: AudioNode[] = []
  // Tests and the clip renderer can pin the songs to play, in order.
  queue: string[] = []
  gap: [number, number] = [0, 1] // seconds after the last chord's ring-out before the next song

  constructor(ctx: BaseAudioContext, dest: AudioNode) {
    this.ctx = ctx
    this.input = ctx.createGain()
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 7500
    this.songGain = ctx.createGain()
    // A gentle squeeze glues it together and keeps it full at low volume.
    const glue = ctx.createDynamicsCompressor()
    glue.threshold.value = -26
    glue.knee.value = 12
    glue.ratio.value = 2.5
    glue.attack.value = 0.02
    glue.release.value = 0.3
    this.out = ctx.createGain()
    this.out.gain.value = 0
    this.input.connect(tone).connect(this.songGain).connect(glue).connect(this.out)
    // A big, soft hall: the dreamy space the music floats in.
    const hall = ctx.createConvolver()
    hall.buffer = keptBuffer(ctx, 'music-hall', () => hallBuffer(ctx, 3.2))
    const hallGain = ctx.createGain()
    hallGain.gain.value = 0.42
    this.input.connect(hall).connect(hallGain).connect(this.songGain)
    // And a quiet dotted echo for a bit of shimmer.
    this.echo = ctx.createDelay(2)
    const fb = ctx.createGain()
    fb.gain.value = 0.28
    const wetTone = ctx.createBiquadFilter()
    wetTone.type = 'lowpass'
    wetTone.frequency.value = 2200
    const wet = ctx.createGain()
    wet.gain.value = 0.12
    this.input.connect(this.echo)
    this.echo.connect(wetTone).connect(fb).connect(this.echo)
    wetTone.connect(wet).connect(this.songGain)
    this.out.connect(dest)
    this.nodes = [this.input, tone, this.songGain, glue, this.out, hall, hallGain, this.echo, fb, wetTone, wet]
  }

  level(v: number, t: number, tau = 0.8) {
    this.out.gain.setTargetAtTime(v, t, tau)
  }

  get current() {
    return this.song
  }

  private sixteenth() {
    return 60 / (this.song?.bpm ?? 80) / 4
  }

  private start(isNight: boolean, season: Season, at: number) {
    const pinned = this.queue.shift()
    const choices = songsFor(isNight, season, recent)
    const song = SONGS.find((s) => s.name === pinned) ?? choices[Math.floor(Math.random() * choices.length)]
    recent.push(song.name)
    if (recent.length > 3) recent.shift()
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
    } catch {
      /* storage unavailable */
    }
    this.song = song
    this.pos = 0
    this.next = at
    this.motifs.clear()
    this.random = seeded(song.name)
    this.songGain.gain.setValueAtTime(song.gain ?? 1, at)
    this.echo.delayTime.setValueAtTime(this.sixteenth() * 3, at)
    setPlaying(song)
  }

  // Schedule everything due before `until`. night: 0..1 dark. rain: 0..1.
  step(until: number, night: number, season: Season, rain = 0) {
    const now = this.ctx.currentTime
    if (!this.song) {
      if (this.resting > now) return
      this.start(night > 0.5, season, Math.max(now + 0.05, this.resting))
    }
    // Back after a pause: pick up from now rather than catching up.
    if (this.next < now) this.next = now + 0.05
    while (this.song && this.next < until) {
      if (this.pos === BARS * 16) {
        this.end(this.next)
        return
      }
      const swing = this.pos % 2 ? (this.song.swing ?? 0) * this.sixteenth() : 0
      this.play(this.pos, this.next + swing, rain)
      this.next += this.sixteenth()
      this.pos++
    }
  }

  // The song rings out on its first chord, and the next one comes in as it fades.
  private end(t: number) {
    const song = this.song!
    const d = { ctx: this.ctx, out: this.input }
    const c = song.chords[0]
    const notes = c.slice(1).map(hz)
    softBass(d, t, hz(c[0]), 0.048, 3)
    notes.forEach((f, k) => epiano(d, t + k * 0.04, f, 0.03, 5))
    choir(d, t, notes.slice(0, 4), 0.016, 3.5)
    this.song = null
    setPlaying(null)
    this.resting = t + 3 + this.gap[0] + Math.random() * (this.gap[1] - this.gap[0])
  }

  // The tune for a two-bar slot: A, its answer (same rhythm, the next chords),
  // B, then the answer again. Written once per song so it repeats like a chorus.
  private motif(bar: number) {
    const song = this.song!
    const n = song.chords.length
    const role = ['A', 'a', 'B', 'a'][Math.floor((bar % 8) / 2)]
    const key = `${role}:${bar % n}`
    let m = this.motifs.get(key)
    if (!m) {
      const chords: [Chord, Chord] = [song.chords[bar % n], song.chords[(bar + 1) % n]]
      const a = role === 'a' ? this.motifs.get(`A:${(bar - (bar % 8)) % n}`) : undefined
      m = phrase(song, chords, this.random, a?.map((x) => x.at))
      this.motifs.set(key, m)
    }
    return m
  }

  private play(pos: number, t: number, rain: number) {
    const song = this.song!
    const d = { ctx: this.ctx, out: this.input }
    const bar = Math.floor(pos / 16)
    const s = pos % 16
    const n = song.chords.length
    const chord = song.chords[bar % n]
    const nextChord = song.chords[(bar + 1) % n]
    const intro = bar < 4
    const verse = inVerse(bar)
    const brk = bar >= 24 && bar < 32
    const six = this.sixteenth()
    const barLen = six * 16
    const root = hz(chord[0])
    const notes = chord.slice(1).map(hz)

    // Bass: round and held, never plucked.
    if (song.bass === 'root') {
      if (s === 0) softBass(d, t, root, 0.051, barLen * 0.95)
    } else if (song.bass === 'bounce') {
      if (s === 0) softBass(d, t, root, 0.051, six * 5.5)
      if (s === 6) softBass(d, t, root, 0.03, six * 1.5)
      if (s === 8) softBass(d, t, root * (bar % 2 ? 1.5 : 1), 0.042, six * 7)
    } else if (s % 4 === 0) {
      // Walking: up through the chord, then a step into the next bar's root.
      const to = hz(nextChord[0])
      const f = s === 0 ? root : s === 4 ? root * 1.26 : s === 8 ? root * 1.5 : to < root ? to * 1.06 : to / 1.06
      if (!intro || s === 0) softBass(d, t, f, s === 0 ? 0.05 : 0.04, six * 3.6)
    }

    // Electric piano chords, gently rolled, and the airy layer floating above.
    if (s === 0) {
      notes.forEach((f, k) => epiano(d, t + k * 0.018, f, 0.027, barLen * 1.1))
      const airy = notes.slice(-4).map((f) => f * 2)
      const quiet = brk || intro ? 1.3 : 1
      if (song.air === 'choir') choir(d, t, airy, 0.017 * quiet, barLen * 0.9)
      else pad(d, t, notes.slice(-4), 0.02 * quiet, barLen * 0.9)
    }
    if (song.comp && !intro && !brk && (s === 6 || s === 10)) notes.slice(0, 3).forEach((f, k) => epiano(d, t + k * 0.01, f, 0.012, six * 3))

    // Electric piano broken chords up through the voicing.
    if (song.arp === 'keys' && bar >= 2 && s % 4 === 2) {
      const order = [1, 2, 3, 2]
      epiano(d, t, notes[order[s >> 2] % notes.length] * 2, verse ? 0.014 : 0.02, six * 6)
    }

    // The tune.
    if (verse) {
      const local = (bar % 2) * 16 + s
      for (const x of this.motif(bar - (bar % 2))) if (x.at === local) this.lead(d, t, x, six)
    }

    // The beat, laid back: held off in the intro and the rain, thinned in the break.
    if (song.groove !== 'none' && !intro && rain < 0.3) {
      if (song.groove === 'chill') {
        if (!brk && (s === 0 || s === 10 || (s === 7 && bar % 2))) softKick(d, t, s === 0 ? 0.08 : 0.055)
        if (s === 4 || s === 12) rim(d, t, brk ? 0.012 : 0.026)
        if (s % 2 === 0) shaker(d, t, s % 4 === 2 ? 0.013 : 0.007, 0.05, 8500)
      } else {
        if (!brk && s === 0) softKick(d, t, 0.05)
        if (s === 4 || s === 12) rim(d, t, 0.016)
        if (s % 2 === 0) shaker(d, t, 0.006, 0.12, 4500)
      }
    }
  }

  private lead(d: { ctx: BaseAudioContext; out: AudioNode }, t: number, n: Note, six: number) {
    const f = hz(n.note)
    const len = n.len * six
    // A touch of human timing.
    const at = t + Math.random() * 0.015
    const lead = this.song?.lead ?? 'epiano'
    if (lead === 'vibes') return vibes(d, at, f, 0.065, Math.max(1.2, len * 2.5))
    if (lead === 'flute') return flute(d, at, f, 0.05, len * 0.92)
    epiano(d, at, f, 0.065, Math.max(1, len * 2.2))
  }

  stop() {
    if (this.song) setPlaying(null)
    const nodes = this.nodes
    setTimeout(() => nodes.forEach((n) => n.disconnect()), 4000)
  }
}

// A soft hall reverb: stereo noise that dies away, darkening as it goes.
function hallBuffer(ctx: BaseAudioContext, seconds: number) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const x = i / len
      // Damp more as the tail goes on, like a real room soaking up the highs.
      lp += (0.6 - 0.5 * x) * (Math.random() * 2 - 1 - lp)
      d[i] = i < ctx.sampleRate * 0.02 ? 0 : lp * Math.pow(1 - x, 2.2) * 0.5
    }
  }
  return buf
}

// Player settings: on by default, under the town sounds.
type Settings = { on: boolean; volume: number }
const KEY = 'cartopia-music'
let settings: Settings = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v && typeof v.on === 'boolean' && typeof v.volume === 'number') return { on: v.on, volume: Math.min(1, Math.max(0, v.volume)) }
  } catch {
    /* storage unavailable */
  }
  return { on: true, volume: 0.5 }
})()
const listeners = new Set<() => void>()
export const musicSettings = () => settings
export function setMusic(p: Partial<Settings>) {
  settings = { ...settings, ...p }
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l())
  wake()
}
export function onMusicChange(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

// How loud the music bus runs at full slider, to sit just above the town sounds.
const TRIM = 0.38

let ctx: AudioContext | null = null
let music: TownMusic | null = null
let timer: ReturnType<typeof setInterval> | null = null
let quietSince = 0

// Silent while muted, during races and arcade games, in a hidden tab, and
// giving way to the club's beat while the club is on screen.
function target() {
  if (!settings.on || isMuted() || townHeld() || document.hidden || technoOn()) return 0
  const club = clubOpen()
  return settings.volume * TRIM * (club ? 1 - (club.near ?? 1) : 1)
}

function tick() {
  if (!ctx) return
  const v = target()
  const t = ctx.currentTime
  if (v > 0.001) {
    if (!music) music = new TownMusic(ctx, audioOut() ?? ctx.destination)
    quietSince = 0
    music.level(v, t)
    music.step(t + 0.3, nightAmount(dayPhase()), SEASON, weatherNow().rain)
  } else if (music) {
    music.level(0, t, 0.3)
    if (!quietSince) quietSince = t
    // A hidden tab only pauses the song, so coming back carries on where it was.
    else if (t - quietSince > 2 && !document.hidden) {
      music.stop()
      music = null
    }
  }
  if (!music && v <= 0.001 && timer) {
    clearInterval(timer)
    timer = null
  }
}

function wake() {
  if (target() <= 0.001 && !music) return
  ctx = audioContext()
  if (!ctx) return
  if (!timer) timer = setInterval(tick, 100)
  tick()
}

let started = false
export function startMusic() {
  if (started || typeof window === 'undefined') return
  started = true
  for (const e of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(e, wake, { passive: true })
  document.addEventListener('visibilitychange', wake)
  onMuteChange(wake)
  onTownHold(wake)
  onTechnoChange(wake)
  // The club comes and goes with the clock and the camera, so check now and then.
  setInterval(wake, 2000)
}
