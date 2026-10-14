// The Rave Mode track: 150 bpm warehouse techno in F minor, synthesised in
// Web Audio like the rest of the game's sound. A punchy driven kick, a rolling
// off-beat bass ducked under it, 808-style metal hats, claps, a squelchy 303
// acid line, and a four-chord progression (Fm, Db, Ab, Eb) that everything
// follows: a supersaw lead melody, a plucked arpeggio, dub-delayed chord stabs
// and a breakdown pad. Each breakdown has a riser and a snare roll, a beat of
// silence and a reverse cymbal into the drop.
//
// It follows the wall clock from the drop (techno.ts): sixteenth n plays at
// drop + n * 100 ms, negative through the minute-long build-up, where the whole
// mix starts muffled and opens up before the breakdown, riser and drop.
// step() schedules a little ahead, so it also drives an offline render in tests.
import { BREAK_BARS, BUILD_BARS, CYCLE_BARS, SIXTEENTH_MS, breakBuild, kickOn, sectionOf, type Section } from '../game/techno'

const S = SIXTEENTH_MS / 1000 // one sixteenth, in seconds
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
// F natural minor, and a note `deg` scale steps above F.
const SCALE = [0, 2, 3, 5, 7, 8, 10]
const mod = (a: number, b: number) => ((a % b) + b) % b
const note = (deg: number) => 12 * Math.floor(deg / 7) + SCALE[mod(deg, 7)]
// One chord per bar, over four bars: Fm7, Dbmaj7, Abmaj7, Eb(add9).
const ROOT_DEG = [0, -2, 2, -1]
const ROOT_MIDI = ROOT_DEG.map((d) => 29 + note(d)) // F1, Db1, Ab1, Eb1
const CHORDS = [
  [53, 56, 60, 63],
  [49, 53, 56, 60],
  [56, 60, 63, 67],
  [51, 55, 58, 65],
]
// The lead melody, a four-bar phrase over the chords: [sixteenth, midi note, length].
// The first ending climbs into the next phrase, the second comes home.
type Note = [number, number, number]
const MELODY: Note[][] = [
  [[0, 72, 2], [3, 68, 1], [4, 72, 2], [6, 77, 2], [8, 75, 3], [11, 72, 1], [12, 68, 4]],
  [[0, 68, 2], [3, 65, 1], [4, 68, 2], [6, 73, 2], [8, 72, 3], [11, 68, 1], [12, 65, 4]],
  [[0, 75, 2], [3, 72, 1], [4, 75, 2], [6, 80, 2], [8, 79, 3], [11, 75, 1], [12, 72, 4]],
  [[0, 70, 2], [3, 67, 1], [4, 70, 2], [6, 75, 2], [8, 77, 2], [10, 79, 2], [12, 80, 2], [14, 79, 2]],
]
const HOME: Note[] = [[0, 79, 2], [3, 75, 1], [4, 70, 2], [6, 67, 2], [8, 70, 3], [11, 72, 1], [12, 75, 4]]
// The arpeggio's walk through the chord's four notes, an octave up.
const ARP = [0, 1, 2, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2]
// The acid line: scale steps above the chord's root (null = rest), slides and accents.
const ACID = [0, null, 7, 0, null, 2, 0, 9, 0, null, 6, 0, 7, null, 4, 2]
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

// A snare: a short tuned body and a bright noise rattle, for the rolls.
function snareBuf(ctx: BaseAudioContext) {
  const hp = highPass(1800, ctx.sampleRate)
  let ph = 0
  const dt = 1 / ctx.sampleRate
  return render(ctx, 0.3, (t, nz) => {
    ph += 2 * Math.PI * (185 + 70 * Math.exp(-t / 0.01)) * dt
    return 0.75 * Math.sin(ph) * Math.exp(-t / 0.05) + hp(nz) * Math.exp(-t / 0.085)
  })
}

