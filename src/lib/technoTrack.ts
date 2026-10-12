// The Techno Night track: 150 bpm warehouse techno in F minor, synthesised in
// Web Audio like the rest of the game's sound. A punchy driven kick, a rolling
// off-beat bass ducked under it, 808-style metal hats, claps, a squelchy 303
// acid line, dub-delayed minor chord stabs, and a breakdown with a pad, a
// riser and a clap roll into the drop.
//
// It follows the shared wall clock (techno.ts): sixteenth n plays at n * 100 ms
// since 1970, so every player's town is on the same bar. step() schedules a
// little ahead, so it also drives an offline render in tests.
import { CYCLE_BARS, SIXTEENTH_MS, kickOn, sectionOf, type Section } from '../game/techno'

const S = SIXTEENTH_MS / 1000 // one sixteenth, in seconds
const F1 = 43.65
// One root per bar over four bars: Fm, Fm, Db, Eb.
const ROOTS = [1, 1, 34.65 / F1, 38.89 / F1]
// Fm9: F3 Ab3 C4 Eb4 G4.
const CHORD = [174.61, 207.65, 261.63, 311.13, 392]
// The acid line: semitones above F2 (null = rest), slides and accents.
const ACID = [0, null, 12, 0, null, 3, 0, 15, 0, null, 10, 0, 12, null, 7, 3]
const SLIDES = new Set([3, 7, 11, 15])
const ACCENTS = new Set([0, 6, 10, 14])
// Closed hat loudness by sixteenth: the off-beat leans in.
const HAT = [0, 0.35, 1, 0.45]

// ---- Drum hits, rendered once into buffers so playing one costs one node ----

function render(ctx: BaseAudioContext, seconds: number, f: (t: number, noise: number) => number) {
  const sr = ctx.sampleRate
  const len = Math.floor(sr * seconds)
  const buf = ctx.createBuffer(1, len, sr)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = f(i / sr, Math.random() * 2 - 1)
  // A short fade so nothing clicks at the end.
  const fade = Math.min(len, Math.floor(sr * 0.008))
  for (let i = 0; i < fade; i++) d[len - 1 - i] *= i / fade
  let peak = 0
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]))
  if (peak > 0) for (let i = 0; i < len; i++) d[i] /= peak
  return buf
}

// A kick drum: a sine that drops from a click to a deep thud, driven so it
// still punches on phone speakers.
function kickBuf(ctx: BaseAudioContext) {
  let ph = 0
  const dt = 1 / ctx.sampleRate
  return render(ctx, 0.42, (t, nz) => {
    const f = 47 + 210 * Math.exp(-t / 0.028) + 500 * Math.exp(-t / 0.004)
    ph += 2 * Math.PI * f * dt
    const body = Math.sin(ph) * Math.exp(-t / 0.12) * (t < 0.002 ? t / 0.002 : 1)
    return Math.tanh(2.2 * body) + nz * 0.35 * Math.exp(-t / 0.0025)
  })
}

// One-pole high-pass, for the metal and noise hits.
function highPass(fc: number, sr: number) {
  const rc = 1 / (2 * Math.PI * fc)
  const a = rc / (rc + 1 / sr)
  let x0 = 0
  let y0 = 0
  return (x: number) => (y0 = a * (y0 + x - x0), x0 = x, y0)
}

// 808-style metal: six detuned square waves (the TR-808's hat recipe) and a
// little noise, high-passed, with a short or long decay.
function metalBuf(ctx: BaseAudioContext, seconds: number, decay: number, freqs: number[], noise: number, cut: number) {
  const sr = ctx.sampleRate
  const h1 = highPass(cut, sr)
  const h2 = highPass(cut, sr)
  return render(ctx, seconds, (t, nz) => {
    let m = 0
    for (const f of freqs) m += Math.sin(2 * Math.PI * f * t) > 0 ? 1 : -1
    const x = (m / freqs.length) * (1 - noise) + nz * noise
    return h2(h1(x)) * Math.exp(-t / decay) * (t < 0.001 ? t / 0.001 : 1)
  })
}
const HAT_FREQS = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => f * 2.1)
const RIDE_FREQS = [339, 453, 588, 721, 815, 1012].map((f) => f * 2.4)

// A hand clap: three quick slaps and a short tail, band-passed around 1.3 kHz.
function clapBuf(ctx: BaseAudioContext) {
  const sr = ctx.sampleRate
  // A state-variable band-pass.
  const f = 2 * Math.sin((Math.PI * 1300) / sr)
  const q = 1 / 1.4
  let lo = 0
  let bp = 0
  return render(ctx, 0.4, (t, nz) => {
    lo += f * bp
    const hi = nz - lo - q * bp
    bp += f * hi
    const env = [0, 0.009, 0.019].reduce((e, at) => e + (t >= at ? Math.exp(-(t - at) / 0.0035) : 0), 0) + (t >= 0.026 ? Math.exp(-(t - 0.026) / 0.075) * 0.9 : 0)
    return bp * env
  })
}

