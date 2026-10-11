// Race car audio, synthesized live with Web Audio (no recordings): each car gets an
// engine voice shaped by its layout, firing pattern, price and exhaust mods, driven
// by the race sim's rpm. Plus gear changes, launches, turbo blow-off, exhaust pops,
// and the crowd at the finish.

import { audioCtx, soundOut, onStopEngine, onMuteChange, isMuted } from './sound'
import { CARS, carDef, type Body, type CarDef } from '../game/data'

export type EngineProfile = {
  ppr: number // firing pulses per crank turn (cylinders / 2 for four-strokes)
  idle: number // rpm
  redline: number // rpm
  roll: number // harmonic rolloff: higher is darker
  odd: number // 0-1, odd-harmonic buzz
  lump: number // 0-1, uneven firing / cam lope
  lumpRatio: number // lope rate as a fraction of the firing rate
  sub: number // 0-1, deep sub-octave rumble
  grit: number // 0-1, exhaust distortion
  noise: number // 0-1, exhaust and intake rush
  clatter: number // 0-1, diesel / air-cooled tick
  bright: number // filter opening at high rpm
  reso: number // exhaust resonance, Hz
  turbo: number // 0-1, spool whistle and blow-off valve
  whine: number // 0-1, supercharger or hybrid whine
  crackle: number // 0-1, pops on lift and shifts
  vol: number
}

const BASE: EngineProfile = {
  ppr: 2, idle: 850, redline: 7000, roll: 1.2, odd: 0.2, lump: 0, lumpRatio: 0.5, sub: 0.2, grit: 0.2,
  noise: 0.25, clatter: 0, bright: 1, reso: 180, turbo: 0, whine: 0, crackle: 0.1, vol: 1,
}
const p = (o: Partial<EngineProfile>): EngineProfile => ({ ...BASE, ...o })