// A cymbal played backwards, `seconds` long, swelling into its hit at the end.
function reverseBuf(ctx: BaseAudioContext, crash: AudioBuffer, seconds: number) {
  const len = Math.min(crash.length, Math.floor(ctx.sampleRate * seconds))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const src = crash.getChannelData(0)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = src[len - 1 - i] * (i / len) ** 1.5
  return buf
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
  private tone: BiquadFilterNode
  private swell: GainNode
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
  private snare: AudioBuffer
  private reverse: AudioBuffer
  private next: number | null = null // the next sixteenth to schedule, counted from the drop
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
    // After it, the build-up opens a filter over the whole mix, muffled to
    // bright, and swells it up from half volume.
    this.swell = this.gain(1, this.out)
    this.tone = this.filter('lowpass', 20000, this.swell, 0.9)
    comp.connect(this.tone)
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
    this.snare = snareBuf(ctx)
    this.reverse = reverseBuf(ctx, this.crash, S * 16)
  }

  level(v: number, t: number, tc = 0.4) {
    this.out.gain.setTargetAtTime(v, t, tc)
  }

  // Schedules the next half second. `t` is the audio clock now, `wall` the
  // wall-clock time (ms since 1970) that will be heard at `t`, and `drop` the
  // wall-clock time of the drop.
  step(t: number, wall: number, drop: number) {
    const rel = wall - drop
    const first = Math.ceil((rel + 40) / SIXTEENTH_MS)
    // Starting out, after a stall (a hidden tab) or a new event: pick up on the next sixteenth.
    if (this.next === null || this.next < first || this.next > first + 8) this.next = first
    while (this.next * SIXTEENTH_MS < rel + 500) {
      const n = this.next++
      this.sixteenth(n, t + (n * SIXTEENTH_MS - rel) / 1000)
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
    const k = mod(n, 16)
    const bar = Math.floor(n / 16)
    const p = mod(bar, CYCLE_BARS)
    const sec: Section = sectionOf(bar)
    const c = mod(bar, 4) // which chord
    const chord = CHORDS[c]
    const brk = sec === 'break'
    const intro = sec === 'intro'
    // Through the build-up's groove, 0 at its start to 1 at its breakdown.
    const rise = intro ? (bar + BUILD_BARS + k / 16) / (BUILD_BARS - BREAK_BARS) : 1
    // Through a breakdown, 0 at its start to 1 at the drop.
    const build = breakBuild(bar, k / 16)
    // Bars left to the next drop, in a breakdown (1 = the last bar).
    const toDrop = !brk ? 0 : bar < 0 ? -bar : CYCLE_BARS - p
    const breakStart = bar === -BREAK_BARS || (bar >= 0 && p === 20)
    // Half a beat of silence at the end of the last bar, before the drop lands.
    const gap = toDrop === 1 && k >= 14
    // The last bar of an eight-bar phrase gets a fill.
    const fill = !brk && !intro && mod(bar, 8) === 7

    // The build-up opens the whole mix from a muffled thud to full brightness.
    if (k === 0) {
      this.tone.frequency.setTargetAtTime(intro ? 220 * 14 ** Math.min(1, rise) : 20000, at, intro ? 0.4 : 0.05)
      this.swell.gain.setTargetAtTime(intro ? 0.3 + 0.7 * Math.min(1, rise) : 1, at, 0.4)
    }

    // Kick, and the sidechain dip it carves into everything melodic.
    if (kickOn(n)) {
      this.play(this.kick, at, sec === 'drop' && k === 0 && p === 0 ? 1.15 : 1, this.drums)
      const g = this.duck.gain
      g.setValueAtTime(0.3, at)
      g.linearRampToValueAtTime(1, at + S * 2.6)
    }

    // The drop: a crash and a falling sub boom, with a reverse cymbal swelling
    // into it through the bar before.
    if (bar >= 0 && p === 0 && k === 0) {
      this.play(this.crash, at, 0.5, this.hats)
      this.boom(at)
    }
    if (toDrop === 1 && k === 0) this.play(this.reverse, at, 0.5, this.hats, this.room, 0.3)
    // The silence: everything melodic (and its echoes) cuts out until the kick lands.
    if (gap && k === 14) this.duck.gain.setTargetAtTime(0, at, 0.015)

    // Claps on two and four (joining halfway through the build-up).
    if (!brk && (k === 4 || k === 12) && (!intro || rise > 0.5)) this.play(this.clap, at, 0.55, this.drums, this.room, 0.3)
    // The snare roll through the end of a breakdown: quarters, eighths, then
    // sixteenths and thirty-seconds in the last bar, rising all the way.
    if (toDrop && toDrop <= 4 && !gap) {
      const every = toDrop >= 3 ? 4 : toDrop === 2 ? 2 : 1
      const vel = 0.25 + 0.75 * ((4 - toDrop + k / 16) / 4)
      if (k % every === 0) this.play(this.snare, at, vel, this.drums, this.room, 0.35)
      if (toDrop === 1 && k >= 8) this.play(this.snare, at + S / 2, vel * 0.8, this.drums, this.room, 0.35)
    }
    // Phrase fills: a snare run over the last beat, and an open hat into the next bar.
    if (fill && k >= 12) this.play(this.snare, at, 0.25 + 0.08 * (k - 12), this.drums, this.room, 0.25)

    // Hats: sixteenth closed hats, an open hat on every off-beat, ride in the peak and drop.
    const sparse = sec === 'tension' || (intro && rise < 0.6)
    if (!brk) {
      if (k % 4) this.play(this.hatC, at, HAT[k % 4] * (sparse ? 0.7 : 1) * (0.9 + Math.random() * 0.2), this.hats)
      if ((k % 4 === 2 && !sparse) || (fill && k === 14)) this.play(this.hatO, at, 0.55, this.hats)
      if ((sec === 'peak' || sec === 'drop') && k % 2 === 0) this.play(this.ride, at, k % 4 ? 0.3 : 0.18, this.hats)
    } else if (build > 0.5 && !gap) this.play(this.hatC, at, (0.2 + 0.6 * build) * HAT[k % 4 || 2], this.hats)

    // The rolling bass on the sixteenths between kicks, on the chord's root.
    // It sits out the second half of the stripped-back bars.
    const root = hz(ROOT_MIDI[c])
    if (!brk && k % 4 && !(sec === 'tension' && p >= 18 && k >= 8)) this.bass(at, root * (k % 4 === 3 && mod(bar, 2) ? 2 : 1), k % 4 === 2 ? 1 : 0.75)

    // The acid line, following the chords: creeping open through the build-up,
    // closed in the stripped-back bars, opening through the groove, wide open
    // on the drop under the lead.
    const step = ACID[k]
    if (step !== null && !gap) {
      const open =
        sec === 'drop' ? 0.8 :
        sec === 'peak' ? 0.85 :
        sec === 'groove' ? 0.25 + 0.65 * ((p - 4 + k / 16) / 8) :
        sec === 'tension' ? 0.15 + 0.2 * ((p - 16 + k / 16) / 4) :
        intro ? 0.08 + 0.4 * rise :
        0.1 + 0.6 * build
      this.acid(at, hz(41 + note(ROOT_DEG[c] + step)), SLIDES.has(k), ACCENTS.has(k), open, brk ? 0.5 : sec === 'drop' ? 0.55 : 1)
    }

    // The arpeggio: fading in through the build-up, in the second half of the
    // groove and the peak, and filtered down in the stripped-back bars.
    const arp =
      intro ? (rise > 0.55 ? Math.min(1, (rise - 0.55) * 3) * 0.6 : 0) :
      sec === 'groove' ? (p >= 8 ? 0.6 + 0.1 * (p - 8) : 0) :
      sec === 'peak' ? 0.8 :
      sec === 'tension' ? 1 :
      brk ? 0.5 * build : 0
    if (arp && !gap) this.arp(at, chord[ARP[k]] + 12, arp, sec === 'tension' ? 0.25 + 0.15 * (p - 16) : intro ? 0.3 + 0.4 * rise : brk ? 0.3 + 0.5 * build : 0.75, mod(n, 2) ? 0.35 : -0.35)

    // The lead melody: a filtered teaser late in the build-up, soft and wide in
    // the breakdowns, plucked in the peak and full on (doubled an octave down)
    // over the drop.
    const lead =
      sec === 'drop' ? { level: 1, bright: 1, len: 1, low: true } :
      sec === 'peak' ? { level: 0.7, bright: 0.8, len: 0.5, low: false } :
      brk ? { level: 0.45 + 0.35 * build, bright: 0.3 + 0.5 * build, len: 1, low: false } :
      intro && bar >= -12 ? { level: 0.4, bright: 0.15 + 0.1 * (bar + 12), len: 1, low: false } :
      null
    if (lead && !gap) {
      // The first ending climbs into a drop; the second comes home.
      const phrase = c === 3 && !brk && !intro && mod(bar, 8) >= 4 ? HOME : MELODY[c]
      for (const [at16, m, len] of phrase) {
        if (at16 !== k || (toDrop === 1 && at16 + len > 14)) continue
        const l = Math.max(1, len * lead.len)
        this.lead(at, hz(m), l, lead.level, lead.bright)
        if (lead.low) this.lead(at, hz(m - 12), l, lead.level * 0.55, lead.bright * 0.7)
      }
    }

    // Chords: pumping supersaw stabs on the off-beats of the drop, dub-delayed
    // stabs in the peak.
    if (sec === 'drop' && k % 4 === 2) this.stab(at, chord, 0.075, 0.16, 0.25)
    if (sec === 'peak' && (k === 3 || k === 6 || k === 11)) this.stab(at, chord, 0.1, 0.22, 0.6)

    // Pads: a quiet one under the end of the build-up's groove, and one that
    // opens up through each breakdown, cut for the silence before the drop.
    if (k === 0 && (brk || (intro && bar >= -16))) this.pad(at, chord, brk ? Math.min(3, build * 4) : 0, brk ? 1 : 0.5, toDrop === 1 ? 14 : 16)
    if (breakStart && k === 0) this.riser(at, bar < 0 ? BREAK_BARS : 4)
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

  // One lead note `len` sixteenths long: three detuned saws spread across the
  // stereo field through a filter that blooms open and settles, with delay and room.
  private lead(at: number, f: number, len: number, level: number, bright: number) {
    const end = at + len * S
    const peak = 0.13 * level
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + 0.008)
    g.gain.exponentialRampToValueAtTime(peak * 0.65, at + 0.15)
    g.gain.setValueAtTime(peak * 0.65, Math.max(at + 0.15, end - 0.02))
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.14)
    const top = 500 + 5500 * bright * bright
    const lp = this.filter('lowpass', top, undefined, 2.5)
    lp.frequency.setValueAtTime(top, at)
    lp.frequency.exponentialRampToValueAtTime(Math.max(300, top * 0.4), at + 0.3)
    lp.connect(g)
    g.connect(this.duck)
    g.connect(this.gain(0.35, this.delay))
    g.connect(this.gain(0.35, this.room))
    for (const [d, pan] of [[0.992, -0.6], [1, 0], [1.008, 0.6]]) {
      const pn = this.ctx.createStereoPanner()
      pn.pan.value = pan
      pn.connect(lp)
      this.osc('sawtooth', f * d, at, end + 0.16).connect(pn)
    }
  }

  // One arpeggio pluck: a saw snapped shut by its filter, panned, into the delay.
  private arp(at: number, midi: number, level: number, bright: number, pan: number) {
    const g = this.ctx.createGain()
    const peak = 0.06 * level
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + 0.003)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
    const top = 400 + 4200 * bright * bright
    const lp = this.filter('lowpass', top, undefined, 4)
    lp.frequency.setValueAtTime(top, at)
    lp.frequency.exponentialRampToValueAtTime(Math.max(250, top * 0.2), at + 0.12)
    const pn = this.ctx.createStereoPanner()
    pn.pan.value = pan
    lp.connect(g).connect(pn).connect(this.duck)
    pn.connect(this.gain(0.4, this.delay))
    this.osc('sawtooth', hz(midi), at, at + 0.18).connect(lp)
  }

  // A rave stab: the bar's chord on detuned saws through a plucked filter.
  private stab(at: number, chord: number[], level: number, len: number, echo: number) {
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(level, at + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, at + len)
    const lp = this.filter('lowpass', 3200, undefined, 3)
    lp.frequency.setValueAtTime(3600, at)
    lp.frequency.exponentialRampToValueAtTime(500, at + len * 0.9)
    lp.connect(g)
    g.connect(this.duck)
    g.connect(this.gain(echo, this.delay))
    g.connect(this.gain(0.4, this.room))
    for (const m of [...chord, chord[0] + 12]) for (const d of [0.993, 1.007]) this.osc('sawtooth', hz(m) * d, at, at + len + 0.03).connect(lp)
  }

  // A pad `len` sixteenths long, an octave under the chord, opening up as it builds.
  private pad(at: number, chord: number[], i: number, level: number, len16: number) {
    const len = S * len16
    const peak = 0.05 * level
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + 0.3)
    g.gain.setValueAtTime(peak, at + len - 0.2)
    g.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.1)
    const lp = this.filter('lowpass', 400 + 500 * i, undefined, 2)
    lp.frequency.linearRampToValueAtTime(900 + 700 * i, at + len)
    lp.connect(g)
    g.connect(this.duck)
    g.connect(this.gain(0.8, this.room))
    for (const m of chord) for (const d of [0.996, 1.004]) this.osc('sawtooth', hz(m - 12) * d, at, at + len + 0.15).connect(lp)
  }

  // White noise sweeping up through a breakdown, `bars` long.
  private riser(at: number, bars: number) {
    const len = S * (16 * bars - 2) // it cuts out for the half beat of silence before the drop
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