function noiseLoop(ctx: BaseAudioContext) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

// A soft drive curve, for the acid line and the bass.
function driveCurve(amount: number) {
  const c = new Float32Array(1024)
  for (let i = 0; i < c.length; i++) {
    const x = (i / (c.length - 1)) * 2 - 1
    c[i] = Math.tanh(amount * x) / Math.tanh(amount)
  }
  return c
}

// A small dark room for claps and stabs.
function roomBuf(ctx: BaseAudioContext, seconds: number) {
  const buf = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    let lp = 0
    for (let i = 0; i < d.length; i++) {
      const x = i / d.length
      lp += (0.5 - 0.35 * x) * (Math.random() * 2 - 1 - lp)
      d[i] = i < ctx.sampleRate * 0.01 ? 0 : lp * Math.pow(1 - x, 2.5)
    }
  }
  return buf
}

export class TechnoTrack {
  private ctx: BaseAudioContext
  private out: GainNode
  private mix: GainNode
  private duck: GainNode
  private drums: GainNode
  private hats: GainNode
  private room: ConvolverNode
  private delay: DelayNode
  private acidBus: GainNode
  private bassBus: GainNode
  private kick: AudioBuffer
  private clap: AudioBuffer
  private hatC: AudioBuffer
  private hatO: AudioBuffer
  private ride: AudioBuffer
  private crash: AudioBuffer
  private noise: AudioBuffer
  private next = -1 // the next sixteenth to schedule
  private acidHz = 0
  private sources: AudioScheduledSourceNode[] = []

  constructor(ctx: BaseAudioContext, dest: AudioNode) {
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = 0
    this.out.connect(dest)
    // The master bus: a compressor glues it together and keeps it loud but safe.
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 8
    comp.ratio.value = 4
    comp.attack.value = 0.004
    comp.release.value = 0.14
    comp.connect(this.out)
    this.mix = ctx.createGain()
    this.mix.connect(comp)
    this.drums = this.gain(1, this.mix)
    this.hats = this.gain(0.75, this.mix)
    // Everything melodic sits on the duck bus, which dips under every kick.
    this.duck = this.gain(1, this.mix)
    this.room = ctx.createConvolver()
    this.room.buffer = roomBuf(ctx, 1.4)
    this.room.connect(this.gain(0.5, this.mix))
    // A dotted-eighth dub delay, darker on every repeat.
    this.delay = ctx.createDelay(1)
    this.delay.delayTime.value = S * 3
    const fb = this.gain(0.42)
    const dark = this.filter('lowpass', 2200)
    this.delay.connect(dark).connect(fb).connect(this.delay)
    dark.connect(this.gain(0.6, this.duck))
    // The acid line and the bass each get a touch of drive.
    const acidDrive = ctx.createWaveShaper()
    acidDrive.curve = driveCurve(2.5)
    acidDrive.connect(this.gain(0.5, this.duck))
    this.acidBus = this.gain(1, acidDrive)
    const bassDrive = ctx.createWaveShaper()
    bassDrive.curve = driveCurve(1.8)
    bassDrive.connect(this.gain(0.4, this.duck))
    this.bassBus = this.gain(1, bassDrive)

    this.kick = kickBuf(ctx)
    this.clap = clapBuf(ctx)
    this.hatC = metalBuf(ctx, 0.12, 0.022, HAT_FREQS, 0.35, 6500)
    this.hatO = metalBuf(ctx, 0.5, 0.15, HAT_FREQS, 0.3, 6000)
    this.ride = metalBuf(ctx, 1.2, 0.35, RIDE_FREQS, 0.15, 4500)
    this.crash = metalBuf(ctx, 2.6, 0.8, RIDE_FREQS.map((f) => f * 1.3), 0.6, 3500)
    this.noise = noiseLoop(ctx)
  }

  level(v: number, t: number, tc = 0.4) {
    this.out.gain.setTargetAtTime(v, t, tc)
  }

  // Schedules the next half second. `t` is the audio clock now and `wall` the
  // wall-clock time (ms since 1970) that will be heard at `t`.
  step(t: number, wall: number) {
    const ahead = wall + 500
    const first = Math.ceil((wall + 40) / SIXTEENTH_MS)
    // Starting out, or after a stall (a hidden tab): pick up on the next sixteenth.
    if (this.next < first || this.next > first + 8) this.next = first
    while (this.next * SIXTEENTH_MS < ahead) {
      const n = this.next++
      this.sixteenth(n, t + (n * SIXTEENTH_MS - wall) / 1000)
    }
    this.sources = this.sources.filter((s) => (s as AudioScheduledSourceNode & { _end?: number })._end! > t)
  }

