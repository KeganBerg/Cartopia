// Background music for the town: a soundtrack of short songs played on the
// game's instruments (marimba, glockenspiel, electric piano, plucked strings).
// Like a game soundtrack it shuffles: one song, a quiet spell with just the
// town, then a different one. Days and nights, and each season, have their
// own songs. Each song always has the same tune, so players get to know them.
// It sits under the town sounds, stops for races and arcade games, and gives
// way to the nightclub's beat when the club is on screen.
import { audioContext, audioOut, isMuted, onMuteChange } from './sound'
import { epiano, glock, hz, marimba, pluck, shaker, softKick } from './instruments'
import { dayPhase, nightAmount } from '../game/clock'
import { SEASON, type Season } from '../scene/season'
import { onTownHold, townHeld } from '../scene/renderGate'
import { weatherNow } from '../game/weather'
import { clubOpen } from './ambience'

type Lead = 'marimba' | 'glock' | 'epiano' | 'pluck'
// A chord: its bass note, then the voicing played above it.
type Chord = [string, ...string[]]
export type Song = {
  name: string
  when: 'day' | 'night'
  seasons?: Season[] // missing: any season
  bpm: number
  chords: Chord[] // one per bar, looping
  scale: string[] // the notes the tune is made of
  lead: Lead
  bass: 'root' | 'bounce' | 'walk'
  arp: 'eighths' | 'quarters' | 'strum' | 'none'
  groove: 'none' | 'brush' | 'shaker' | 'kick'
  comp?: boolean // offbeat electric piano stabs
  swing?: number // how late the in-between sixteenths land, as a share of one
  gain?: number // evens the songs out
}

