// Ambient town sounds that follow the clock and the season, synthesised with
// Web Audio so the game still ships no audio files. Days bring traffic,
// distant chatter and birds (cicadas in summer, crows in winter); nights bring
// crickets, spring peepers and owls, and a muffled beat from an open nightclub.
import { audioContext, audioOut, isMuted, onMuteChange } from './sound'
import { dayPhase, isNight, nightAmount } from '../game/clock'
import { SEASON, type Season } from '../scene/season'
import { onTownHold, townHeld } from '../scene/renderGate'
import { useGame } from '../game/store'
import { liveTraffic } from '../scene/traffic/live'
import type { Agent } from '../scene/traffic/sim'
import { toWorld } from '../scene/grid'
import { pickSpecies, sing, type Species } from './birdsong'
import { onThunder, weatherNow } from '../game/weather'

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
  yard: number // mowers and sprinklers
  dogs: number
  nightlife: number // far-off music and people out late
}

export function ambientMix(night: number, season: Season): Mix {
  const day = 1 - night
  const by = (v: Record<Season, number>) => v[season]
  return {
    traffic: day * 0.9 + night * 0.2,
    chatter: day * by({ winter: 0.45, spring: 0.9, summer: 1, fall: 0.8 }) + night * by({ winter: 0.12, spring: 0.22, summer: 0.3, fall: 0.22 }),
    birds: day * by({ winter: 0.1, spring: 1, summer: 0.75, fall: 0.35 }),
    crows: day * by({ winter: 0.8, spring: 0.15, summer: 0.1, fall: 0.5 }),
    cicadas: day * by({ winter: 0, spring: 0, summer: 0.85, fall: 0.15 }),
    leaves: (0.5 + 0.5 * day) * by({ winter: 0, spring: 0.25, summer: 0.3, fall: 0.85 }),
    wind: by({ winter: 0.75, spring: 0.3, summer: 0.15, fall: 0.5 }) + night * 0.1,
    crickets: night * by({ winter: 0, spring: 0.2, summer: 1, fall: 0.7 }),
    peepers: night * by({ winter: 0, spring: 1, summer: 0.3, fall: 0 }),
    owls: night * by({ winter: 0.7, spring: 0.4, summer: 0.4, fall: 0.7 }),
    yard: day * by({ winter: 0, spring: 0.6, summer: 1, fall: 0.25 }),
    dogs: day * 0.8 + night * 0.15,
    nightlife: night * by({ winter: 0.5, spring: 0.75, summer: 1, fall: 0.8 }),
  }
}

// The parts of the weather the sounds follow (see src/game/weather.ts), all 0..1.
export type Sky = { rain: number; snow: number; wind: number; wet: number }
export const CALM: Sky = { rain: 0, snow: 0, wind: 0, wet: 0 }

