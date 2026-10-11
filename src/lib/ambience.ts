// Ambient town sounds that follow the clock and the season, synthesised with
// Web Audio so the game still ships no audio files. Days bring traffic,
// distant chatter and birds (cicadas in summer, crows in winter); nights bring
// crickets, spring peepers and owls, and a muffled beat from an open nightclub.
import { audioContext, audioOut, isMuted, onMuteChange } from './sound'
import { dayPhase, isNight, nightAmount } from '../game/clock'
import { SEASON, type Season } from '../scene/season'
import { onTownHold, townHeld } from '../scene/renderGate'
import { useGame } from '../game/store'

// How much of each layer plays, 0 to 1, for how dark it is and the season.
export type Mix = {
  traffic: number
  chatter: number
  birds: number
  crows: number
  cicadas: number
  leaves: number
  wind: number
  crickets: number
  peepers: number
  owls: number
}

export function ambientMix(night: number, season: Season): Mix {
  const day = 1 - night
  const by = (v: Record<Season, number>) => v[season]
  return {
    traffic: day * 0.9 + night * 0.2,
    chatter: day * by({ winter: 0.45, spring: 0.9, summer: 1, fall: 0.8 }),
    birds: day * by({ winter: 0.1, spring: 1, summer: 0.75, fall: 0.35 }),
    crows: day * by({ winter: 0.8, spring: 0.15, summer: 0.1, fall: 0.5 }),
    cicadas: day * by({ winter: 0, spring: 0, summer: 0.85, fall: 0.15 }),
    leaves: (0.5 + 0.5 * day) * by({ winter: 0, spring: 0.25, summer: 0.3, fall: 0.85 }),
    wind: by({ winter: 0.75, spring: 0.3, summer: 0.15, fall: 0.5 }) + night * 0.1,
    crickets: night * by({ winter: 0, spring: 0.2, summer: 1, fall: 0.7 }),
    peepers: night * by({ winter: 0, spring: 1, summer: 0.3, fall: 0 }),
    owls: night * by({ winter: 0.7, spring: 0.4, summer: 0.4, fall: 0.7 }),
  }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const chance = (perSecond: number, dt: number) => Math.random() < perSecond * dt

function noiseBuffer(ctx: BaseAudioContext, seconds: number, brown: boolean) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    } else d[i] = w
  }
  return buf
}

type Voice = { o: OscillatorNode; g: GainNode; next: number }

// The sound graph and its scheduler. step() is called a few times a second
// and schedules a little ahead, so it also drives an offline render in tests.
export class Soundscape {
  private ctx: BaseAudioContext
  private out: GainNode
  private white: AudioBuffer
  private brown: AudioBuffer
  private sources: AudioScheduledSourceNode[] = []
  private traffic: GainNode
  private trafficTone: BiquadFilterNode
  private wind: GainNode
  private windTone: BiquadFilterNode
  private leaves: GainNode
  private cicada: GainNode
  private chorus: GainNode
  private crickets: Voice[]
  private peepers: Voice[]
  private gustAt = 0
  private cicadaAt = 0
  private cicadaOn = false
  private beatAt = 0
  private last = -1

  constructor(ctx: BaseAudioContext, dest: AudioNode) {
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = 0
    this.out.connect(dest)
    this.white = noiseBuffer(ctx, 2, false)
    this.brown = noiseBuffer(ctx, 4, true)

    // Beds: looping noise shaped into a steady layer, faded in and out by step().
    this.trafficTone = this.filter('lowpass', SEASON === 'winter' ? 170 : 300) // snow muffles the town
    this.traffic = this.bed(this.brown, this.trafficTone)
    this.windTone = this.filter('lowpass', 400)
    this.wind = this.bed(this.brown, this.windTone)
    this.leaves = ctx.createGain()
    const hiss = this.filter('highpass', 2800)
    hiss.connect(this.filter('lowpass', 7000, this.leaves))
    this.bed(this.white, hiss, this.leaves)
    // Cicadas and a far-off cricket chorus: narrow noise bands, pulsed fast.
    this.cicada = this.pulsed(5200, 5, 150)
    this.chorus = this.pulsed(4600, 22, 26)
    this.crickets = [0, 1, 2].map((i) => this.voice(rand(4300, 4900), [-0.6, 0.5, 0.1][i]))
    this.peepers = [0, 1, 2].map((i) => this.voice(2800, [0.55, -0.4, -0.05][i]))
  }

  private filter(type: BiquadFilterType, freq: number, to?: AudioNode, q = 0.7) {
    const f = this.ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    if (to) f.connect(to)
    return f
  }

