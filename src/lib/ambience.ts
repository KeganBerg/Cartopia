// Ambient town sounds that follow the clock and the season, synthesised with
// Web Audio so the game still ships no audio files. Days bring traffic,
// distant chatter and birds (cicadas in summer, crows in winter); nights bring
// crickets, spring peepers and owls, and a muffled beat from an open nightclub.
import { audioContext, audioOut, isMuted, onMuteChange } from './sound'
import { dayPhase, isNight, nightAmount } from '../game/clock'
import { SEASON, type Season } from '../scene/season'
import { onTownHold, townHeld } from '../scene/renderGate'
import { useGame } from '../game/store'
import { pickSpecies, sing, type Species } from './birdsong'

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
    yard: day * by({ winter: 0, spring: 0.6, summer: 1, fall: 0.25 }),
    dogs: day * 0.8 + night * 0.15,
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
      if (gust > 0.75 && season !== 'summer') this.chimes(t + 0.5, m.wind)
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
    if (chance(0.2 * m.chatter, dt)) this.chatter(at)
    this.birds(t, m.birds, season)
    if (chance(0.05 * m.chatter, dt)) this.laugh(at)
    if (chance(0.025 * m.dogs, dt)) this.dog(at)
    if (chance(0.03 * m.traffic * (1 - night), dt)) this.door(at)
    if (season !== 'winter' && chance(0.008 * m.chatter, dt)) this.bell(at)
    if (chance(0.004 * (1 - night), dt)) this.plane(at)
    if (chance(0.006 * m.yard, dt)) this.mower(at)
    if (chance(0.004 * m.yard, dt)) this.sprinkler(at)
    if (chance(0.004 * (1 - night) * (season === 'winter' ? 0.3 : 1), dt)) this.hammer(at)
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
    hg.gain.value = scooter ? 0.004 : 0.012
    hiss.connect(this.filter('bandpass', 1400, undefined, 0.6)).connect(hg).connect(g)
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

  // Short bursts of far-off laughter.
  private laugh(t: number) {
    const p = rand(-0.8, 0.8)
    const f = rand(200, 300)
    let s = t
    for (let i = Math.floor(rand(4, 8)), k = 0; i > 0; i--, k++) {
      const at = s
      const d = rand(0.07, 0.11)
      this.blip(at, d, 0.18 * (1 - k * 0.08), p, (o) => {
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(f * (1 - k * 0.03), at)
        o.frequency.linearRampToValueAtTime(f * (0.9 - k * 0.03), at + d)
      }, (dest) => this.filter('bandpass', rand(700, 1000), this.filter('lowpass', 1500, dest), 3))
      s += d + rand(0.06, 0.1)
    }
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
