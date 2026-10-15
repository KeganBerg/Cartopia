// Race car audio, synthesized live with Web Audio (no recordings): each car gets an
// engine voice shaped by its layout, firing pattern, price and exhaust mods, driven
// by the race sim's rpm. Plus gear changes, launches, turbo blow-off, exhaust pops,
// and the crowd at the finish.

import { audioContext, sfxOut, onStopEngine, onMuteChange, isMuted } from './sound'
import { loadEngineWorklet, engineWorkletReady, type PulseConfig } from './engineWorklet'
import { CARS, carDef, type Body, type CarDef } from '../game/data'
import { TOP_GEAR } from '../game/race'

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
  electric?: boolean // motor whine that rises with speed, no gear changes heard
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
  // Mid-engined V12 exotic: a high, clean howl.
  scissor: p({ ppr: 6, idle: 1000, redline: 9200, odd: 0.08, roll: 1.0, sub: 0.35, grit: 0.35, noise: 0.28, bright: 1.5, reso: 270, crackle: 0.8, vol: 1.2 }),
  // Quad-turbo W16: a deep, smooth rush with turbo whistle.
  horseshoe: p({ ppr: 8, idle: 800, redline: 6800, odd: 0.05, roll: 1.3, sub: 0.6, grit: 0.3, noise: 0.3, bright: 1.0, reso: 160, turbo: 1.0, crackle: 0.3, vol: 1.25 }),
  // Twin-turbo V12 with a bright edge.
  teardrop: p({ ppr: 6, idle: 950, redline: 8000, odd: 0.08, roll: 1.1, sub: 0.4, grit: 0.35, noise: 0.28, bright: 1.35, reso: 230, turbo: 0.5, crackle: 0.6, vol: 1.15 }),
  // Resto-mods: a raspy 1950s V12 on open pipes, a revvy twin-cam four, and a lumpy big-block V8.
  pontoon: p({ ppr: 6, idle: 950, redline: 8400, odd: 0.12, roll: 1.05, sub: 0.3, grit: 0.5, noise: 0.35, bright: 1.3, reso: 240, crackle: 0.9, vol: 1.15 }),
  stepnose: p({ ppr: 2, idle: 950, redline: 7800, odd: 0.25, roll: 1.1, lump: 0.2, lumpRatio: 0.5, sub: 0.2, grit: 0.4, noise: 0.3, bright: 1.3, reso: 250, crackle: 0.55, vol: 1.0 }),
  restomuscle: p({ ppr: 4, idle: 700, redline: 6600, odd: 0.15, roll: 1.45, lump: 0.75, lumpRatio: 0.25, sub: 0.7, grit: 0.5, noise: 0.32, bright: 0.9, reso: 130, whine: 0.5, crackle: 0.5, vol: 1.25 }),
  wedge: p({ ppr: 6, idle: 950, redline: 8800, odd: 0.1, roll: 1.05, sub: 0.35, grit: 0.4, noise: 0.3, bright: 1.45, reso: 260, crackle: 0.7, vol: 1.15 }),
  super: p({ ppr: 4, idle: 950, redline: 8500, odd: 0.1, roll: 1.1, lump: 0.15, lumpRatio: 0.25, sub: 0.45, grit: 0.4, noise: 0.3, bright: 1.35, reso: 210, turbo: 0.6, crackle: 0.6, vol: 1.15 }),
  bubble: p({ ppr: 2, idle: 850, redline: 4800, odd: 0.45, roll: 1.1, lump: 0.4, lumpRatio: 0.5, sub: 0.1, grit: 0.3, noise: 0.3, clatter: 0.4, bright: 0.95, reso: 200, vol: 0.85 }),
  wagon: p({ ppr: 4, idle: 650, redline: 4200, odd: 0.2, roll: 1.5, lump: 0.35, lumpRatio: 0.25, sub: 0.4, grit: 0.25, noise: 0.25, bright: 0.7, reso: 120, vol: 0.95 }),
  classic: p({ ppr: 4, idle: 650, redline: 5000, odd: 0.15, roll: 1.5, lump: 0.45, lumpRatio: 0.25, sub: 0.5, grit: 0.3, noise: 0.25, bright: 0.75, reso: 125, crackle: 0.2 }),
  hatch: p({ ppr: 2, idle: 950, redline: 7200, odd: 0.25, roll: 1.1, sub: 0.15, grit: 0.4, noise: 0.35, bright: 1.25, reso: 230, turbo: 0.85, crackle: 0.55, vol: 0.95 }),
  van: p({ ppr: 2, idle: 800, redline: 4600, odd: 0.4, roll: 1.2, lump: 0.35, lumpRatio: 0.5, sub: 0.15, grit: 0.25, noise: 0.3, clatter: 0.35, bright: 0.8, reso: 170, vol: 0.85 }),
  suv: p({ ppr: 3, idle: 750, redline: 5600, odd: 0.2, roll: 1.3, lump: 0.15, lumpRatio: 1 / 3, sub: 0.45, grit: 0.35, noise: 0.3, bright: 0.9, reso: 140, turbo: 0.4, crackle: 0.2, vol: 1 }),
  ev: p({ electric: true, ppr: 1, idle: 0, redline: 0, odd: 0, roll: 2.2, sub: 0.2, grit: 0.05, noise: 0.2, bright: 1.6, reso: 600, whine: 0.9, crackle: 0, vol: 0.8 }),
  luxury: p({ ppr: 6, idle: 650, redline: 6200, odd: 0.05, roll: 1.4, sub: 0.5, grit: 0.15, noise: 0.15, bright: 0.9, reso: 150, turbo: 0.4, crackle: 0.1, vol: 0.9 }),
  formula: p({ ppr: 5, idle: 3500, redline: 15000, odd: 0.15, roll: 0.95, sub: 0.2, grit: 0.45, noise: 0.35, bright: 1.7, reso: 420, crackle: 0.6, vol: 1.15 }),
  offroad: p({ ppr: 2, idle: 950, redline: 5800, odd: 0.4, roll: 1.0, lump: 0.5, lumpRatio: 0.5, sub: 0.2, grit: 0.55, noise: 0.45, clatter: 0.3, bright: 1.2, reso: 210, crackle: 0.45, vol: 1.05 }),
  // Big six-cylinder diesel school bus: slow, clattery, air-brake hiss on the turbo.
  bus: p({ ppr: 3, idle: 600, redline: 3200, odd: 0.35, roll: 1.45, sub: 0.55, grit: 0.3, noise: 0.4, clatter: 0.7, bright: 0.65, reso: 105, turbo: 0.45, vol: 1.1 }),
  // Turbo-diesel V8 off-roader.
  tusker: p({ ppr: 4, idle: 700, redline: 4600, odd: 0.25, roll: 1.4, lump: 0.3, lumpRatio: 0.25, sub: 0.6, grit: 0.45, noise: 0.4, clatter: 0.45, bright: 0.8, reso: 115, turbo: 0.6, vol: 1.15 }),
  // Wheezy old van four.
  dogvan: p({ ppr: 2, idle: 750, redline: 4400, odd: 0.45, roll: 1.2, lump: 0.4, lumpRatio: 0.5, sub: 0.15, grit: 0.3, noise: 0.35, clatter: 0.4, bright: 0.8, reso: 165, vol: 0.85 }),
  // Oddballs. Ice cream van: a soft, puttering old four.
  icecream: p({ ppr: 2, idle: 780, redline: 4300, odd: 0.45, roll: 1.2, lump: 0.35, lumpRatio: 0.5, sub: 0.15, grit: 0.25, noise: 0.3, clatter: 0.35, bright: 0.85, reso: 175, vol: 0.85 }),
  // Monster truck: a huge, lumpy big-block V8 with a blower whine.
  monster: p({ ppr: 4, idle: 650, redline: 5200, odd: 0.18, roll: 1.5, lump: 0.75, lumpRatio: 0.25, sub: 0.85, grit: 0.6, noise: 0.4, bright: 0.8, reso: 110, whine: 0.7, crackle: 0.6, vol: 1.3 }),
  // Parcel van: a clattery four-cylinder diesel.
  parcel: p({ ppr: 2, idle: 700, redline: 4000, odd: 0.4, roll: 1.25, lump: 0.25, lumpRatio: 0.5, sub: 0.3, grit: 0.3, noise: 0.35, clatter: 0.65, bright: 0.7, reso: 140, turbo: 0.35, vol: 0.95 }),
  // Air-cooled flat-six hung out the back: a hard, metallic howl to a high redline.
  rearengine: p({ ppr: 3, idle: 950, redline: 8600, odd: 0.32, roll: 1.05, lump: 0.2, lumpRatio: 0.5, sub: 0.2, grit: 0.4, noise: 0.35, clatter: 0.15, bright: 1.35, reso: 235, crackle: 0.5, vol: 1.05 }),
  // Big lazy V10 in a long nose: lumpy, truck-like bark at low revs.
  longnose: p({ ppr: 5, idle: 800, redline: 6200, odd: 0.35, roll: 1.3, lump: 0.3, lumpRatio: 0.2, sub: 0.55, grit: 0.55, noise: 0.35, bright: 0.95, reso: 150, crackle: 0.55, vol: 1.2 }),
  // Four-rotor endurance prototype: a shrieking, buzzing wail.
  prototype: p({ ppr: 2, idle: 1800, redline: 9500, odd: 0.55, roll: 0.95, lump: 0.15, lumpRatio: 0.5, sub: 0.15, grit: 0.5, noise: 0.35, bright: 1.6, reso: 320, crackle: 0.8, vol: 1.2 }),
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
  // Rotary drift car: buzzy, high-revving brap.
  kitsune: { ppr: 2, redline: 9000, odd: 0.55, lump: 0.2, lumpRatio: 0.5, turbo: 0.6, crackle: 0.8, grit: 0.5, reso: 260 },
  // Trophy truck: big open V8.
  stomper: { ppr: 4, idle: 750, redline: 6000, lump: 0.5, lumpRatio: 0.25, clatter: 0, turbo: 0, grit: 0.6, noise: 0.45, crackle: 0.5, bright: 1, vol: 1.2 },
  // Air-cooled flat-four with a rasp.
  speedster: { odd: 0.35, lump: 0.35, lumpRatio: 0.5, redline: 6200, clatter: 0.2, crackle: 0.35 },
  // V12 hybrid hypercar: screaming and silky, with an electric whine on top.
  zenith: { ppr: 6, redline: 9500, lump: 0, odd: 0.08, turbo: 0, whine: 0.5, bright: 1.55, crackle: 0.8, reso: 260 },
  // High-revving four-cylinder touring car.
  kreis: { redline: 8200, odd: 0.3, grit: 0.35, crackle: 0.45, bright: 1.25 },
  // Supercharged V8 with the blower whine over the burble.
  rattler: { whine: 0.7, lump: 0.4, crackle: 0.55 },
  // Naturally aspirated V10 behind the seats.
  ringmeister: { ppr: 5, turbo: 0, redline: 8700, lump: 0.05, odd: 0.25, bright: 1.45, crackle: 0.7 },
  // Sixteen cylinders and four turbos: a deep, smooth rush.
  sovereign: { ppr: 8, redline: 6700, turbo: 1, sub: 0.6, roll: 1.3, bright: 1.1, crackle: 0.3, vol: 1.25 },
  // Twin-turbo flat-plane V8 that cracks on every lift.
  wraith: { ppr: 4, redline: 8500, turbo: 0.9, crackle: 0.9, lump: 0.1, reso: 220 },
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
const drive = (amt: number) => curve(`drive${amt.toFixed(2)}`, (x) => Math.tanh(x * (1 + amt * 2.2)) / Math.tanh(1 + amt * 2.2))

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