  private pan(p: number): AudioNode {
    if (!this.ctx.createStereoPanner) return this.out
    const s = this.ctx.createStereoPanner()
    s.pan.value = p
    s.connect(this.out)
    return s
  }

  private bed(buf: AudioBuffer, into: AudioNode, gain?: GainNode) {
    const g = gain ?? this.ctx.createGain()
    g.gain.value = 0
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    src.connect(into)
    if (!gain) into.connect(g)
    g.connect(this.out)
    src.start(0, rand(0, buf.duration))
    this.sources.push(src)
    return g
  }

  private pulsed(freq: number, q: number, rate: number) {
    const band = this.filter('bandpass', freq, undefined, q)
    const am = this.ctx.createGain()
    am.gain.value = 0.5
    const lfo = this.ctx.createOscillator()
    const depth = this.ctx.createGain()
    lfo.frequency.value = rate
    depth.gain.value = 0.5
    lfo.connect(depth).connect(am.gain)
    lfo.start()
    this.sources.push(lfo)
    const g = this.ctx.createGain()
    band.connect(am).connect(g)
    return this.bed(this.white, band, g)
  }

  private voice(freq: number, p: number): Voice {
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.frequency.value = freq
    g.gain.value = 0
    o.connect(g).connect(this.pan(p))
    o.start()
    this.sources.push(o)
    return { o, g, next: 0 }
  }

