// Background music for the town: a soft, easy-going tune played on the
// game's instruments (marimba, glockenspiel, electric piano, plucked strings),
// written fresh as it plays so it never repeats exactly. Each season has its
// own key, chords and lead; nights slow down to a mellow electric piano. It
// sits under the town sounds, stops for races and arcade games, and gives way
// to the nightclub's beat when the club is on screen.
import { audioContext, audioOut, isMuted, onMuteChange } from './sound'
import { epiano, glock, hz, marimba, pluck, shaker, softKick } from './instruments'
import { dayPhase, nightAmount } from '../game/clock'
import { SEASON, type Season } from '../scene/season'
import { onTownHold, townHeld } from '../scene/renderGate'
import { weatherNow } from '../game/weather'
import { clubOpen } from './ambience'

type Lead = 'marimba' | 'glock' | 'epiano'
// A chord: its bass note, then the voicing played above it.
type Chord = [string, ...string[]]
export type Song = { bpm: number; chords: Chord[]; scale: string[]; lead: Lead }

export const SONGS: Record<Season, Song> = {
  // Spring in G: bright marimba over Gmaj9, Em9, Cmaj9, D6/9.
  spring: {
    bpm: 96,
    chords: [['G2', 'B3', 'D4', 'F#4', 'A4'], ['E2', 'G3', 'B3', 'D4', 'F#4'], ['C3', 'E3', 'G3', 'B3', 'D4'], ['D2', 'F#3', 'A3', 'B3', 'E4']],
    scale: ['D4', 'E4', 'G4', 'A4', 'B4', 'D5', 'E5', 'G5', 'A5'],
    lead: 'marimba',
  },
  // Summer in F: a bouncier marimba over Fmaj9, Dm9, Gm9, C9.
  summer: {
    bpm: 104,
    chords: [['F2', 'A3', 'C4', 'E4', 'G4'], ['D2', 'F3', 'A3', 'C4', 'E4'], ['G2', 'Bb3', 'D4', 'F4', 'A4'], ['C3', 'E3', 'Bb3', 'D4', 'G4']],
    scale: ['C4', 'D4', 'F4', 'G4', 'A4', 'C5', 'D5', 'F5', 'G5'],
    lead: 'marimba',
  },
  // Fall in D minor: laid-back electric piano over Dm9, G13, Cmaj9, Am7.
  fall: {
    bpm: 86,
    chords: [['D2', 'F3', 'A3', 'C4', 'E4'], ['G2', 'B3', 'E4', 'F4', 'A4'], ['C3', 'E3', 'G3', 'B3', 'D4'], ['A2', 'G3', 'C4', 'E4']],
    scale: ['A3', 'C4', 'D4', 'F4', 'G4', 'A4', 'C5', 'D5', 'F5'],
    lead: 'epiano',
  },
  // Winter in C: a gentle glockenspiel over Am9, Fmaj9, Cmaj9, G6/9.
  winter: {
    bpm: 78,
    chords: [['A2', 'C4', 'E4', 'G4', 'B4'], ['F2', 'A3', 'C4', 'E4', 'G4'], ['C3', 'E3', 'G3', 'B3', 'D4'], ['G2', 'B3', 'D4', 'E4', 'A4']],
    scale: ['G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6'],
    lead: 'glock',
  },
}

// The note's name without its octave, to match melody notes to chords.
const pc = (n: string) => n.replace(/\d+$/, '')

// Rhythms for a two-bar phrase, in sixteenths (0..31). Each ends on a long note.
const RHYTHMS = [
  [0, 3, 6, 8, 12, 16, 19, 22, 24],
  [0, 2, 4, 8, 10, 12, 16, 20, 24],
  [2, 4, 6, 10, 12, 16, 18, 24],
  [0, 6, 8, 10, 14, 16, 22, 24],
  [0, 4, 7, 8, 16, 18, 20, 24],
]

export type Note = { at: number; note: string; len: number }