// A hawk's "kee-eeeer": a raspy cry that jumps up, then slides down and fades.
// Synthesized (no recording): a buzzy tone with fast flutter, breath noise and an echo.
export function eagleScreech(a: AudioContext, out: AudioNode, at = a.currentTime) {
  const cry = (t0: number, dur: number, peak: number, vol: number) => {
    const o = a.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(peak * 0.7, t0)
    o.frequency.exponentialRampToValueAtTime(peak, t0 + 0.08)
    o.frequency.setValueAtTime(peak, t0 + 0.2)
    o.frequency.exponentialRampToValueAtTime(peak * 0.62, t0 + dur)
    // Wobble in pitch, like a real bird's syrinx.
    const vib = a.createOscillator()
    vib.frequency.value = 23
    const vd = a.createGain()
    vd.gain.value = peak * 0.025
    vib.connect(vd).connect(o.frequency)
    // Rasp: fast amplitude flutter.
    const flut = a.createOscillator()
    flut.type = 'square'
    flut.frequency.value = 90
    const fd = a.createGain()
    fd.gain.value = 0.35
    const am = a.createGain()
    am.gain.value = 0.65
    flut.connect(fd).connect(am.gain)
    const bp = a.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(peak * 1.1, t0)
    bp.frequency.exponentialRampToValueAtTime(peak * 0.75, t0 + dur)
    bp.Q.value = 2.5
    const env = a.createGain()
    env.gain.setValueAtTime(0.0001, t0)
    env.gain.exponentialRampToValueAtTime(vol, t0 + 0.05)
    env.gain.setValueAtTime(vol, t0 + dur * 0.45)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(am).connect(bp).connect(env).connect(out)
    for (const x of [o, vib, flut]) {
      x.start(t0)
      x.stop(t0 + dur + 0.05)
    }
    burst(a, out, t0, dur * 0.9, vol * 0.5, 'bandpass', peak * 1.3, peak * 0.9, 3)
  }
  cry(at, 1.9, 2900, 0.7)
  // The echo off the canyon walls.
  cry(at + 0.35, 1.6, 2850, 0.16)
}