  // A one-off tone: an oscillator with a quick envelope, cleaned up after.
  private blip(t: number, dur: number, peak: number, p: number, setup: (o: OscillatorNode) => void, through?: (n: AudioNode) => AudioNode) {
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    setup(o)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.03, dur / 3))
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const dest = this.pan(p)
    o.connect(g).connect(through ? through(dest) : dest)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  stop() {
    for (const s of this.sources) {
      try {
        s.stop()
      } catch {
        /* never started */
      }
    }
    this.out.disconnect()
  }

  // Fade the whole soundscape to a volume (0 silences it).
  level(v: number, t: number, fade = 0.6) {
    this.out.gain.setTargetAtTime(v, t, fade)
  }

  step(t: number, night: number, season: Season, club: boolean) {
    const dt = this.last < 0 ? 0.2 : Math.min(1, t - this.last)
    this.last = t
    const m = ambientMix(night, season)
    const fade = (g: GainNode, v: number) => g.gain.setTargetAtTime(v, t, 1.5)

    fade(this.traffic, m.traffic * 0.09)
    fade(this.chorus, m.crickets * 0.07 + m.peepers * 0.02)
    // Wind comes in gusts, and leaves rustle with it.
    if (t >= this.gustAt) {
      const gust = Math.random()
      this.gustAt = t + rand(2, 6)
      this.windTone.frequency.setTargetAtTime(300 + gust * 600, t, 1.2)
      fade(this.wind, m.wind * (0.03 + gust * 0.08))
      fade(this.leaves, m.leaves * (0.004 + gust * gust * 0.03))
    }
    // Cicadas swell for a while, then rest.
    if (t >= this.cicadaAt) {
      this.cicadaOn = !this.cicadaOn && Math.random() < 0.8
      this.cicadaAt = t + (this.cicadaOn ? rand(8, 14) : rand(6, 16))
      this.cicada.gain.setTargetAtTime(this.cicadaOn ? m.cicadas * 0.05 : 0, t, this.cicadaOn ? 2.5 : 1.8)
    }

    // Crickets chirp in threes; more of them join as the night deepens.
    this.crickets.forEach((c, i) => {
      const on = m.crickets > [0.1, 0.4, 0.7][i]
      while (on && c.next < t + 0.4) {
        const at = Math.max(c.next, t)
        for (let k = 0; k < 3; k++) {
          const s = at + k * 0.04
          c.g.gain.setValueAtTime(0, s)
          c.g.gain.linearRampToValueAtTime(0.04 * m.crickets, s + 0.006)
          c.g.gain.linearRampToValueAtTime(0, s + 0.022)
        }
        c.next = at + rand(0.55, 0.85) + (Math.random() < 0.08 ? rand(1.5, 4) : 0)
      }
      if (!on) c.next = t
    })
    // Spring peepers: short rising whistles.
    this.peepers.forEach((c, i) => {
      const on = m.peepers > [0.1, 0.35, 0.6][i]
      while (on && c.next < t + 0.4) {
        const at = Math.max(c.next, t)
        const f = rand(2700, 3000)
        c.o.frequency.setValueAtTime(f * 0.88, at)
        c.o.frequency.linearRampToValueAtTime(f * 1.06, at + 0.11)
        c.g.gain.setValueAtTime(0, at)
        c.g.gain.linearRampToValueAtTime(0.03 * m.peepers, at + 0.03)
        c.g.gain.linearRampToValueAtTime(0, at + 0.13)
        c.next = at + rand(0.9, 1.5) + (Math.random() < 0.1 ? rand(1, 3) : 0)
      }
      if (!on) c.next = t
    })

    const at = t + rand(0.05, 0.3)
    if (chance(0.11 * m.traffic, dt)) this.carPass(at)
    if (chance(0.006 * m.traffic * (1 - night), dt)) this.horn(at)
    if (chance(0.12 * m.chatter, dt)) this.chatter(at)
    if (chance(0.3 * m.birds, dt)) this.bird(at, season)
    if (chance(0.035 * m.crows, dt)) this.crow(at)
    if (chance(0.022 * m.owls, dt)) this.owl(at)

    // The nightclub's bass leaks out while it's open.
    if (!club) this.beatAt = 0
    else {
      if (this.beatAt < t) this.beatAt = t + 0.1
      while (this.beatAt < t + 0.5) {
        const b = this.beatAt
        this.blip(b, 0.22, 0.08, 0.3, (o) => {
          o.frequency.setValueAtTime(120, b)
          o.frequency.exponentialRampToValueAtTime(45, b + 0.12)
        }, (d) => this.filter('lowpass', 300, d))
        this.beatAt += 60 / 122
      }
    }
  }

  private carPass(t: number) {
    const dur = rand(3, 5.5)
    const src = this.ctx.createBufferSource()
    src.buffer = this.brown
    const f = this.filter('bandpass', 300, undefined, 1.2)
    const g = this.ctx.createGain()
    const from = Math.random() < 0.5 ? -0.9 : 0.9
    const p = this.ctx.createStereoPanner?.()
    f.frequency.setValueAtTime(260, t)
    f.frequency.linearRampToValueAtTime(rand(550, 800), t + dur * 0.5)
    f.frequency.linearRampToValueAtTime(220, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(rand(0.12, 0.22), t + dur * 0.5)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g)
    if (p) {
      p.pan.setValueAtTime(from, t)
      p.pan.linearRampToValueAtTime(-from, t + dur)
      g.connect(p).connect(this.out)
    } else g.connect(this.out)
    src.start(t, rand(0, 3))
    src.stop(t + dur + 0.1)
  }

  private horn(t: number) {
    const p = rand(-0.8, 0.8)
    const dur = Math.random() < 0.5 ? 0.25 : 0.5
    for (const fr of [370, 466]) this.blip(t, dur, 0.015, p, (o) => { o.type = 'square'; o.frequency.value = fr }, (d) => this.filter('lowpass', 900, d))
  }

  // Far-off voices: buzzy syllables through vowel-like filters, too muffled to make out.
  private chatter(t: number) {
    const base = [115, 135, 205, 230][Math.floor(Math.random() * 4)]
    const p = rand(-0.8, 0.8)
    const n = Math.floor(rand(3, 9))
    let s = t
    for (let i = 0; i < n; i++) {
      const dur = rand(0.09, 0.22)
      const f0 = base * rand(0.9, 1.2)
      const f1 = [350, 500, 700][Math.floor(Math.random() * 3)]
      const f2 = [900, 1300, 1900][Math.floor(Math.random() * 3)]
      this.blip(s, dur, 0.22, p, (o) => {
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(f0, s)
        o.frequency.linearRampToValueAtTime(f0 * rand(0.85, 1.1), s + dur)
      }, (d) => {
        const lp = this.filter('lowpass', 1600, d)
        const a = this.filter('bandpass', f1, lp, 4)
        const b = this.filter('bandpass', f2, lp, 6)
        const split = this.ctx.createGain()
        split.connect(a)
        split.connect(b)
        return split
      })
      s += dur + (Math.random() < 0.2 ? rand(0.15, 0.35) : rand(0.02, 0.07))
    }
  }

  private bird(t: number, season: Season) {
    const p = rand(-0.9, 0.9)
    const kind = Math.floor(Math.random() * (season === 'winter' ? 1 : 3))
    if (kind === 0) {
      // "fee-bee": the chickadee's two-note whistle, heard all year.
      const f = rand(3600, 4000)
      this.blip(t, 0.32, 0.045, p, (o) => { o.frequency.value = f })
      this.blip(t + 0.4, 0.3, 0.04, p, (o) => { o.frequency.setValueAtTime(f * 0.86, t + 0.4); o.frequency.linearRampToValueAtTime(f * 0.84, t + 0.7) })
    } else if (kind === 1) {
      // A run of quick downward chirps.
      const n = Math.floor(rand(3, 7))
      const f = rand(3200, 5000)
      for (let i = 0; i < n; i++) {
        const s = t + i * rand(0.09, 0.13)
        this.blip(s, 0.07, 0.035, p, (o) => { o.frequency.setValueAtTime(f, s); o.frequency.exponentialRampToValueAtTime(f * 0.6, s + 0.07) })
      }
    } else {
      // A robin-like warble of sliding notes.
      let s = t
      for (let i = 0; i < Math.floor(rand(3, 6)); i++) {
        const a = rand(2300, 3400)
        const b = a * rand(0.8, 1.25)
        const d = rand(0.12, 0.2)
        const at = s
        this.blip(at, d, 0.04, p, (o) => { o.frequency.setValueAtTime(a, at); o.frequency.linearRampToValueAtTime(b, at + d) })
        s += d + rand(0.05, 0.12)
      }
    }
  }

  private crow(t: number) {
    const p = rand(-0.9, 0.9)
    for (let i = 0; i < Math.floor(rand(2, 4)); i++) {
      const s = t + i * 0.5
      this.blip(s, 0.28, 0.05, p, (o) => { o.type = 'sawtooth'; o.frequency.setValueAtTime(560, s); o.frequency.linearRampToValueAtTime(440, s + 0.28) }, (d) => this.filter('bandpass', 1150, d, 1.8))
    }
  }

  // A great horned owl's "hoo, hoo-hoo, hoo, hoo".
  private owl(t: number) {
    const p = rand(-0.8, 0.8)
    const f = rand(330, 380)
    let s = t
    for (const [d, gap] of [[0.4, 0.3], [0.16, 0.06], [0.2, 0.35], [0.5, 0.3], [0.45, 0]]) {
      const at = s
      this.blip(at, d, 0.08, p, (o) => { o.frequency.setValueAtTime(f, at); o.frequency.linearRampToValueAtTime(f * 0.93, at + d) }, (dd) => this.filter('lowpass', 700, dd))
      s += d + gap
    }
  }
}