// A two-bar melody: steps around the scale, landing on a note of the bar's
// chord on each strong beat, and ending on one. `chords` are the two bars' chords.
export function phrase(song: Song, chords: [Chord, Chord], random = Math.random, rhythm?: number[]): Note[] {
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

const BARS = 32 // one pass of the tune: intro, two melody verses, a break

export class TownMusic {
  private ctx: BaseAudioContext
  private input: GainNode
  private out: GainNode
  private delay: DelayNode
  private next = 0 // when the next sixteenth plays
  private pos = 0 // sixteenths since the start of this pass
  private night = false
  private song: Song = SONGS[SEASON]
  private motifs: Note[][] = []
  private nodes: AudioNode[] = []

  constructor(ctx: BaseAudioContext, dest: AudioNode) {
    this.ctx = ctx
    this.input = ctx.createGain()
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 6500
    this.out = ctx.createGain()
    this.out.gain.value = 0
    this.input.connect(tone).connect(this.out)
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
    wetTone.connect(wet).connect(this.out)
    this.out.connect(dest)
    this.nodes = [this.input, tone, this.out, this.delay, fb, wetTone, wet]
  }

  level(v: number, t: number, tau = 0.8) {
    this.out.gain.setTargetAtTime(v, t, tau)
  }

  private sixteenth() {
    return 60 / (this.song.bpm * (this.night ? 0.75 : 1)) / 4
  }

  // Schedule everything due before `until`. night: 0..1 dark. rain: 0..1.
  step(until: number, night: number, season: Season, rain = 0) {
    // Starting, or back after a pause: pick up from now rather than catching up.
    if (this.next < this.ctx.currentTime) this.next = this.ctx.currentTime + 0.05
    while (this.next < until) {
      if (this.pos % 16 === 0) this.bar(night, season)
      this.play(this.pos, this.next, rain)
      this.next += this.sixteenth()
      this.pos = (this.pos + 1) % (BARS * 16)
    }
  }

  // At each bar line: settle day/night and season, and write new tunes each pass.
  private bar(night: number, season: Season) {
    const n = night > 0.5
    if (n !== this.night || this.song !== SONGS[season] || !this.motifs.length) {
      this.night = n
      this.song = SONGS[season]
      this.delay.delayTime.setValueAtTime(this.sixteenth() * 3, this.next)
    }
    if (this.pos === 0 || !this.motifs.length) {
      // Phrase A, its answer over the next two chords in the same rhythm, and phrase B.
      const c = this.song.chords
      const a = phrase(this.song, [c[0], c[1]])
      this.motifs = [a, phrase(this.song, [c[2], c[3]], Math.random, a.map((x) => x.at)), phrase(this.song, [c[0], c[1]])]
    }
  }

  private play(pos: number, t: number, rain: number) {
    const d = { ctx: this.ctx, out: this.input }
    const bar = Math.floor(pos / 16)
    const s = pos % 16
    const chord = this.song.chords[bar % 4]
    const night = this.night
    const intro = bar < 4
    const verse = night ? bar >= 8 && bar < 16 : bar >= 8 && bar < 24
    const brk = bar >= 24
    const beat = this.sixteenth() * 4

    // Bass: the root on beat one, the octave answer on beat three by day.
    if (s === 0) pluck(d, t, hz(chord[0]), 0.2)
    if (!night && s === 8) pluck(d, t, hz(chord[0]) * (bar % 2 ? 1.5 : 2), 0.13)
    if (!night && s === 14 && bar % 4 === 3) pluck(d, t, hz(chord[0]) * 2, 0.1)

    // Chords on the electric piano, a little rolled.
    if (s === 0) chord.slice(1).forEach((n, k) => epiano(d, t + k * 0.012, hz(n), night ? 0.03 : 0.025, beat * 4.2))
    if (!night && !brk && (s === 6 || s === 10)) chord.slice(1, 4).forEach((n, k) => epiano(d, t + k * 0.008, hz(n), 0.014, beat * 0.9))

    // A plucked arpeggio up through the chord: eighths by day, quarters at night.
    const arp = chord.slice(1)
    if (!intro || bar >= 2) {
      if (night ? s % 4 === 2 : s % 2 === 0) {
        const k = night ? s / 4 : s / 2
        const order = [0, 1, 2, 3, 2, 1, 3, 2]
        const n = arp[order[Math.floor(k) % order.length] % arp.length]
        pluck(d, t, hz(n) * 2, verse ? 0.035 : 0.05)
      }
    }

    // The melody: phrase A, its answer, phrase B, then the answer again.
    if (verse) {
      const which = [0, 1, 2, 1][Math.floor((bar - 8) / 2) % 4]
      const m = this.motifs[which]
      const local = (bar % 2) * 16 + s
      for (const n of m) if (n.at === local) this.lead(d, t, n, night, beat)
    }

    // A light groove by day, held back in the intro, the break and the rain.
    if (!night && !intro && rain < 0.3) {
      if (!brk && (s === 0 || s === 8)) softKick(d, t, 0.07)
      if (s % 4 === 2) shaker(d, t, brk ? 0.006 : 0.01)
      else if (s % 2 === 1 && !brk) shaker(d, t, 0.004, 0.04)
    }
  }

  private lead(d: { ctx: BaseAudioContext; out: AudioNode }, t: number, n: Note, night: boolean, beat: number) {
    const f = hz(n.note)
    const len = (n.len / 4) * beat
    // A touch of human timing.
    const at = t + Math.random() * 0.012
    if (night) return epiano(d, at, f, 0.05, Math.max(0.8, len * 2))
    if (this.song.lead === 'glock') return glock(d, at, f, 0.035, Math.max(0.6, len * 2))
    if (this.song.lead === 'epiano') return epiano(d, at, f, 0.06, Math.max(0.8, len * 2))
    marimba(d, at, f, 0.08, Math.max(0.35, Math.min(1.2, len * 1.5)))
  }

  stop() {
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