// Rain and snow send birds, bugs and people indoors.
export function weatherMix(m: Mix, sky: Sky): Mix {
  const wet = Math.max(sky.rain, sky.snow)
  return {
    ...m,
    birds: m.birds * (1 - 0.85 * wet),
    chatter: m.chatter * (1 - 0.6 * wet),
    yard: m.yard * (1 - wet),
    dogs: m.dogs * (1 - 0.5 * wet),
    cicadas: m.cicadas * (1 - sky.rain),
    crickets: m.crickets * (1 - 0.7 * sky.rain),
    traffic: m.traffic * (1 - 0.4 * sky.snow),
    leaves: Math.min(1, m.leaves + sky.wind * 0.5 * (m.leaves > 0 ? 1 : 0)),
    wind: Math.min(1, m.wind + sky.wind),
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
// An open nightclub in town: where it is on screen (-1 left .. 1 right).
export type Club = { pan: number }
// Where a point in the town sits left to right on screen, -1..1 (set by the scene).
let ear = (x: number, z: number) => Math.max(-1, Math.min(1, (x - z) / 40))
export function setEar(f: (x: number, z: number) => number) {
  ear = f
}
// A bird singing from one spot, repeating its song now and then like a real one.
type Singer = { kind: Species; pan: number; dist: number; next: number }

// A short room-like echo tail (decaying stereo noise), so sounds sit in a space.
function echoTail(ctx: BaseAudioContext, seconds: number) {
  const buf = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    let lp = 0
    for (let i = 0; i < d.length; i++) {
      const x = i / d.length
      lp += 0.35 * (Math.random() * 2 - 1 - lp) // soften the highs a little
      d[i] = i < ctx.sampleRate * 0.012 ? 0 : lp * Math.pow(1 - x, 3)
    }
  }
  return buf
}

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
  private murmur: GainNode
  private music: GainNode
  private wall: BiquadFilterNode
  private thump: GainNode
  private gritTone: BiquadFilterNode
  private musicPan: StereoPannerNode | null
  private beat = 0
  private vowels: BiquadFilterNode[]
  private howl: GainNode
  private howlTone: BiquadFilterNode
  private rain: GainNode
  private downpour: GainNode
  private wet = 0
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
  private room: ConvolverNode
  private singers: Singer[] = []

  constructor(ctx: BaseAudioContext, dest: AudioNode) {
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = 0
    this.out.connect(dest)
    this.white = noiseBuffer(ctx, 2, false)
    this.brown = noiseBuffer(ctx, 4, true)
    this.room = ctx.createConvolver()
    this.room.buffer = echoTail(ctx, 1.6)
    this.room.connect(this.out)

    // Beds: looping noise shaped into a steady layer, faded in and out by step().
    this.trafficTone = this.filter('lowpass', SEASON === 'winter' ? 170 : 300) // snow muffles the town
    this.traffic = this.bed(this.brown, this.trafficTone)
    this.windTone = this.filter('lowpass', 400)
    this.wind = this.bed(this.brown, this.windTone)
    // People out and about: a soft hubbub of breath-like voices, too far off to
    // make out words, made from noise through moving vowel-like bands.
    this.murmur = ctx.createGain()
    const voice = this.filter('lowpass', 1800, this.murmur)
    this.vowels = [420, 1100, 650].map((f, i) => this.filter('bandpass', f, voice, i === 1 ? 5 : 7))
    const split = ctx.createGain()
    this.vowels.forEach((v) => split.connect(v))
    this.bed(this.white, split, this.murmur)
    // Club music heard through the walls: everything but the bass is soaked up.
    this.music = ctx.createGain()
    this.music.gain.value = 0
    this.musicPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    this.wall = this.filter('lowpass', 400, this.music)
    if (this.musicPan) this.music.connect(this.musicPan).connect(this.out)
    else this.music.connect(this.out)
    // Phone speakers can't play deep bass, so the kick and bassline also go
    // through a little overdrive whose upper-bass harmonics they can play.
    this.thump = ctx.createGain()
    this.thump.connect(this.wall)
    const drive = ctx.createWaveShaper()
    const curve = new Float32Array(1024)
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 5)
    drive.curve = curve
    this.gritTone = this.filter('lowpass', 900, this.music)
    const grit = ctx.createGain()
    grit.gain.value = 0.5
    this.thump.connect(drive).connect(this.filter('highpass', 160)).connect(grit).connect(this.gritTone)
    const echo = ctx.createGain()
    echo.gain.value = 0.3
    this.music.connect(echo).connect(this.room)
    // Strong wind whistles round corners: a narrow band that slides with the gusts.
    this.howlTone = this.filter('bandpass', 600, undefined, 10)
    this.howl = this.bed(this.white, this.howlTone)
    // Rain: a bright hiss of drops, and a low roar when it pours.
    this.rain = ctx.createGain()
    const drops = this.filter('highpass', 900)
    drops.connect(this.filter('lowpass', 7500, this.rain))
    this.bed(this.white, drops, this.rain)
    this.downpour = this.bed(this.brown, this.filter('lowpass', 600))
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

  // Where a one-off sound plays from: a stereo position, plus some echo.
  private pan(p: number, wet = 0.2): AudioNode {
    const s: AudioNode = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.ctx.createGain()
    if ('pan' in s) (s as StereoPannerNode).pan.value = p
    s.connect(this.out)
    const w = this.ctx.createGain()
    w.gain.value = wet
    s.connect(w).connect(this.room)
    return s
  }

  // Far-off sounds are duller, quieter and echoier (dist 0 near, 1 far).
  private spot(p: number, dist: number) {
    return this.filter('lowpass', 9000 - dist * 6000, this.pan(p, 0.15 + dist * 0.4))
  }

  private noiseHit(t: number, dur: number, peak: number, dest: AudioNode, buf = this.white) {
    const src = this.ctx.createBufferSource()
    const g = this.ctx.createGain()
    src.buffer = buf
    g.gain.setValueAtTime(peak, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(g).connect(dest)
    src.start(t, rand(0, 1))
    src.stop(t + dur + 0.02)
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
  private blip(t: number, dur: number, peak: number, p: number | null, setup: (o: OscillatorNode) => void, through?: (n: AudioNode) => AudioNode) {
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    setup(o)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.03, dur / 3))
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const dest = p === null ? this.out : this.pan(p)
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

  step(t: number, night: number, season: Season, club: Club | boolean | null, sky: Sky = CALM) {
    const dt = this.last < 0 ? 0.2 : Math.min(1, t - this.last)
    this.last = t
    const m = weatherMix(ambientMix(night, season), sky)
    const fade = (g: GainNode, v: number) => g.gain.setTargetAtTime(v, t, 1.5)
    this.wet = sky.wet

    fade(this.rain, sky.rain * 0.05)
    fade(this.downpour, sky.rain * sky.rain * 0.08)
    // Water dripping off gutters and leaves after (and during) rain.
    if (chance(sky.wet * 2.5, dt)) this.drip(t + rand(0, 0.2))

    fade(this.traffic, m.traffic * 0.09)
    // The hubbub swells and dips as voices come and go.
    this.vowels.forEach((v, i) => v.frequency.setTargetAtTime([rand(300, 750), rand(900, 1900), rand(500, 900)][i], t, 0.08))
    // Outside an open club there's a little crowd hanging about.
    const crowd = m.chatter + (club ? 0.3 * m.nightlife : 0)
    this.murmur.gain.setTargetAtTime(crowd * rand(0.4, 1) * 0.045, t, 0.12)
    fade(this.chorus, m.crickets * 0.07 + m.peepers * 0.02)
    // Wind comes in gusts, and leaves rustle with it.
    if (t >= this.gustAt) {
      const gust = Math.random()
      this.gustAt = t + rand(2, 6)
      this.windTone.frequency.setTargetAtTime(300 + gust * 600, t, 1.2)
      if (gust > 0.75 && season !== 'summer') this.chimes(t + 0.5, m.wind)
      fade(this.wind, m.wind * (0.03 + gust * 0.08))
      this.howlTone.frequency.setTargetAtTime(450 + gust * 500, t, 0.8)
      fade(this.howl, sky.wind * sky.wind * gust * 0.05)
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
    this.birds(t, m.birds, season)
    if (chance(0.025 * m.dogs, dt)) this.dog(at)
    if (chance(0.03 * m.traffic * (1 - night), dt)) this.door(at)
    if (season !== 'winter' && chance(0.008 * m.chatter, dt)) this.bell(at)
    if (chance(0.004 * (1 - night), dt)) this.plane(at)
    if (chance(0.006 * m.yard, dt)) this.mower(at)
    if (chance(0.004 * m.yard, dt)) this.sprinkler(at)
    if (chance(0.004 * (1 - night) * (season === 'winter' ? 0.3 : 1), dt)) this.hammer(at)
    if (chance(0.035 * m.crows, dt)) this.crow(at)
    if (chance(0.022 * m.owls, dt)) this.owl(at)

    this.clubMusic(t, club, m.nightlife)
  }

  // Night music: a house beat and bassline thumping through the walls of your
  // own nightclub while it's open, or faintly from somewhere across town.
  private clubMusic(t: number, club: Club | boolean | null, nightlife: number) {
    const near = club ? 1 : 0
    const level = near ? 0.8 : nightlife * 0.3
    this.music.gain.setTargetAtTime(level, t, 2)
    this.wall.frequency.setTargetAtTime(near ? 700 : 260, t, 1)
    this.gritTone.frequency.setTargetAtTime(near ? 1100 : 650, t, 1)
    if (this.musicPan) this.musicPan.pan.setTargetAtTime(typeof club === 'object' && club ? club.pan * 0.8 : 0.4, t, 0.5)
    if (level < 0.01) {
      this.beatAt = 0
      return
    }
    const sixteenth = 60 / 122 / 4
    if (this.beatAt < t) this.beatAt = t + 0.1
    // A four-bar bassline (A, A, C, G), off the beat like house music.
    const roots = [55, 55, 65.41, 49]
    while (this.beatAt < t + 0.5) {
      const b = this.beatAt
      const k = this.beat % 16
      if (k % 4 === 0) {
        this.blip(b, 0.28, 0.7, null, (o) => {
          o.frequency.setValueAtTime(150, b)
          o.frequency.exponentialRampToValueAtTime(48, b + 0.1)
        }, () => this.thump)
      }
      if (k % 4 === 2) {
        const f = roots[Math.floor(this.beat / 16) % 4]
        this.blip(b, sixteenth * 1.8, 0.16, null, (o) => {
          o.type = 'sawtooth'
          o.frequency.value = f * (this.beat % 32 === 30 ? 2 : 1)
        }, () => this.thump)
      }
      if (near && (k === 4 || k === 12)) this.noiseHit(b, 0.09, 0.12, this.filter('bandpass', 1300, this.wall, 1.2))
      this.beat++
      this.beatAt += sixteenth
    }
  }

  // A car horn: a tap, a double toot or a long lean on it when someone's stuck.
  honk(t: number, pan: number, mood: number) {
    const pairs = [[415, 523], [349, 440], [392, 494], [311, 392]]
    const [f1, f2] = pairs[Math.floor(Math.random() * pairs.length)]
    const parts = mood < 0.4 ? [[0, 0.13]] : mood < 0.8 ? [[0, 0.1], [0.18, 0.16]] : [[0, rand(0.6, 0.95)]]
    const dest = this.pan(pan, 0.25)
    const tone = this.filter('lowpass', 2200, this.filter('peaking', 900, dest, 1))
    for (const [at, dur] of parts) {
      const s0 = t + at
      for (const f of [f1, f2]) {
        const o = this.ctx.createOscillator()
        const g = this.ctx.createGain()
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(f * rand(0.995, 1.005), s0)
        o.frequency.linearRampToValueAtTime(f * 0.97, s0 + dur + 0.04)
        g.gain.setValueAtTime(0, s0)
        g.gain.linearRampToValueAtTime(0.05, s0 + 0.015)
        g.gain.setValueAtTime(0.05, s0 + dur)
        g.gain.linearRampToValueAtTime(0, s0 + dur + 0.04)
        o.connect(g).connect(tone)
        o.start(s0)
        o.stop(s0 + dur + 0.06)
      }
    }
  }

  // A car driving past: road rumble, engine hum that drops in pitch as it
  // passes (Doppler) and tyre hiss, panning across. Some are trucks or scooters.
  private carPass(t: number) {
    const kind = Math.random()
    const truck = kind < 0.15
    const scooter = kind > 0.92
    const dur = truck ? rand(5, 7) : scooter ? rand(2.5, 3.5) : rand(3, 5.5)
    const mid = t + dur * 0.5
    const near = rand(0.4, 1)
    const g = this.ctx.createGain()
    const from = Math.random() < 0.5 ? -0.9 : 0.9
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(near, mid)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const p = this.ctx.createStereoPanner?.()
    if (p) {
      p.pan.setValueAtTime(from, t)
      p.pan.linearRampToValueAtTime(-from, t + dur)
      g.connect(p)
    }
    const dest = p ?? g
    dest.connect(this.out)
    const w = this.ctx.createGain()
    w.gain.value = 0.15
    dest.connect(w).connect(this.room)

    const rumble = this.ctx.createBufferSource()
    rumble.buffer = this.brown
    const f = this.filter('bandpass', 300, g, 1.2)
    f.frequency.setValueAtTime(260, t)
    f.frequency.linearRampToValueAtTime(rand(550, 800), mid)
    f.frequency.linearRampToValueAtTime(220, t + dur)
    const rg = this.ctx.createGain()
    rg.gain.value = truck ? 0.22 : 0.14
    rumble.connect(rg).connect(f)
    rumble.start(t, rand(0, 3))
    rumble.stop(t + dur + 0.1)

    const hiss = this.ctx.createBufferSource()
    hiss.buffer = this.white
    hiss.loop = true
    const hg = this.ctx.createGain()
    // Wet roads turn tyre noise into a long spray.
    hg.gain.value = (scooter ? 0.004 : 0.012) * (1 + this.wet * 5)
    hiss.connect(this.filter('bandpass', 1400 + this.wet * 1600, undefined, 0.6)).connect(hg).connect(g)
    hiss.start(t)
    hiss.stop(t + dur + 0.1)

    const hum = this.ctx.createOscillator()
    hum.type = 'sawtooth'
    const hz = truck ? rand(40, 55) : scooter ? rand(130, 170) : rand(65, 100)
    hum.frequency.setValueAtTime(hz * 1.04, t)
    hum.frequency.setValueAtTime(hz * 1.04, mid - 0.25)
    hum.frequency.linearRampToValueAtTime(hz * 0.95, mid + 0.25)
    const eg = this.ctx.createGain()
    eg.gain.value = truck ? 0.05 : scooter ? 0.025 : 0.03
    hum.connect(this.filter('lowpass', scooter ? 1200 : 450)).connect(eg).connect(g)
    hum.start(t)
    hum.stop(t + dur + 0.1)
  }

  private horn(t: number) {
    const p = rand(-0.8, 0.8)
    const dur = Math.random() < 0.5 ? 0.25 : 0.5
    for (const fr of [370, 466]) this.blip(t, dur, 0.015, p, (o) => { o.type = 'sawtooth'; o.frequency.value = fr }, (d) => this.filter('lowpass', 700, d))
  }

  // A few birds sing from their own spots around town, each repeating its
  // song every few seconds; now and then one flies off and another arrives.
  private birds(t: number, level: number, season: Season) {
    const want = Math.round(level * 4 + 0.3)
    while (this.singers.length < want) this.singers.push({ kind: pickSpecies(season), pan: rand(-0.95, 0.95), dist: rand(0, 1), next: t + rand(0.2, 5) })
    if (this.singers.length > want) this.singers.length = want
    this.singers.forEach((b, i) => {
      if (b.next > t + 0.4) return
      if (Math.random() < 0.12) {
        this.singers[i] = { kind: pickSpecies(season), pan: rand(-0.95, 0.95), dist: rand(0, 1), next: t + rand(2, 8) }
        return
      }
      const at = Math.max(b.next, t)
      const peak = 0.05 * (1 - b.dist * 0.6) * (b.kind === 'dove' ? 1.6 : 1)
      const len = sing(this.ctx, this.spot(b.pan, b.dist), b.kind, at, peak, this.white)
      b.next = at + len + rand(2.5, 9)
    })
  }

  // A dog a few yards away: one to three barks.
  private dog(t: number) {
    const p = rand(-0.9, 0.9)
    const dist = rand(0.3, 1)
    const big = Math.random() < 0.5
    const f = big ? rand(280, 360) : rand(500, 650)
    const dest = this.spot(p, dist)
    for (let i = Math.floor(rand(1, 4)); i > 0; i--) {
      const at = t
      const tone = this.filter('bandpass', big ? 900 : 1500, dest, 2)
      const g = this.ctx.createGain()
      g.gain.value = 0.35 * (1 - dist * 0.5)
      g.connect(tone)
      this.blip(at, 0.14, 1, 0, (o) => {
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(f, at)
        o.frequency.linearRampToValueAtTime(f * 1.25, at + 0.03)
        o.frequency.exponentialRampToValueAtTime(f * 0.7, at + 0.14)
      }, () => g)
      this.noiseHit(at, 0.08, 0.05 * (1 - dist * 0.5), tone)
      t += rand(0.3, 0.6)
    }
  }

  // A car door or trunk shutting down the street.
  private door(t: number) {
    const dest = this.filter('lowpass', 500, this.spot(rand(-0.9, 0.9), rand(0.3, 1)))
    this.noiseHit(t, 0.12, 0.35, dest, this.brown)
    this.noiseHit(t, 0.03, 0.04, dest)
  }

  // "Ding ding": a bicycle bell.
  private bell(t: number) {
    const p = rand(-0.8, 0.8)
    const f = rand(2100, 2500)
    for (const at of [t, t + 0.22]) for (const [mult, v] of [[1, 0.03], [2.76, 0.012], [5.4, 0.006]]) this.blip(at, 0.7, v, p, (o) => { o.frequency.value = f * mult })
  }

  // A plane high overhead: a slow, wide whoosh.
  private plane(t: number) {
    const dur = rand(18, 26)
    const src = this.ctx.createBufferSource()
    src.buffer = this.brown
    src.loop = true
    const f = this.filter('bandpass', 350, undefined, 0.8)
    f.frequency.setValueAtTime(250, t)
    f.frequency.linearRampToValueAtTime(600, t + dur * 0.45)
    f.frequency.linearRampToValueAtTime(200, t + dur)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.18, t + dur * 0.45)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g).connect(this.pan(rand(-0.5, 0.5), 0.3))
    src.start(t)
    src.stop(t + dur + 0.1)
  }

  // A lawn mower in a back yard, coming and going as it does its rows.
  private mower(t: number) {
    const dur = rand(20, 35)
    const o = this.ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = rand(26, 32)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    for (let s = 0; s < dur; s += 4) g.gain.linearRampToValueAtTime(rand(0.008, 0.03), t + s + 2)
    g.gain.linearRampToValueAtTime(0, t + dur)
    o.connect(this.filter('bandpass', 350, undefined, 0.9)).connect(g).connect(this.spot(rand(-0.9, 0.9), rand(0.5, 1)))
    o.start(t)
    o.stop(t + dur + 0.1)
  }

  // A lawn sprinkler ticking round.
  private sprinkler(t: number) {
    const dest = this.filter('highpass', 3000, this.spot(rand(-0.9, 0.9), rand(0.2, 0.8)))
    const n = Math.floor(rand(30, 60))
    for (let i = 0; i < n; i++) this.noiseHit(t + i * 0.14, 0.05, 0.05, dest)
  }

  // Someone hammering on a project down the block.
  private hammer(t: number) {
    const dest = this.filter('bandpass', rand(600, 1100), this.spot(rand(-0.9, 0.9), rand(0.5, 1)), 3)
    let s = t
    for (let i = Math.floor(rand(4, 10)); i > 0; i--) {
      this.noiseHit(s, 0.05, 0.4, dest)
      s += rand(0.45, 0.7)
    }
  }

  // A drop falling into a puddle or off a gutter.
  private drip(t: number) {
    const f = rand(1200, 2600)
    this.blip(t, 0.06, rand(0.004, 0.012), rand(-0.9, 0.9), (o) => {
      o.frequency.setValueAtTime(f, t)
      o.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.05)
    })
  }

  // Thunder: a crack when close, then a long rolling rumble.
  thunder(t: number, loud: number) {
    const near = loud > 0.6
    const p = rand(-0.7, 0.7)
    if (near) this.noiseHit(t, 0.35, 0.25 * loud, this.filter('highpass', 800, this.pan(p, 0.5)))
    const dur = rand(3.5, 7)
    const src = this.ctx.createBufferSource()
    src.buffer = this.brown
    src.loop = true
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    // A few rolling swells, each fainter than the last.
    let s = t
    for (let i = 0; i < 4 && s < t + dur - 0.6; i++) {
      g.gain.exponentialRampToValueAtTime((0.25 + 0.3 * loud) * (1 - i * 0.2), s + rand(0.08, near ? 0.15 : 0.5))
      s += rand(0.6, 1.6)
      g.gain.exponentialRampToValueAtTime(0.15 * (1 - i * 0.2), s)
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(this.filter('lowpass', near ? 400 : 220)).connect(g).connect(this.pan(p, 0.5))
    src.start(t, rand(0, 3))
    src.stop(t + dur + 0.1)
  }

  // Wind chimes on a porch, rung by a gust.
  private chimes(t: number, wind: number) {
    const scale = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2]
    const p = rand(-0.6, 0.6)
    const root = rand(880, 1100)
    for (let i = Math.floor(rand(2, 6)); i > 0; i--) {
      const f = root * scale[Math.floor(Math.random() * scale.length)]
      const at = t + rand(0, 1.5)
      this.blip(at, 2.2, 0.008 * wind, p, (o) => { o.frequency.value = f })
      this.blip(at, 1.2, 0.003 * wind, p, (o) => { o.frequency.value = f * 2.76 })
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

function clubOpen(): Club | null {
  if (!isNight()) return null
  const s = useGame.getState()
  const buildings = s.visiting ? s.visiting.buildings : s.buildings
  const c = buildings.find((b) => b.def === 'club')
  if (!c) return null
  const [x, z] = toWorld(c.x, c.z)
  return { pan: ear(x, z) }
}

// Drivers stuck behind someone lose patience and honk: behind a car pulled up
// or broken down, or after a long wait in a jam. Each waits its own while
// first, honks at most once per hold-up, and the town keeps it to one honk at a time.
export class HonkWatch {
  private patience = new Map<string, { after: number; done: boolean }>()
  private last = -Infinity
  private random: () => number
  constructor(random = Math.random) {
    this.random = random
  }

  // The cars that honk now (t in seconds).
  check(cars: Map<string, Agent>, t: number): Agent[] {
    const out: Agent[] = []
    for (const uid of this.patience.keys()) if (!cars.has(uid)) this.patience.delete(uid)
    for (const a of cars.values()) {
      let p = this.patience.get(a.uid)
      if (!p || a.wait < 0.1) {
        p = { after: 2.5 + this.random() * 3.5, done: false }
        this.patience.set(a.uid, p)
      }
      if (p.done || a.parked || a.stalled || a.leaving || a.tow || !a.gapTo || a.gap > 1.6) continue
      const o = cars.get(a.gapTo)
      const blocked = !!o && (o.parked > 0 || o.stalled)
      if (!(blocked ? a.wait > p.after : a.wait > p.after + 5)) continue
      p.done = true
      if (t - this.last < 2.5 || this.random() < 0.25) continue
      this.last = t
      out.push(a)
    }
    return out
  }
}

const watch = new HonkWatch()
function honks(s: Soundscape, t: number) {
  for (const a of watch.check(liveTraffic.agents, t)) s.honk(t + rand(0, 0.2), ear(a.x, a.z), Math.min(1, Math.random() * 0.8 + (a.wait > 12 ? 0.4 : 0)))
}

function tick() {
  if (!ctx) return
  const v = target()
  const t = ctx.currentTime
  if (v > 0) {
    if (!scape) scape = new Soundscape(ctx, audioOut() ?? ctx.destination)
    quietSince = 0
    scape.level(v, t)
    scape.step(t + 0.05, nightAmount(dayPhase()), SEASON, clubOpen(), weatherNow())
    honks(scape, t + 0.05)
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
  onThunder((delay, loud) => {
    if (ctx && scape && target() > 0) scape.thunder(ctx.currentTime + delay / 1000, loud)
  })
}