// Player settings: on by default and fairly quiet.
type Settings = { on: boolean; volume: number }
const KEY = 'cartopia-ambience'
let settings: Settings = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v && typeof v.on === 'boolean' && typeof v.volume === 'number') return { on: v.on, volume: Math.min(1, Math.max(0, v.volume)) }
  } catch {
    /* storage unavailable */
  }
  return { on: true, volume: 0.7 }
})()
const listeners = new Set<() => void>()
export const ambienceSettings = () => settings
export function setAmbience(p: Partial<Settings>) {
  settings = { ...settings, ...p }
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l())
  wake()
}
export function onAmbienceChange(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

// Running it: start on the first tap (iOS only allows audio after one), fall
// silent while muted, during races and when the tab is hidden.
let ctx: AudioContext | null = null
let scape: Soundscape | null = null
let timer: ReturnType<typeof setInterval> | null = null
let quietSince = 0

const target = () => (settings.on && !isMuted() && !townHeld() && !document.hidden ? settings.volume : 0)

function clubOpen() {
  const s = useGame.getState()
  const buildings = s.visiting ? s.visiting.buildings : s.buildings
  return isNight() && buildings.some((b) => b.def === 'club')
}

function tick() {
  if (!ctx) return
  const v = target()
  const t = ctx.currentTime
  if (v > 0) {
    if (!scape) scape = new Soundscape(ctx, audioOut() ?? ctx.destination)
    quietSince = 0
    scape.level(v, t)
    scape.step(t + 0.05, nightAmount(dayPhase()), SEASON, clubOpen())
  } else if (scape) {
    scape.level(0, t, 0.25)
    // Tear the graph down once it has faded, so nothing runs while silent.
    if (!quietSince) quietSince = t
    else if (t - quietSince > 1.5) {
      scape.stop()
      scape = null
    }
  }
  if (!scape && v === 0 && timer) {
    clearInterval(timer)
    timer = null
  }
}

function wake() {
  if (target() === 0) return void tick()
  ctx = audioContext()
  if (!ctx) return
  if (!timer) timer = setInterval(tick, 200)
  tick()
}

let started = false
export function startAmbience() {
  if (started || typeof window === 'undefined') return
  started = true
  const unlock = () => wake()
  for (const e of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(e, unlock, { passive: true })
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ctx?.state !== 'running') ctx?.resume().catch(() => {})
    wake()
  })
  onMuteChange(wake)
  onTownHold(wake)
}