  stop() {
    for (const s of this.sources) {
      try {
        s.stop()
      } catch {
        /* already stopped */
      }
    }
    this.sources = []
    this.out.disconnect()
  }

  private sixteenth(n: number, at: number) {
    const k = n % 16
    const bar = Math.floor(n / 16)
    const p = ((bar % CYCLE_BARS) + CYCLE_BARS) % CYCLE_BARS
    const sec: Section = sectionOf(bar)
    const root = F1 * ROOTS[bar % 4]
    const brk = sec === 'break'
    // Through the breakdown, 0 at its start to 1 at the drop.
    const build = brk ? (p - 20 + k / 16) / 4 : 0

    // Kick, and the sidechain dip it carves into everything melodic.
    if (kickOn(n)) {
      this.play(this.kick, at, sec === 'drop' && k === 0 && p === 0 ? 1.15 : 1, this.drums)
      const g = this.duck.gain
      g.setValueAtTime(0.3, at)
      g.linearRampToValueAtTime(1, at + S * 2.6)
    }

    // The drop: a crash and a falling sub boom.
    if (p === 0 && k === 0) {
      this.play(this.crash, at, 0.5, this.hats)
      this.boom(at)
    }

    // Claps on two and four, and a roll that speeds up through the last bar of the breakdown.
    if (!brk && (k === 4 || k === 12)) this.play(this.clap, at, 0.55, this.drums, this.room, 0.3)
    if (brk && p === 23) {
      const every = k < 8 ? 2 : 1
      if (k % every === 0) this.play(this.clap, at, 0.18 + 0.35 * (k / 16), this.drums, this.room, 0.25)
      if (k >= 12) this.play(this.clap, at + S / 2, 0.2 + 0.3 * (k / 16), this.drums)
    }

    // Hats: sixteenth closed hats, an open hat on every off-beat, ride in the peak and drop.
    if (!brk) {
      if (k % 4) this.play(this.hatC, at, HAT[k % 4] * (sec === 'tension' ? 0.7 : 1) * (0.9 + Math.random() * 0.2), this.hats)
      if (k % 4 === 2 && sec !== 'tension') this.play(this.hatO, at, 0.55, this.hats)
      if ((sec === 'peak' || sec === 'drop') && k % 2 === 0) this.play(this.ride, at, k % 4 ? 0.3 : 0.18, this.hats)
    } else if (p >= 22) this.play(this.hatC, at, (0.2 + 0.6 * build) * HAT[k % 4 || 2], this.hats)

    // The rolling bass on the sixteenths between kicks.
    if (!brk && k % 4) this.bass(at, root * (k % 4 === 3 && bar % 2 ? 2 : 1), k % 4 === 2 ? 1 : 0.75)

    // The acid line: closed in the stripped-back bars, opening through the groove, wide open on the drop.
    const step = ACID[k]
    if (step !== null) {
      const open =
        sec === 'drop' ? 1 :
        sec === 'peak' ? 0.85 :
        sec === 'groove' ? 0.25 + 0.6 * ((p - 4 + k / 16) / 8) :
        sec === 'tension' ? 0.15 :
        0.1 + 0.6 * build
      this.acid(at, F1 * 2 * ROOTS[bar % 4] * 2 ** (step / 12), SLIDES.has(k), ACCENTS.has(k), open, brk ? 0.6 : 1)
    }

    // Minor chord stabs with a dub delay, in the peak and the drop.
    if ((sec === 'peak' && (k === 3 || k === 6 || k === 11)) || (sec === 'drop' && (k === 2 || k === 10 || (k === 7 && bar % 2)))) this.stab(at, ROOTS[bar % 4])

    // The breakdown: a dark pad that opens up and a noise riser.
    if (brk && k === 0) this.pad(at, ROOTS[bar % 4], p - 20)
    if (p === 20 && k === 0) this.riser(at)
  }

  private play(buf: AudioBuffer, at: number, gain: number, dest: AudioNode, send?: AudioNode, sendGain = 0) {
    const s = this.ctx.createBufferSource()
    s.buffer = buf
    const g = this.gain(gain, dest)
    s.connect(g)
    if (send) s.connect(this.gain(sendGain, send))
    this.start(s, at, at + buf.duration)
  }