// By body, then tuned per model below.
const BODY: Record<Body, EngineProfile> = {
  compact: p({ ppr: 1.5, idle: 950, redline: 6400, odd: 0.55, roll: 1.0, lump: 0.25, lumpRatio: 1 / 3, sub: 0.05, grit: 0.25, noise: 0.3, bright: 1.1, reso: 240, vol: 0.85 }),
  sedan: p({ ppr: 2, idle: 850, redline: 7600, odd: 0.3, roll: 1.1, sub: 0.1, noise: 0.25, bright: 1.15, reso: 220, vol: 0.9 }),
  roadster: p({ ppr: 2, idle: 900, redline: 7400, odd: 0.25, roll: 1.05, sub: 0.15, grit: 0.3, noise: 0.3, bright: 1.25, reso: 230, crackle: 0.25 }),
  truck: p({ ppr: 3, idle: 700, redline: 4200, odd: 0.35, roll: 1.35, sub: 0.45, grit: 0.35, noise: 0.35, clatter: 0.55, bright: 0.75, reso: 120, turbo: 0.35, vol: 1.05 }),
  muscle: p({ ppr: 4, idle: 750, redline: 6200, odd: 0.15, roll: 1.4, lump: 0.6, lumpRatio: 0.25, sub: 0.6, grit: 0.45, noise: 0.3, bright: 0.9, reso: 140, crackle: 0.35, vol: 1.15 }),
  rally: p({ ppr: 2, idle: 950, redline: 7600, odd: 0.2, roll: 1.15, lump: 0.45, lumpRatio: 0.5, sub: 0.3, grit: 0.4, noise: 0.35, bright: 1.15, reso: 190, turbo: 0.9, crackle: 0.7 }),
  sports: p({ ppr: 4, idle: 800, redline: 6600, odd: 0.15, roll: 1.25, lump: 0.35, lumpRatio: 0.25, sub: 0.5, grit: 0.4, noise: 0.3, bright: 1.05, reso: 150, crackle: 0.5, vol: 1.1 }),
  widebody: p({ ppr: 4, idle: 800, redline: 6300, odd: 0.15, roll: 1.3, lump: 0.5, lumpRatio: 0.25, sub: 0.65, grit: 0.55, noise: 0.35, bright: 0.95, reso: 135, whine: 0.8, crackle: 0.5, vol: 1.2 }),
  coupe: p({ ppr: 3, idle: 850, redline: 7200, odd: 0.15, roll: 1.15, sub: 0.3, grit: 0.3, noise: 0.3, bright: 1.1, reso: 200, turbo: 0.8, crackle: 0.35 }),
  tank: p({ ppr: 6, idle: 550, redline: 3000, odd: 0.4, roll: 1.6, lump: 0.35, lumpRatio: 1 / 6, sub: 0.9, grit: 0.6, noise: 0.5, clatter: 0.45, bright: 0.6, reso: 90, turbo: 0.3, vol: 1.3 }),
  scooter: p({ ppr: 1, idle: 2200, redline: 9500, odd: 0.7, roll: 0.85, sub: 0, grit: 0.35, noise: 0.35, bright: 1.4, reso: 420, vol: 0.7 }),
  chopper: p({ ppr: 1, idle: 900, redline: 5600, odd: 0.25, roll: 1.4, lump: 0.85, lumpRatio: 0.5, sub: 0.5, grit: 0.45, noise: 0.3, bright: 0.85, reso: 110, crackle: 0.4, vol: 1.1 }),
  sportbike: p({ ppr: 2, idle: 1300, redline: 14000, odd: 0.25, roll: 1.0, sub: 0.1, grit: 0.35, noise: 0.35, bright: 1.5, reso: 320, crackle: 0.45, vol: 0.95 }),
  wedge: p({ ppr: 6, idle: 950, redline: 8800, odd: 0.1, roll: 1.05, sub: 0.35, grit: 0.4, noise: 0.3, bright: 1.45, reso: 260, crackle: 0.7, vol: 1.15 }),
  super: p({ ppr: 4, idle: 950, redline: 8500, odd: 0.1, roll: 1.1, lump: 0.15, lumpRatio: 0.25, sub: 0.45, grit: 0.4, noise: 0.3, bright: 1.35, reso: 210, turbo: 0.6, crackle: 0.6, vol: 1.15 }),
  bubble: p({ ppr: 2, idle: 850, redline: 4800, odd: 0.45, roll: 1.1, lump: 0.4, lumpRatio: 0.5, sub: 0.1, grit: 0.3, noise: 0.3, clatter: 0.4, bright: 0.95, reso: 200, vol: 0.85 }),
  wagon: p({ ppr: 4, idle: 650, redline: 4200, odd: 0.2, roll: 1.5, lump: 0.35, lumpRatio: 0.25, sub: 0.4, grit: 0.25, noise: 0.25, bright: 0.7, reso: 120, vol: 0.95 }),
  classic: p({ ppr: 4, idle: 650, redline: 5000, odd: 0.15, roll: 1.5, lump: 0.45, lumpRatio: 0.25, sub: 0.5, grit: 0.3, noise: 0.25, bright: 0.75, reso: 125, crackle: 0.2 }),
  offroad: p({ ppr: 2, idle: 950, redline: 5800, odd: 0.4, roll: 1.0, lump: 0.5, lumpRatio: 0.5, sub: 0.2, grit: 0.55, noise: 0.45, clatter: 0.3, bright: 1.2, reso: 210, crackle: 0.45, vol: 1.05 }),
}

const MODEL: Record<string, Partial<EngineProfile>> = {
  // Kazumi tuners rev high and whine.
  civic: { redline: 8400, bright: 1.3, odd: 0.25 },
  miata: { redline: 7600 },
  gtr: { ppr: 3, redline: 7500, turbo: 1, crackle: 0.45, grit: 0.35 },
  // Cam-lope classic muscle vs the newer, smoother muscle.
  stallion: { lump: 0.8, idle: 700, redline: 5800, bright: 0.8 },
  charger: { lump: 0.55, grit: 0.5 },
  bandit: { lump: 0.65, grit: 0.5, crackle: 0.45 },
  hauler: { idle: 650, redline: 3800, clatter: 0.65, turbo: 0.2, vol: 1 },
  // Hybrid hypercar: twin-turbo V8 with an electric whine over it.
  hyper: { turbo: 0.9, whine: 0.55, redline: 9000 },
  // Flat-plane race V8.
  lemans: { lump: 0.05, odd: 0.3, redline: 8800, turbo: 0, crackle: 0.8, bright: 1.45 },
  // Smooth straight-six grand tourer.
  gullwing: { ppr: 3, turbo: 0, redline: 6800, lump: 0, roll: 1.25, bright: 1.0, crackle: 0.25 },
  lambo: { crackle: 0.85 },
}