const day = 'day' as const
const night = 'night' as const
export const SONGS: Song[] = [
  { name: 'Sunny Side Street', when: day, seasons: ['spring', 'summer'], bpm: 96, lead: 'marimba', bass: 'bounce', arp: 'eighths', groove: 'kick', comp: true,
    chords: [['G2', 'B3', 'D4', 'F#4', 'A4'], ['E2', 'G3', 'B3', 'D4', 'F#4'], ['C3', 'E3', 'G3', 'B3', 'D4'], ['D2', 'F#3', 'A3', 'B3', 'E4']],
    scale: ['D4', 'E4', 'G4', 'A4', 'B4', 'D5', 'E5', 'G5', 'A5'] },
  { name: 'Lemonade Stand', when: day, seasons: ['summer'], bpm: 104, lead: 'marimba', bass: 'bounce', arp: 'strum', groove: 'kick', comp: true, swing: 0.1,
    chords: [['F2', 'A3', 'C4', 'E4', 'G4'], ['D2', 'F3', 'A3', 'C4', 'E4'], ['G2', 'Bb3', 'D4', 'F4', 'A4'], ['C3', 'E3', 'Bb3', 'D4', 'G4']],
    scale: ['C4', 'D4', 'F4', 'G4', 'A4', 'C5', 'D5', 'F5', 'G5'] },
  { name: 'Paper Route', when: day, bpm: 112, lead: 'glock', bass: 'root', arp: 'strum', groove: 'shaker', gain: 1.25,
    chords: [['C3', 'E3', 'G3', 'C4', 'E4'], ['A2', 'E3', 'A3', 'C4', 'E4'], ['F2', 'F3', 'A3', 'C4', 'F4'], ['G2', 'G3', 'B3', 'D4', 'G4'],
      ['C3', 'E3', 'G3', 'C4', 'E4'], ['E2', 'E3', 'G3', 'B3', 'E4'], ['F2', 'A3', 'C4', 'F4'], ['G2', 'F3', 'B3', 'D4', 'G4']],
    scale: ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6'] },
  { name: 'Garage Sale', when: day, bpm: 100, lead: 'pluck', bass: 'walk', arp: 'none', groove: 'brush', comp: true, swing: 0.16, gain: 1.25,
    chords: [['D2', 'F#3', 'A3', 'D4'], ['C3', 'E3', 'G3', 'C4'], ['G2', 'G3', 'B3', 'D4'], ['D2', 'F#3', 'A3', 'D4']],
    scale: ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5'] },
  { name: 'Picnic Hill', when: day, seasons: ['spring', 'summer'], bpm: 92, lead: 'marimba', bass: 'bounce', arp: 'eighths', groove: 'kick',
    chords: [['A2', 'C#4', 'E4', 'G#4', 'B4'], ['F#2', 'A3', 'C#4', 'E4'], ['D3', 'F#3', 'A3', 'C#4', 'E4'], ['E2', 'G#3', 'B3', 'C#4', 'E4']],
    scale: ['E4', 'F#4', 'A4', 'B4', 'C#5', 'E5', 'F#5', 'A5'] },
  { name: 'Rainy Window', when: day, bpm: 72, lead: 'epiano', bass: 'root', arp: 'quarters', groove: 'none', gain: 1,
    chords: [['E2', 'G3', 'B3', 'D4', 'F#4'], ['C3', 'E3', 'G3', 'B3'], ['A2', 'C4', 'E4', 'G4', 'B4'], ['B2', 'A3', 'E4', 'F#4']],
    scale: ['E4', 'G4', 'A4', 'B4', 'D5', 'E5', 'G5'] },
  { name: 'Maple Drive', when: day, seasons: ['fall'], bpm: 86, lead: 'epiano', bass: 'bounce', arp: 'eighths', groove: 'brush', comp: true,
    chords: [['D2', 'F3', 'A3', 'C4', 'E4'], ['G2', 'B3', 'E4', 'F4', 'A4'], ['C3', 'E3', 'G3', 'B3', 'D4'], ['A2', 'G3', 'C4', 'E4']],
    scale: ['A3', 'C4', 'D4', 'F4', 'G4', 'A4', 'C5', 'D5', 'F5'] },
  { name: 'Cider Mill', when: day, seasons: ['fall'], bpm: 90, lead: 'pluck', bass: 'bounce', arp: 'strum', groove: 'shaker', swing: 0.1, gain: 1.5,
    chords: [['G2', 'Bb3', 'D4', 'F4'], ['C3', 'E3', 'Bb3', 'D4'], ['Eb3', 'G3', 'Bb3', 'D4'], ['D2', 'G3', 'A3', 'C4']],
    scale: ['G4', 'Bb4', 'C5', 'D5', 'F5', 'G5'] },
  { name: 'First Snow', when: day, seasons: ['winter'], bpm: 78, lead: 'glock', bass: 'root', arp: 'eighths', groove: 'none', gain: 1.4,
    chords: [['A2', 'C4', 'E4', 'G4', 'B4'], ['F2', 'A3', 'C4', 'E4', 'G4'], ['C3', 'E3', 'G3', 'B3', 'D4'], ['G2', 'B3', 'D4', 'E4', 'A4']],
    scale: ['G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6'] },
  { name: 'Cocoa Break', when: day, seasons: ['winter'], bpm: 84, lead: 'epiano', bass: 'walk', arp: 'none', groove: 'brush', comp: true, swing: 0.14, gain: 0.92,
    chords: [['F2', 'A3', 'C4', 'E4', 'G4'], ['A2', 'G3', 'C4', 'E4'], ['Bb2', 'A3', 'D4', 'F4'], ['C3', 'E3', 'A3', 'D4']],
    scale: ['C4', 'D4', 'F4', 'G4', 'A4', 'C5', 'D5', 'F5'] },
  { name: 'Streetlights', when: night, bpm: 66, lead: 'epiano', bass: 'root', arp: 'quarters', groove: 'none', gain: 1.1,
    chords: [['F2', 'A3', 'C4', 'E4'], ['E2', 'G3', 'B3', 'D4'], ['D2', 'F3', 'A3', 'C4'], ['C3', 'E3', 'G3', 'B3'],
      ['F2', 'A3', 'C4', 'E4'], ['E2', 'G3', 'B3', 'D4'], ['D2', 'F3', 'C4', 'E4'], ['G2', 'B3', 'D4', 'E4']],
    scale: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'] },
  { name: 'Night Shift', when: night, bpm: 70, lead: 'pluck', bass: 'walk', arp: 'none', groove: 'brush', comp: true, swing: 0.12, gain: 1.15,
    chords: [['A2', 'C4', 'E4', 'G4', 'B4'], ['D2', 'F3', 'A3', 'C4', 'E4'], ['G2', 'B3', 'E4', 'F4', 'A4'], ['C3', 'E3', 'G3', 'B3', 'D4']],
    scale: ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'] },
  { name: 'Porch Light', when: night, bpm: 62, lead: 'glock', bass: 'root', arp: 'quarters', groove: 'none', gain: 1.3,
    chords: [['Bb2', 'D4', 'F4', 'A4'], ['G2', 'Bb3', 'D4', 'F4'], ['Eb3', 'G3', 'Bb3', 'D4'], ['F2', 'A3', 'C4', 'D4']],
    scale: ['Bb4', 'C5', 'D5', 'F5', 'G5', 'Bb5', 'C6'] },
  { name: 'Moon Garage', when: night, bpm: 68, lead: 'epiano', bass: 'bounce', arp: 'eighths', groove: 'none',
    chords: [['E2', 'G3', 'B3', 'D4', 'F#4'], ['A2', 'G3', 'C#4', 'F#4'], ['G2', 'B3', 'D4', 'F#4'], ['F#2', 'A3', 'C#4', 'E4']],
    scale: ['E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5'] },
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

// Rhythms for a two-bar phrase, in sixteenths (0..31). Each ends on a long note.
const RHYTHMS = [
  [0, 3, 6, 8, 12, 16, 19, 22, 24],
  [0, 2, 4, 8, 10, 12, 16, 20, 24],
  [2, 4, 6, 10, 12, 16, 18, 24],
  [0, 6, 8, 10, 14, 16, 22, 24],
  [0, 4, 7, 8, 16, 18, 20, 24],
  [0, 4, 8, 12, 16, 24],
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
    const step = [-2, -1, -1, 1, 1, 2, 0][Math.floor(random() * 7)]
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

// The songs that suit now, leaving out the last few played if there are others.
export function songsFor(isNight: boolean, season: Season, recent: string[] = []) {
  const fit = SONGS.filter((s) => s.when === (isNight ? 'night' : 'day') && (!s.seasons || s.seasons.includes(season)))
  const fresh = fit.filter((s) => !recent.includes(s.name))
  return fresh.length ? fresh : fit
}

// A song: an intro, the tune, the tune again, a quieter break, and the tune
// once more, then it rings out on its first chord.
const BARS = 40
const VERSES = [[8, 16], [16, 24], [32, 40]]
const inVerse = (bar: number) => VERSES.some(([a, b]) => bar >= a && bar < b)

// Remembered across players so a race or a menu doesn't bring the same song back.
const recent: string[] = []
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
  private delay: DelayNode
  private next = 0 // when the next sixteenth plays
  private pos = 0 // sixteenths into the song
  private song: Song | null = null
  private resting = 0 // while between songs: when the next one starts
  private motifs = new Map<string, Note[]>()
  private random = Math.random
  private nodes: AudioNode[] = []
  // Tests and the clip renderer can pin the songs to play, in order.
  queue: string[] = []
  gap: [number, number] = [20, 50] // seconds of quiet between songs

  constructor(ctx: BaseAudioContext, dest: AudioNode) {
    this.ctx = ctx
    this.input = ctx.createGain()
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 6500
    this.songGain = ctx.createGain()
    this.out = ctx.createGain()
    this.out.gain.value = 0
    this.input.connect(tone).connect(this.songGain).connect(this.out)
    // A soft echo, so the notes sit in a little space.
    this.delay = ctx.createDelay(2)
    const fb = ctx.createGain()
    fb.gain.value = 0.3
    const wetTone = ctx.createBiquadFilter()
    wetTone.type = 'lowpass'
    wetTone.frequency.value = 2400
    const wet = ctx.createGain()
    wet.gain.value = 0.25
    this.input.connect(this.delay)
    this.delay.connect(wetTone).connect(fb).connect(this.delay)
    wetTone.connect(wet).connect(this.songGain)
    this.out.connect(dest)
    this.nodes = [this.input, tone, this.songGain, this.out, this.delay, fb, wetTone, wet]
  }

  level(v: number, t: number, tau = 0.8) {
    this.out.gain.setTargetAtTime(v, t, tau)
  }

  get current() {
    return this.song
  }

  private sixteenth() {
    return 60 / (this.song?.bpm ?? 90) / 4
  }

  private start(isNight: boolean, season: Season, at: number) {
    const pinned = this.queue.shift()
    const choices = songsFor(isNight, season, recent)
    const song = SONGS.find((s) => s.name === pinned) ?? choices[Math.floor(Math.random() * choices.length)]
    recent.push(song.name)
    if (recent.length > 3) recent.shift()
    this.song = song
    this.pos = 0
    this.next = at
    this.motifs.clear()
    this.random = seeded(song.name)
    this.songGain.gain.setValueAtTime(song.gain ?? 1, at)
    this.delay.delayTime.setValueAtTime(this.sixteenth() * 3, at)
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

  // The song rings out on its first chord, then the town has a quiet spell.
  private end(t: number) {
    const song = this.song!
    const d = { ctx: this.ctx, out: this.input }
    const c = song.chords[0]
    pluck(d, t, hz(c[0]), 0.2)
    c.slice(1).forEach((n, k) => epiano(d, t + k * 0.03, hz(n), 0.035, 5))
    if (song.lead !== 'pluck') this.lead(d, t + 0.1, { at: 0, note: song.scale.find((n) => c.slice(1).map(pc).includes(pc(n))) ?? song.scale[0], len: 16 }, this.sixteenth() * 4)
    this.song = null
    setPlaying(null)
    this.resting = t + 5 + this.gap[0] + Math.random() * (this.gap[1] - this.gap[0])
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
    const beat = this.sixteenth() * 4
    const root = hz(chord[0])

    // Bass.
    if (s === 0) pluck(d, t, root, 0.2)
    if (song.bass === 'bounce') {
      if (s === 8) pluck(d, t, root * (bar % 2 ? 1.5 : 2), 0.13)
      if (s === 14 && bar % 4 === 3) pluck(d, t, root * 2, 0.1)
    } else if (song.bass === 'walk' && !intro && s % 4 === 0 && s > 0) {
      // Up through the chord, then a step into the next bar's root.
      const to = hz(nextChord[0])
      const f = s === 4 ? root * 1.26 : s === 8 ? root * 1.5 : (to < root ? to * 1.06 : to / 1.06)
      pluck(d, t, f, 0.15)
    }

    // Chords on the electric piano, a little rolled.
    if (s === 0) chord.slice(1).forEach((x, k) => epiano(d, t + k * 0.012, hz(x), song.when === 'night' ? 0.03 : 0.025, beat * 4.2))
    if (song.comp && !intro && !brk && (s === 6 || s === 10)) chord.slice(1, 4).forEach((x, k) => epiano(d, t + k * 0.008, hz(x), 0.014, beat * 0.9))

    // Plucked strings: an arpeggio up through the chord, or a strum.
    const arp = chord.slice(1)
    const soft = verse ? 0.7 : 1
    if (bar >= 2 && song.arp !== 'none') {
      if (song.arp === 'strum') {
        if (s === 0 || s === 6 || s === 12) arp.forEach((x, k) => pluck(d, t + k * 0.015, hz(x) * 2, 0.03 * soft))
      } else if (song.arp === 'quarters' ? s % 4 === 2 : s % 2 === 0) {
        const k = song.arp === 'quarters' ? s / 4 : s / 2
        const order = [0, 1, 2, 3, 2, 1, 3, 2]
        pluck(d, t, hz(arp[order[Math.floor(k) % order.length] % arp.length]) * 2, 0.05 * soft)
      }
    }

    // The tune.
    if (verse) {
      const local = (bar % 2) * 16 + s
      for (const x of this.motif(bar - (bar % 2))) if (x.at === local) this.lead(d, t, x, beat)
    }

    // The groove, held back in the intro, the break and the rain.
    if (song.groove !== 'none' && !intro && rain < 0.3) {
      if (song.groove === 'kick' && !brk && (s === 0 || s === 8)) softKick(d, t, 0.07)
      const v = song.groove === 'brush' ? 0.6 : 1
      if (s % 4 === 2) shaker(d, t, (brk ? 0.006 : 0.01) * v)
      else if (s % 2 === 1 && !brk && song.groove !== 'brush') shaker(d, t, 0.004, 0.04)
    }
  }

  private lead(d: { ctx: BaseAudioContext; out: AudioNode }, t: number, n: Note, beat: number) {
    const f = hz(n.note)
    const len = (n.len / 4) * beat
    // A touch of human timing.
    const at = t + Math.random() * 0.012
    const lead = this.song?.lead ?? 'epiano'
    if (lead === 'glock') return glock(d, at, f, 0.035, Math.max(0.6, len * 2))
    if (lead === 'epiano') return epiano(d, at, f, 0.06, Math.max(0.8, len * 2))
    if (lead === 'pluck') return pluck(d, at, f, 0.11)
    marimba(d, at, f, 0.08, Math.max(0.35, Math.min(1.2, len * 1.5)))
  }

  stop() {
    if (this.song) setPlaying(null)
    const nodes = this.nodes
    setTimeout(() => nodes.forEach((n) => n.disconnect()), 3000)
  }
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
const TRIM = 1.8

let ctx: AudioContext | null = null
let music: TownMusic | null = null
let timer: ReturnType<typeof setInterval> | null = null
let quietSince = 0

// Silent while muted, during races and arcade games, in a hidden tab, and
// giving way to the club's beat while the club is on screen.
function target() {
  if (!settings.on || isMuted() || townHeld() || document.hidden) return 0
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
    else if (t - quietSince > 2) {
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
  // The club comes and goes with the clock and the camera, so check now and then.
  setInterval(wake, 2000)
}