  private bass(at: number, f: number, vel: number) {
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.5 * vel, at + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, at + S * 0.95)
    const lp = this.filter('lowpass', 900, undefined, 4)
    lp.frequency.setValueAtTime(260 + 900 * vel, at)
    lp.frequency.exponentialRampToValueAtTime(140, at + S * 0.8)
    lp.connect(g).connect(this.bassBus)
    const saw = this.osc('sawtooth', f, at, at + S)
    saw.connect(lp)
    const sub = this.osc('sine', f, at, at + S)
    sub.connect(this.gain(0.45, g))
  }

  // One 303-style note: a saw through a resonant filter that snaps shut, gliding
  // from the last note when it slides, louder and brighter on accents.
  private acid(at: number, f: number, slide: boolean, accent: boolean, open: number, level: number) {
    const len = slide ? S * 1.05 : S * 0.8
    const o = this.osc('sawtooth', f, at, at + len + 0.02)
    if (slide && this.acidHz) {
      o.frequency.setValueAtTime(this.acidHz, at)
      o.frequency.exponentialRampToValueAtTime(f, at + S * 0.6)
    }
    this.acidHz = f
    const lp = this.filter('lowpass', 200, undefined, accent ? 16 : 11)
    const top = 220 + 3400 * open * open * (accent ? 1.5 : 1)
    lp.frequency.setValueAtTime(top, at)
    lp.frequency.exponentialRampToValueAtTime(Math.max(160, top * 0.18), at + S * (accent ? 1.6 : 1.1))
    const g = this.ctx.createGain()
    const peak = (accent ? 0.34 : 0.22) * level
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + 0.003)
    g.gain.setValueAtTime(peak, at + len * 0.8)
    g.gain.exponentialRampToValueAtTime(0.0001, at + len)
    o.connect(lp).connect(g).connect(this.acidBus)
    if (accent) g.connect(this.gain(0.15, this.delay))
  }

  // A rave stab: the Fm9 chord on detuned saws through a plucked filter.
  private stab(at: number, ratio: number) {
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.1, at + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22)
    const lp = this.filter('lowpass', 3200, undefined, 3)
    lp.frequency.setValueAtTime(3600, at)
    lp.frequency.exponentialRampToValueAtTime(500, at + 0.2)
    lp.connect(g)
    g.connect(this.duck)
    g.connect(this.gain(0.6, this.delay))
    g.connect(this.gain(0.4, this.room))
    for (const f of CHORD) for (const d of [0.993, 1.007]) this.osc('sawtooth', f * ratio * d, at, at + 0.25).connect(lp)
  }

  // A bar-long pad in the breakdown, opening up as it builds.
  private pad(at: number, ratio: number, i: number) {
    const len = S * 16
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.05, at + 0.3)
    g.gain.setValueAtTime(0.05, at + len - 0.2)
    g.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.1)
    const lp = this.filter('lowpass', 400 + 500 * i, undefined, 2)
    lp.frequency.linearRampToValueAtTime(900 + 700 * i, at + len)
    lp.connect(g)
    g.connect(this.duck)
    g.connect(this.gain(0.8, this.room))
    for (const f of CHORD.slice(0, 4)) for (const d of [0.996, 1.004]) this.osc('sawtooth', (f / 2) * ratio * d, at, at + len + 0.15).connect(lp)
  }

  // White noise sweeping up through the four bars of the breakdown.
  private riser(at: number) {
    const len = S * 64
    const s = this.ctx.createBufferSource()
    s.buffer = this.noise
    s.loop = true
    const bp = this.filter('bandpass', 300, undefined, 2.5)
    bp.frequency.setValueAtTime(300, at)
    bp.frequency.exponentialRampToValueAtTime(9000, at + len)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.16, at + len)
    g.gain.linearRampToValueAtTime(0, at + len + 0.02)
    s.connect(bp).connect(g).connect(this.mix)
    g.connect(this.gain(0.4, this.room))
    this.start(s, at, at + len + 0.05)
  }

  // A falling sub boom under the drop.
  private boom(at: number) {
    const o = this.osc('sine', 70, at, at + 1.3)
    o.frequency.exponentialRampToValueAtTime(30, at + 1.2)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.5, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.25)
    o.connect(g).connect(this.drums)
  }

  private osc(type: OscillatorType, f: number, at: number, end: number) {
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.value = f
    this.start(o, at, end)
    return o
  }

  private start(s: AudioScheduledSourceNode, at: number, end: number) {
    s.start(at)
    s.stop(end)
    ;(s as AudioScheduledSourceNode & { _end?: number })._end = end
    this.sources.push(s)
  }

  private gain(v: number, dest?: AudioNode) {
    const g = this.ctx.createGain()
    g.gain.value = v
    if (dest) g.connect(dest)
    return g
  }

  private filter(type: BiquadFilterType, f: number, dest?: AudioNode, q = 1) {
    const b = this.ctx.createBiquadFilter()
    b.type = type
    b.frequency.value = f
    b.Q.value = q
    if (dest) b.connect(dest)
    return b
  }
}