export function engineProfile(modelId?: string, body?: Body): EngineProfile {
  const def = modelId ? CARS.find((c) => c.id === modelId) : undefined
  const b = def?.body ?? body ?? 'sedan'
  return { ...(BODY[b] ?? BASE), ...(modelId ? MODEL[modelId] : {}) }
}

// 0 (cheapest runabout) to 1 (hypercar): pricier cars get a richer, smoother, layered engine.
export function carQuality(def?: CarDef) {
  if (!def) return 0.4
  const worth = def.price + (def.bucks ?? 0) * 1500
  return Math.min(1, Math.max(0, Math.log10(Math.max(800, worth) / 800) / Math.log10(75)))
}

// How much the fitted exhaust changes the sound: louder, rougher, more pops.
const EXHAUST: Record<string, { vol: number; grit: number; crackle: number; bright: number }> = {
  twintips: { vol: 0.12, grit: 0.08, crackle: 0.1, bright: 0.05 },
  sidepipes: { vol: 0.25, grit: 0.2, crackle: 0.3, bright: 0.12 },
  flamepipes: { vol: 0.35, grit: 0.3, crackle: 0.7, bright: 0.18 },
}

let noiseBuf: AudioBuffer | null = null
function noise(a: AudioContext) {
  if (!noiseBuf || noiseBuf.sampleRate !== a.sampleRate) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const s = a.createBufferSource()
  s.buffer = noiseBuf
  s.loop = true
  return s
}

const curves = new Map<string, Float32Array<ArrayBuffer>>()
function curve(key: string, f: (x: number) => number) {
  let c = curves.get(key)
  if (!c) {
    c = new Float32Array(1024)
    for (let i = 0; i < 1024; i++) c[i] = f((i / 1023) * 2 - 1)
    curves.set(key, c)
  }
  return c
}
// Half-wave spikes: turns a sine into a pulse train for ticks and lope.
const spike = () => curve('spike', (x) => Math.pow(Math.max(0, x), 6))
const drive = (amt: number) => curve(`drive${amt.toFixed(2)}`, (x) => Math.tanh(x * (1 + amt * 6)) / Math.tanh(1 + amt * 6))

// A one-shot burst of filtered noise.
function burst(a: AudioContext, out: AudioNode, at: number, dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number, q = 1) {
  const n = noise(a)
  const f = a.createBiquadFilter()
  const g = a.createGain()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(f0, at)
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.012, dur * 0.2))
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  n.connect(f).connect(g).connect(out)
  n.start(at, Math.random() * 1.5)
  n.stop(at + dur + 0.05)
}