// How a profile's cylinders fire: uneven gaps and strengths give V8 burble and V-twin
// potato-potato; pricier engines fire more evenly and ring a longer exhaust.
function pulseConfig(prof: EngineProfile, q: number): PulseConfig {
  const group = prof.lump > 0.05 ? Math.max(2, Math.round(1 / prof.lumpRatio)) : 4
  const intervals: number[] = []
  const weights: number[] = []
  for (let i = 0; i < group; i++) {
    const swing = group % 2 === 0 ? (i % 2 === 0 ? -1 : 1) : i === 0 ? -2 : 1
    intervals.push(1 + prof.lump * 0.16 * swing)
    const r = Math.abs(Math.sin((i + 1) * 12.9898) * 43758.5453) % 1
    weights.push(1 - (0.05 + prof.lump * 0.35) * r)
  }
  return {
    intervals,
    weights,
    jitter: 0.05 + (1 - q) * 0.08 + prof.grit * 0.06,
    width: Math.min(0.5, Math.max(0.16, 0.44 - prof.bright * 0.1 - prof.clatter * 0.1)),
    // Enough combustion grit to sound mechanical; much more turns into static through the drive stage.
    rough: (0.12 + prof.grit * 0.3 + (1 - q) * 0.12) * 0.6,
    pipe: Math.min(0.025, 1 / Math.max(40, prof.reso)),
    feedback: 0.22 + q * 0.14,
  }
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
  private pulse: AudioWorkletNode | null = null
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
  private gear = 0
  // How hard top gear is pulling, 0-1, smoothed.
  private strain = 0
  private topSince = -1
  private lastShift = -1
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
    prof.crackle *= 0.4 + 0.8 * q
    prof.turbo *= 0.6 + 0.4 * q
    prof.vol *= 0.8 + 0.3 * q
    this.prof = prof
    this.level = opts.level ?? 1

    this.out = a.createGain()
    this.out.gain.value = 0.0001
    this.pan = a.createStereoPanner()
    this.pan.pan.value = opts.pan ?? 0
    const smooth = a.createBiquadFilter()
    smooth.type = 'lowpass'
    smooth.frequency.value = 5200
    smooth.Q.value = 0.5
    this.out.connect(smooth).connect(this.pan).connect(dest)

    // Engine tone: harmonic pulse wave at the firing rate.
    const n = Math.round(8 + q * 10)
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

    // Real combustion pulses when the audio thread can run them (electric motors keep
    // their tonal whine). Otherwise a tone with a lope wobble stands in.
    if (!prof.electric && engineWorkletReady(a)) {
      try {
        this.pulse = new AudioWorkletNode(a, 'engine-pulse', { numberOfInputs: 0, outputChannelCount: [1], processorOptions: pulseConfig(prof, q) })
      } catch {
        this.pulse = null
      }
    }
    const am = a.createGain()
    const lopeDepth = a.createGain()
    if (this.pulse) {
      am.gain.value = 1
      lopeDepth.gain.value = 0
      this.pulse.connect(am)
    } else {
      // Lope: amplitude wobble at a fraction of the firing rate (cross-plane V8, V-twin, boxer).
      am.gain.value = 1 - prof.lump * 0.45
      lopeDepth.gain.value = prof.lump * 0.45
      mix.connect(am)
    }
    this.lope.connect(lopeDepth).connect(am.gain)

    const shaper = a.createWaveShaper()
    shaper.curve = drive(prof.grit)
    shaper.oversample = q > 0.5 ? '4x' : '2x'
    const hp = a.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 160 - 130 * q
    this.lp = a.createBiquadFilter()
    this.lp.type = 'lowpass'
    this.lp.Q.value = 0.7 + q * 0.5
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
    thp.type = 'bandpass'
    thp.frequency.value = 1600
    thp.Q.value = 1.2
    this.tickGain = a.createGain()
    this.tickGain.gain.value = 0
    const tshape = a.createWaveShaper()
    tshape.curve = spike()
    const tdepth = a.createGain()
    tdepth.gain.value = prof.clatter * 0.3
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
  drive(rpm: number, gear = 0, throttle = 1) {
    this.mode = 'race'
    // An electric motor has no gears to hear: its whine follows road speed instead.
    this.target = this.prof.electric ? Math.min(1, (gear + Math.min(1, rpm)) / 3.95) : rpm
    this.throttle = throttle
    this.gear = gear
  }

  // Pre-race: blip the throttle (each countdown beat).
  rev(amount = 0.6) {
    this.revUntil = this.a.currentTime + 0.22
    this.target = amount
  }

  // Gear change, as it happens in a real car: the driver lifts (the note goes
  // dull, a turbo vents, a hot exhaust pops), the clutch goes in and the revs
  // fall freely, then the clutch bites at the new gear's revs with a soft
  // driveline clunk and the engine pulls again. A cheap manual takes its time;
  // an expensive car's paddle box is done in a blink. `soft` is the rival's car.
  shift(soft = 1) {
    if (this.prof.electric) return
    const a = this.a
    const t = a.currentTime
    // A double call (a stray repeat) is not a second gear change.
    if (t - this.lastShift < 0.3) return
    this.lastShift = t
    const cut = this.shiftTime()
    this.cutUntil = t + cut
    const vary = 0.9 + Math.random() * 0.2
    const manual = this.q < 0.6
    // The lever (or the paddle box's selector) moving: a small mechanical tick.
    burst(a, this.out, t + 0.01, 0.025, (manual ? 0.02 : 0.012) * soft, 'bandpass', 2600 * vary, 2000, 4)
    // The clutch biting: a low driveline thud with a little metal in it.
    blip(a, this.out, t + cut, 62 * vary, 0.07, (manual ? 0.11 : 0.07) * this.prof.vol * soft, 'sine', 40 * vary)
    burst(a, this.out, t + cut, 0.035, 0.018 * soft, 'bandpass', 1100 * vary, 700, 2)
    if (this.prof.turbo > 0.3 && this.boost > 0.3) {
      // Blow-off as the throttle shuts.
      burst(a, this.out, t + 0.015, 0.2 + cut * 0.5, 0.05 * this.prof.turbo * soft, 'bandpass', 3400 * vary, 1100, 1.2)
      // Flutter on the cheaper tuned cars, a clean psssh on the expensive ones.
      if (this.q < 0.7) for (let i = 0; i < 3; i++) burst(a, this.out, t + 0.03 + i * 0.045, 0.03, 0.025 * this.prof.turbo * soft, 'bandpass', 2400, 1800, 3)
      this.boost *= 0.3
    }
    // Unburnt fuel popping in the exhaust while the throttle is shut.
    if (soft >= 1) this.pops(t + 0.02, cut, Math.floor(this.prof.crackle * 2.5))
  }

  // How long the throttle is off for a shift, in seconds.
  private shiftTime() {
    const slow = this.prof.clatter > 0.4 ? 0.1 : 0 // trucks and old diesels
    return 0.06 + (1 - this.q) * 0.16 + slow
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
    setTimeout(() => {
      this.pan.disconnect()
      this.pulse?.port.postMessage('stop')
      this.pulse?.disconnect()
    }, (fade + 0.3) * 1000)
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
    if (this.mode === 'race' && t < this.cutUntil && this.target < this.rpm) {
      // Clutch in mid-shift: the revs fall at the flywheel's pace, and catch the
      // new gear when it bites. Light, pricey engines spin down faster.
      this.rpm = Math.max(this.target, this.rpm - (1.6 + this.q * 1.4) * 0.025)
    } else this.rpm += (this.target - this.rpm) * k
    this.apply(false)
  }

  private apply(now: boolean) {
    const a = this.a
    const t = a.currentTime
    const prof = this.prof
    // Top gear is tall: it drops the revs well below the redline and they climb
    // slowly the whole way down a long straight, so the car always sounds like
    // it's straining for more speed instead of droning flat at the limiter.
    const top = this.mode === 'race' && !prof.electric && this.gear >= TOP_GEAR
    // How far into top gear's pull the car is (0 just shifted, 1 flat out).
    const strain = top ? Math.min(1, Math.max(0, (this.rpm - 0.8) / 0.2)) : 0
    this.strain += (strain - this.strain) * (now ? 1 : 0.1)
    // Even once the speed has topped out, the note keeps creeping up for a while.
    if (!top) this.topSince = -1
    else if (this.topSince < 0) this.topSince = t
    const creep = top ? 1 - Math.exp(-(t - this.topSince) / 10) : 0
    const r = top ? 0.64 + 0.22 * Math.sqrt(this.strain) + 0.1 * creep : Math.min(1.05, Math.max(0, this.rpm))
    let thr = this.throttle
    if (t < this.cutUntil) thr = 0
    // A lower gear left too long bounces off the limiter, a stutter about 9 times a second.
    if (this.mode === 'race' && !prof.electric && !top && this.rpm >= 0.995 && Math.floor(t * 18) % 2 === 0) thr = Math.min(thr, 0.35)
    const realRpm = prof.electric ? 600 + 14000 * r : prof.idle + (prof.redline - prof.idle) * r
    // Tiny unsteadiness at idle so it never sounds like a test tone.
    const wob = r < 0.1 && !prof.electric ? 1 + Math.sin(t * 7.3) * 0.012 + Math.sin(t * 2.1) * 0.01 : 1
    const fire = prof.electric ? 60 + 900 * r : (realRpm / 60) * prof.ppr * wob
    const tc = now ? 0 : 0.02
    const set = (pp: AudioParam, v: number) => (now ? pp.setValueAtTime(v, t) : pp.setTargetAtTime(v, t, tc))
    if (this.pulse) {
      set(this.pulse.parameters.get('freq')!, fire)
      set(this.pulse.parameters.get('throttle')!, thr)
    }
    set(this.main.frequency, fire)
    if (this.layer) set(this.layer.frequency, fire)
    set(this.sub.frequency, fire / 2)
    set(this.lope.frequency, fire * prof.lumpRatio)
    set(this.tick.frequency, fire)
    const load = 0.3 + 0.7 * thr
    set(this.lp.frequency, Math.min(3600, (200 + fire * (2 + 2.5 * thr) + r * 1400 * thr) * prof.bright))
    set(this.engGain.gain, (0.32 + 0.4 * r) * load)
    set(this.nf.frequency, Math.min(1800, 200 + fire * 2))
    // Hard-worked top gear: less hiss and rasp, more tone, so the strain reads as a rising howl.
    set(this.noiseGain.gain, prof.noise * (0.012 + 0.055 * r * thr) * (top ? 0.5 : 1))
    set(this.tickGain.gain, prof.clatter * (0.02 + 0.03 * (1 - r)) * (0.5 + 0.5 * load))
    // Boost builds with revs under load and bleeds off when lifting.
    this.boost += ((thr > 0.5 ? (top ? 0.75 + 0.25 * this.strain : r) : 0) - this.boost) * (thr > 0.5 ? 0.08 : 0.3)
    set(this.whistle.frequency, 1800 + this.boost * 5200)
    set(this.whistleGain.gain, prof.turbo * this.boost * this.boost * 0.035)
    set(this.whineOsc.frequency, (realRpm / 60) * 9)
    // Gearbox whine rises with road speed in top gear, on every car.
    set(this.whineGain.gain, prof.whine * (0.008 + 0.04 * r * load) + (top ? 0.014 * this.strain * load : 0))
    // And it swells a little as it digs in.
    if (!now && this.mode !== 'idle') set(this.out.gain, prof.vol * this.level * (1 + 0.25 * this.strain))
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
    for (const [f, rate] of [[420, 3.1], [750, 4.3], [1200, 5.7]]) {
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
    this.out.gain.setTargetAtTime(0.006, a.currentTime, 0.5)
  }

  // The cars cross the line: the crowd erupts; louder with whistles when you win.
  cheer(won: boolean) {
    if (this.dead) return
    const a = this.a
    const t = a.currentTime
    const peak = won ? 0.2 : 0.09
    this.out.gain.cancelScheduledValues(t)
    this.out.gain.setTargetAtTime(peak, t, 0.12)
    this.out.gain.setTargetAtTime(0.012, t + 1.6, 0.9)
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
  private trim: AudioNode | null = null
  private loading: Promise<void> | null = null
  private loaded = false

  private mine: { model: string; mods?: string[] }
  private theirs: { model?: string; body: Body; mods?: string[] }

  constructor(mine: { model: string; mods?: string[] }, theirs: { model?: string; body: Body; mods?: string[] }) {
    this.mine = mine
    this.theirs = theirs
    this.offMute = onMuteChange(() => {
      if (isMuted()) this.silence()
    })
    this.warm()
  }

  // Start loading the pulse engine as the race screen opens, so it's ready for the countdown.
  private warm() {
    const a = audioContext()
    if (!a || this.loading) return
    this.loading = loadEngineWorklet(a).then(() => {
      this.loaded = true
    })
  }

  private ensure() {
    if (this.closed || this.me || isMuted()) return !!this.me
    const a = audioContext()
    const dest = sfxOut()
    if (!a || !dest) return false
    this.warm()
    if (!this.loaded) return false
    // A limiter keeps two roaring engines and a crowd from clipping on phone speakers.
    const out = a.createDynamicsCompressor()
    out.threshold.value = -20
    out.knee.value = 6
    out.ratio.value = 12
    // Slow enough not to ride each firing pulse: at low revs (right after a shift)
    // a 4 ms attack squeezed every pulse and made the engine sound scratchy.
    out.attack.value = 0.015
    out.release.value = 0.25
    // Races sit a little above the town ambience, not at full blast on headphones.
    const trim = a.createGain()
    trim.gain.value = 0.31
    out.connect(trim).connect(dest)
    this.bus = out
    this.trim = trim
    // Your car sits in the left lane on screen, the rival on the right.
    // The engines come in a little under the limiter, so it only catches peaks
    // instead of compressing them hard all race long (which distorted them).
    const engines = a.createGain()
    engines.gain.value = 0.4
    engines.connect(out)
    this.me = new EngineVoice(a, engines, { model: this.mine.model, mods: this.mine.mods, pan: -0.2 })
    this.them = new EngineVoice(a, engines, { model: this.theirs.model, body: this.theirs.body, mods: this.theirs.mods, pan: 0.6, level: 0.5 })
    this.crowd = new Crowd(a, out)
    return true
  }

  // The Tomahawk announces itself at the start of every race, for both players.
  screech() {
    if (!this.ensure() || !this.bus) return
    if (this.mine.model === 'tomahawk' || this.theirs.model === 'tomahawk') eagleScreech(this.bus.context as AudioContext, this.bus)
  }

  countdown(go: boolean) {
    if (!this.ensure()) return
    if (!go) {
      // Your own engine revs with the pedal (see rev()).
      setTimeout(() => this.them?.rev(0.4 + Math.random() * 0.3), 120 + Math.random() * 200)
    }
  }

  // Your engine on the line, revving with the pedal.
  rev(rpm: number) {
    if (!this.ensure()) return
    this.me!.drive(rpm, 0, rpm > 0.3 ? 1 : 0.2)
  }

  launch(myPower: number, theirPower: number) {
    if (!this.ensure()) return
    this.me!.launch(myPower)
    this.them!.launch(theirPower * 0.6)
  }

  // Each frame of the race.
  frame(me: { rpm: number; gear: number; finished: number | null; dist: number }, them: { rpm: number; gear: number; finished: number | null; dist: number }) {
    if (!this.ensure()) return
    if (me.finished === null) this.me!.drive(me.rpm, me.gear)
    else if (!this.finished.me) {
      this.finished.me = true
      this.me!.coast()
    }
    if (them.finished === null) this.them!.drive(them.rpm, them.gear)
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
    // The rival's shifts sit well back: you hear your own car's.
    v.shift(who === 'me' ? 1 : 0.45)
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
    const tr = this.trim
    this.bus = this.trim = null
    if (b) setTimeout(() => {
      b.disconnect()
      tr?.disconnect()
    }, after * 1000 + 300)
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