function blip(a: AudioContext, out: AudioNode, at: number, freq: number, dur: number, vol: number, type: OscillatorType = 'sine', to?: number) {
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(vol, at + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(out)
  o.start(at)
  o.stop(at + dur + 0.02)
}

type Mode = 'idle' | 'race' | 'coast'

// One running engine.
export class EngineVoice {
  private a: AudioContext
  private out: GainNode
  private pan: StereoPannerNode
  private oscs: OscillatorNode[] = []
  private srcs: AudioScheduledSourceNode[] = []
  private main: OscillatorNode
  private layer: OscillatorNode | null = null
  private sub: OscillatorNode
  private lope: OscillatorNode
  private tick: OscillatorNode
  private whistle: OscillatorNode
  private whineOsc: OscillatorNode
  private lp: BiquadFilterNode
  private nf: BiquadFilterNode
  private engGain: GainNode
  private noiseGain: GainNode
  private tickGain: GainNode
  private whistleGain: GainNode
  private whineGain: GainNode
  private prof: EngineProfile
  private q: number
  private level = 1
  private mode: Mode = 'idle'
  private rpm = 0 // sim scale: 0 idle, 1 redline
  private target = 0
  private throttle = 0
  private boost = 0
  private cutUntil = 0
  private revUntil = 0
  private timer: ReturnType<typeof setInterval>
  private dead = false

  constructor(a: AudioContext, dest: AudioNode, opts: { model?: string; body?: Body; mods?: string[]; pan?: number; level?: number }) {
    this.a = a
    const def = opts.model ? carDef(opts.model) : undefined
    const prof = { ...engineProfile(opts.model, opts.body) }
    const ex = opts.mods?.map((m) => EXHAUST[m]).find(Boolean)
    if (ex) {
      prof.vol += ex.vol
      prof.grit = Math.min(1, prof.grit + ex.grit)
      prof.crackle = Math.min(1, prof.crackle + ex.crackle)
      prof.bright += ex.bright
    }
    const q = carQuality(def)
    this.q = q
    // Cheap cars: thin and buzzy with a rattle. Expensive: deep, layered and clean.
    prof.odd = Math.min(0.9, prof.odd + (1 - q) * 0.35)
    prof.sub *= 0.35 + 0.65 * q
    prof.clatter = Math.min(1, prof.clatter + (1 - q) * 0.2)
    prof.crackle *= 0.4 + 0.8 * q
    prof.turbo *= 0.6 + 0.4 * q
    prof.vol *= 0.8 + 0.3 * q
    this.prof = prof
    this.level = opts.level ?? 1

    this.out = a.createGain()
    this.out.gain.value = 0.0001
    this.pan = a.createStereoPanner()
    this.pan.pan.value = opts.pan ?? 0
    this.out.connect(this.pan).connect(dest)

    // Engine tone: harmonic pulse wave at the firing rate.
    const n = Math.round(10 + q * 22)
    const real = new Float32Array(n + 1)
    const imag = new Float32Array(n + 1)
    for (let k = 1; k <= n; k++) {
      const odd = k % 2 === 1
      imag[k] = (1 / Math.pow(k, prof.roll)) * (odd ? 1 : 1 - prof.odd)
      // A little extra energy around the exhaust note on pricier cars.
      if (k >= 2 && k <= 4) imag[k] *= 1 + q * 0.4
    }
    const wave = a.createPeriodicWave(real, imag)
    this.main = a.createOscillator()
    this.main.setPeriodicWave(wave)
    this.sub = a.createOscillator()
    this.sub.type = 'triangle'
    this.lope = a.createOscillator()
    this.tick = a.createOscillator()
    this.whistle = a.createOscillator()
    this.whineOsc = a.createOscillator()
    this.whineOsc.type = 'triangle'

    const mix = a.createGain()
    mix.gain.value = 0.5
    this.main.connect(mix)
    const subG = a.createGain()
    subG.gain.value = prof.sub * 0.9
    this.sub.connect(subG).connect(mix)
    if (q > 0.35) {
      // Second, slightly detuned bank: the "big engine" chorus of a pricey car.
      this.layer = a.createOscillator()
      this.layer.setPeriodicWave(wave)
      this.layer.detune.value = 7 + q * 6
      const lg = a.createGain()
      lg.gain.value = (q - 0.35) * 0.7
      this.layer.connect(lg).connect(mix)
    }

    // Lope: amplitude wobble at a fraction of the firing rate (cross-plane V8, V-twin, boxer).
    const am = a.createGain()
    am.gain.value = 1 - prof.lump * 0.45
    const lopeDepth = a.createGain()
    lopeDepth.gain.value = prof.lump * 0.45
    this.lope.connect(lopeDepth).connect(am.gain)
    mix.connect(am)

    const shaper = a.createWaveShaper()
    shaper.curve = drive(prof.grit)
    shaper.oversample = q > 0.5 ? '4x' : '2x'
    const hp = a.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 160 - 130 * q
    this.lp = a.createBiquadFilter()
    this.lp.type = 'lowpass'
    this.lp.Q.value = 0.9 + q * 0.8
    const res = a.createBiquadFilter()
    res.type = 'peaking'
    res.frequency.value = prof.reso
    res.Q.value = 1.4
    res.gain.value = 3 + q * 6
    this.engGain = a.createGain()
    am.connect(shaper).connect(hp).connect(res).connect(this.lp).connect(this.engGain).connect(this.out)

    // Exhaust rush, pulsing with the lope.
    const nz = noise(a)
    this.nf = a.createBiquadFilter()
    this.nf.type = 'bandpass'
    this.nf.Q.value = 0.8
    this.noiseGain = a.createGain()
    const nam = a.createGain()
    nam.gain.value = 1 - prof.lump * 0.5
    lopeDepth.connect(nam.gain)
    nz.connect(this.nf).connect(this.noiseGain).connect(nam).connect(this.out)

    // Ticks: diesel clatter, air-cooled valvetrain, cheap-car rattle.
    const nz2 = noise(a)
    const thp = a.createBiquadFilter()
    thp.type = 'highpass'
    thp.frequency.value = 2200
    this.tickGain = a.createGain()
    this.tickGain.gain.value = 0
    const tshape = a.createWaveShaper()
    tshape.curve = spike()
    const tdepth = a.createGain()
    tdepth.gain.value = prof.clatter * 0.5
    this.tick.connect(tshape).connect(tdepth).connect(this.tickGain.gain)
    nz2.connect(thp).connect(this.tickGain).connect(this.out)

    // Turbo spool whistle and supercharger / hybrid whine.
    this.whistleGain = a.createGain()
    this.whistleGain.gain.value = 0
    this.whistle.connect(this.whistleGain).connect(this.out)
    this.whineGain = a.createGain()
    this.whineGain.gain.value = 0
    const wlp = a.createBiquadFilter()
    wlp.type = 'lowpass'
    wlp.frequency.value = 5000
    this.whineOsc.connect(wlp).connect(this.whineGain).connect(this.out)

    this.oscs = [this.main, this.sub, this.lope, this.tick, this.whistle, this.whineOsc, ...(this.layer ? [this.layer] : [])]
    this.srcs = [...this.oscs, nz, nz2]
    this.srcs.forEach((s) => s.start())
    this.apply(true)
    this.out.gain.setTargetAtTime(this.prof.vol * this.level, a.currentTime, 0.15)
    this.timer = setInterval(() => this.update(), 25)
  }

  get profile() {
    return this.prof
  }

  // Race frames: the sim's rpm (0-1.05) and whether the throttle is down.
  drive(rpm: number, throttle = 1) {
    this.mode = 'race'
    this.target = rpm
    this.throttle = throttle
  }

  // Pre-race: blip the throttle (each countdown beat).
  rev(amount = 0.6) {
    this.revUntil = this.a.currentTime + 0.22
    this.target = amount
  }

  // Gear change: throttle cut, clunk, then turbo blow-off or exhaust pops.
  shift() {
    const a = this.a
    const t = a.currentTime
    this.cutUntil = t + 0.09
    blip(a, this.out, t, 70, 0.08, 0.22 * this.prof.vol, 'sine', 45)
    burst(a, this.out, t, 0.04, 0.05, 'bandpass', 1400, 900, 2)
    if (this.prof.turbo > 0.3 && this.boost > 0.3) {
      burst(a, this.out, t + 0.02, 0.38, 0.09 * this.prof.turbo, 'bandpass', 3800, 1100, 1.2)
      // Flutter on the cheaper tuned cars, a clean psssh on the expensive ones.
      if (this.q < 0.7) for (let i = 0; i < 4; i++) burst(a, this.out, t + 0.03 + i * 0.045, 0.03, 0.04 * this.prof.turbo, 'bandpass', 2400, 1800, 3)
      this.boost *= 0.3
    }
    this.pops(t + 0.02, 0.15, 1 + Math.floor(this.prof.crackle * 3))
  }

  // Launch: wheelspin chirp, longer and louder on stronger cars.
  launch(power: number) {
    const a = this.a
    const t = a.currentTime
    const dur = 0.35 + power * 0.7
    burst(a, this.out, t, dur, 0.12 + power * 0.1, 'bandpass', 2600, 1700, 4)
    burst(a, this.out, t, dur * 0.8, 0.06 + power * 0.05, 'bandpass', 1300, 900, 6)
  }

  // Short chirp when a strong car grabs second.
  chirp(power: number) {
    if (power < 0.5) return
    burst(this.a, this.out, this.a.currentTime + 0.05, 0.18, 0.06 * power, 'bandpass', 2400, 1800, 5)
  }

  // Off the throttle after the line: revs fall, the exhaust crackles.
  coast() {
    if (this.mode === 'coast') return
    this.mode = 'coast'
    this.throttle = 0
    this.pops(this.a.currentTime + 0.05, 0.9, 2 + Math.round(this.prof.crackle * 7))
    if (this.prof.turbo > 0.3) burst(this.a, this.out, this.a.currentTime, 0.45, 0.08 * this.prof.turbo, 'bandpass', 3600, 1000, 1.2)
  }

  setLevel(l: number) {
    this.level = l
  }

  stop(fade = 0.4) {
    if (this.dead) return
    this.dead = true
    clearInterval(this.timer)
    const t = this.a.currentTime
    this.out.gain.cancelScheduledValues(t)
    this.out.gain.setTargetAtTime(0.0001, t, fade / 4)
    this.srcs.forEach((s) => {
      try {
        s.stop(t + fade + 0.1)
      } catch {
        /* already stopped */
      }
    })
    setTimeout(() => this.pan.disconnect(), (fade + 0.3) * 1000)
  }

  private pops(at: number, spread: number, count: number) {
    if (this.prof.crackle < 0.15) return
    for (let i = 0; i < count; i++) {
      if (Math.random() > this.prof.crackle + 0.2) continue
      const when = at + Math.random() * spread
      const f = 500 + Math.random() * 900
      burst(this.a, this.out, when, 0.03 + Math.random() * 0.04, (0.08 + Math.random() * 0.1) * this.prof.vol, 'bandpass', f, f * 0.6, 1.5)
    }
  }

  private update() {
    if (this.dead) return
    const t = this.a.currentTime
    if (this.mode === 'idle') {
      if (t > this.revUntil) this.target = 0
      this.throttle = this.target > 0.05 ? 1 : 0.15
    } else if (this.mode === 'coast') {
      this.target = Math.max(0, this.target - 0.025)
    }
    // Revs chase the target; quick up, slower down, like a real flywheel.
    const k = this.mode === 'race' ? 0.6 : this.target > this.rpm ? 0.3 : 0.12
    this.rpm += (this.target - this.rpm) * k
    this.apply(false)
  }

  private apply(now: boolean) {
    const a = this.a
    const t = a.currentTime
    const prof = this.prof
    const r = Math.min(1.05, Math.max(0, this.rpm))
    let thr = this.throttle
    if (t < this.cutUntil) thr = 0
    // Bouncing off the limiter chops the throttle about 18 times a second.
    if (this.mode === 'race' && this.rpm >= 0.995 && Math.floor(t * 18) % 2 === 0) thr = 0.1
    const realRpm = prof.idle + (prof.redline - prof.idle) * r
    // Tiny unsteadiness at idle so it never sounds like a test tone.
    const wob = r < 0.1 ? 1 + Math.sin(t * 7.3) * 0.012 + Math.sin(t * 2.1) * 0.01 : 1
    const fire = (realRpm / 60) * prof.ppr * wob
    const tc = now ? 0 : 0.02
    const set = (pp: AudioParam, v: number) => (now ? pp.setValueAtTime(v, t) : pp.setTargetAtTime(v, t, tc))
    set(this.main.frequency, fire)
    if (this.layer) set(this.layer.frequency, fire)
    set(this.sub.frequency, fire / 2)
    set(this.lope.frequency, fire * prof.lumpRatio)
    set(this.tick.frequency, fire)
    const load = 0.3 + 0.7 * thr
    set(this.lp.frequency, Math.min(16000, (220 + fire * (2.2 + 4 * thr) + r * 2600 * thr) * prof.bright))
    set(this.engGain.gain, (0.32 + 0.4 * r) * load)
    set(this.nf.frequency, Math.min(9000, 300 + fire * 5))
    set(this.noiseGain.gain, prof.noise * (0.05 + 0.3 * r * thr + 0.05 * r))
    set(this.tickGain.gain, prof.clatter * (0.04 + 0.05 * (1 - r)) * (0.5 + 0.5 * load))
    // Boost builds with revs under load and bleeds off when lifting.
    this.boost += ((thr > 0.5 ? r : 0) - this.boost) * (thr > 0.5 ? 0.08 : 0.3)
    set(this.whistle.frequency, 1800 + this.boost * 5200)
    set(this.whistleGain.gain, prof.turbo * this.boost * this.boost * 0.035)
    set(this.whineOsc.frequency, (realRpm / 60) * 9)
    set(this.whineGain.gain, prof.whine * (0.008 + 0.04 * r * load))
    if (!now && this.mode !== 'idle') set(this.out.gain, prof.vol * this.level)
    else if (!now) set(this.out.gain, prof.vol * this.level * 0.85)
  }
}

// Crowd at the start/finish line: a murmur that swells into a roar and cheers.
export class Crowd {
  private a: AudioContext
  private out: GainNode
  private srcs: AudioScheduledSourceNode[] = []
  private dead = false

  constructor(a: AudioContext, dest: AudioNode) {
    this.a = a
    this.out = a.createGain()
    this.out.gain.value = 0.0001
    this.out.connect(dest)
    // Several voices' worth of band-limited babble, each wobbling at its own rate.
    for (const [f, rate] of [[480, 3.1], [900, 4.3], [1500, 5.7], [2400, 2.6]]) {
      const n = noise(this.a)
      const bp = a.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = f
      bp.Q.value = 1.6
      const g = a.createGain()
      g.gain.value = 0.6
      const lfo = a.createOscillator()
      lfo.frequency.value = rate
      const d = a.createGain()
      d.gain.value = 0.35
      lfo.connect(d).connect(g.gain)
      n.connect(bp).connect(g).connect(this.out)
      n.start(0, Math.random() * 1.5)
      lfo.start()
      this.srcs.push(n, lfo)
    }
    this.out.gain.setTargetAtTime(0.025, a.currentTime, 0.5)
  }

  // The cars cross the line: the crowd erupts; louder with whistles when you win.
  cheer(won: boolean) {
    if (this.dead) return
    const a = this.a
    const t = a.currentTime
    const peak = won ? 0.2 : 0.09
    this.out.gain.cancelScheduledValues(t)
    this.out.gain.setTargetAtTime(peak, t, 0.12)
    this.out.gain.setTargetAtTime(0.035, t + 1.6, 0.9)
    const whistles = won ? 4 : 1
    for (let i = 0; i < whistles; i++) {
      const at = t + 0.15 + Math.random() * 1.2
      const f = 1900 + Math.random() * 900
      blip(a, this.out, at, f, 0.35 + Math.random() * 0.3, 0.12, 'sine', f * (Math.random() < 0.5 ? 1.25 : 0.8))
    }
    // Clapping.
    const claps = won ? 26 : 8
    for (let i = 0; i < claps; i++) burst(a, this.out, t + 0.3 + Math.random() * 2.2, 0.025, 0.25, 'bandpass', 1200 + Math.random() * 1400, 900, 1.2)
  }

  stop(fade = 1.2) {
    if (this.dead) return
    this.dead = true
    const t = this.a.currentTime
    this.out.gain.cancelScheduledValues(t)
    this.out.gain.setTargetAtTime(0.0001, t, fade / 4)
    this.srcs.forEach((s) => {
      try {
        s.stop(t + fade + 0.1)
      } catch {
        /* already stopped */
      }
    })
  }
}

// Everything one race needs. Created lazily so it stays silent while muted,
// and dropped when sound is turned off mid-race.
export class RaceAudio {
  me: EngineVoice | null = null
  them: EngineVoice | null = null
  crowd: Crowd | null = null
  private finished = { me: false, them: false }
  private offMute: () => void
  private closed = false
  private bus: AudioNode | null = null

  private mine: { model: string; mods?: string[] }
  private theirs: { model?: string; body: Body; mods?: string[] }

  constructor(mine: { model: string; mods?: string[] }, theirs: { model?: string; body: Body; mods?: string[] }) {
    this.mine = mine
    this.theirs = theirs
    this.offMute = onMuteChange(() => {
      if (isMuted()) this.silence()
    })
  }

  private ensure() {
    if (this.closed || this.me || isMuted()) return !!this.me
    const a = audioCtx()
    const dest = soundOut()
    if (!a || !dest) return false
    // A limiter keeps two roaring engines and a crowd from clipping on phone speakers.
    const out = a.createDynamicsCompressor()
    out.threshold.value = -14
    out.knee.value = 8
    out.ratio.value = 8
    out.attack.value = 0.004
    out.release.value = 0.2
    out.connect(dest)
    this.bus = out
    // Your car sits in the left lane on screen, the rival on the right.
    this.me = new EngineVoice(a, out, { model: this.mine.model, mods: this.mine.mods, pan: -0.2 })
    this.them = new EngineVoice(a, out, { model: this.theirs.model, body: this.theirs.body, mods: this.theirs.mods, pan: 0.6, level: 0.5 })
    this.crowd = new Crowd(a, out)
    return true
  }

  countdown(go: boolean) {
    if (!this.ensure()) return
    if (!go) {
      this.me!.rev(0.45 + Math.random() * 0.25)
      setTimeout(() => this.them?.rev(0.4 + Math.random() * 0.3), 120 + Math.random() * 200)
    }
  }

  launch(myPower: number, theirPower: number) {
    if (!this.ensure()) return
    this.me!.launch(myPower)
    this.them!.launch(theirPower * 0.6)
  }

  // Each frame of the race.
  frame(me: { rpm: number; finished: number | null; dist: number }, them: { rpm: number; finished: number | null; dist: number }) {
    if (!this.ensure()) return
    if (me.finished === null) this.me!.drive(me.rpm)
    else if (!this.finished.me) {
      this.finished.me = true
      this.me!.coast()
    }
    if (them.finished === null) this.them!.drive(them.rpm)
    else if (!this.finished.them) {
      this.finished.them = true
      this.them!.coast()
    }
    // The rival is loud alongside you and fades as the gap grows.
    const gap = Math.abs(me.dist - them.dist)
    this.them!.setLevel(0.6 / (1 + gap / 25))
  }

  shift(who: 'me' | 'them', gear: number, power: number) {
    const v = who === 'me' ? this.me : this.them
    if (!v) return
    v.shift()
    if (gear === 1) v.chirp(power)
  }

  finish(won: boolean) {
    this.crowd?.cheer(won)
    this.me?.coast()
    this.them?.coast()
    setTimeout(() => this.me?.stop(1.5), 1800)
    setTimeout(() => this.them?.stop(1.5), 1800)
  }

  private silence() {
    this.me?.stop(0.1)
    this.them?.stop(0.1)
    this.crowd?.stop(0.1)
    this.me = this.them = null
    this.crowd = null
    this.dropBus(0.2)
  }

  private dropBus(after: number) {
    const b = this.bus
    this.bus = null
    if (b) setTimeout(() => b.disconnect(), after * 1000 + 300)
  }

  close() {
    this.closed = true
    this.offMute()
    this.me?.stop(0.6)
    this.them?.stop(0.6)
    this.crowd?.stop(1.5)
    this.me = this.them = null
    this.crowd = null
    this.dropBus(1.6)
  }
}

let active: RaceAudio | null = null
export function raceAudio(mine: { model: string; mods?: string[] }, theirs: { model?: string; body: Body; mods?: string[] }) {
  active?.close()
  active = new RaceAudio(mine, theirs)
  return active
}
onStopEngine(() => {
  active?.close()
  active = null
})
