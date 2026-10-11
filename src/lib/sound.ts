// Tiny synthesized sound effects, so the game ships no audio files.
// Everything audible shares one AudioContext and goes through one master
// output, so the Sound toggle silences it all. Other audio (the town ambience,
// race engines) gets both from audioContext() and audioOut().
import { choir, glock, hz, marimba, pluck, shaker, softKick, vibes, woodblock } from './instruments'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = (() => {
  try {
    return localStorage.getItem('cartopia-muted') === '1'
  } catch {
    return false
  }
})()

let volume = (() => {
  try {
    const v = localStorage.getItem('cartopia-volume')
    return v !== null && Number.isFinite(Number(v)) ? Math.min(1, Math.max(0, Number(v))) : 0.8
  } catch {
    return 0.8
  }
})()

const listeners = new Set<() => void>()
const hidden = () => typeof document !== 'undefined' && document.hidden

function audio() {
  if (muted) return null
  if (!ctx) {
    try {
      ctx = new AudioContext()
      master = ctx.createGain()
      master.gain.value = volume
      master.connect(ctx.destination)
    } catch {
      return null
    }
  }
  // 'interrupted' (iOS after a call or Siri) needs a resume too, not just 'suspended';
  // a hidden tab stays paused until it's shown again.
  if (ctx.state !== 'running' && !hidden()) ctx.resume().catch(() => {})
  return ctx
}

// Mute and hidden tabs act on the master output at once, so nothing already
// playing (a race engine whose frames stopped, a dyno pull, a sound effect)
// keeps going: a hidden tab fades out and then pauses the whole context.
let pausing: ReturnType<typeof setTimeout> | null = null
function gate() {
  if (!ctx || !master) return
  const quiet = muted || hidden()
  master.gain.setTargetAtTime(quiet ? 0 : volume, ctx.currentTime, 0.03)
  if (pausing) clearTimeout(pausing)
  pausing = null
  if (hidden()) pausing = setTimeout(() => hidden() && ctx?.suspend().catch(() => {}), 200)
  else if (!muted && ctx.state !== 'running') ctx.resume().catch(() => {})
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', gate)

// The shared context and master output for other synthesised audio; null while muted.
export const audioContext = () => audio()
export const audioOut = (): AudioNode | null => (audio() ? master : null)

// iPhone: audio may only start inside a tap, and the ring/silent switch mutes
// web audio unless the page asks for media playback.
if (typeof window !== 'undefined') {
  try {
    const s = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
    if (s) s.type = 'playback'
  } catch {
    /* not supported */
  }
  const events = ['pointerdown', 'touchend', 'keydown']
  // Kept for the whole session: iOS pauses audio again after a call, Siri or
  // the app going to the background, and only a tap brings it back.
  const unlock = () => {
    if (ctx?.state === 'running') return
    const a = audio()
    if (!a) return
    // A silent blip inside the gesture is what actually unlocks iOS.
    const src = a.createBufferSource()
    src.buffer = a.createBuffer(1, 1, 22050)
    src.connect(a.destination)
    src.start()
  }
  events.forEach((e) => window.addEventListener(e, unlock, true))
}

export const isMuted = () => muted
export function setMuted(m: boolean) {
  muted = m
  try {
    localStorage.setItem('cartopia-muted', m ? '1' : '0')
  } catch {
    /* storage unavailable */
  }
  if (m) stopEngine()
  gate()
  listeners.forEach((l) => l())
}
export const getVolume = () => volume
export function setVolume(v: number) {
  volume = Math.min(1, Math.max(0, v))
  try {
    localStorage.setItem('cartopia-volume', String(volume))
  } catch {
    /* storage unavailable */
  }
  if (ctx && master && !muted && !hidden()) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05)
  listeners.forEach((l) => l())
}
export function onMuteChange(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

// Each effect is played on a little instrument (see instruments.ts) rather than a raw beep.
function play(f: (d: { ctx: BaseAudioContext; out: AudioNode }, t: number) => void, delay = 0) {
  const a = audio()
  if (!a || !master) return
  f({ ctx: a, out: master }, a.currentTime + 0.005 + delay)
}

// A soft car horn: two filtered reed-like tones, not square-wave beeps.
function horn(d: { ctx: BaseAudioContext; out: AudioNode }, t: number) {
  const lp = d.ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1400
  lp.connect(d.out)
  for (const f of [392, 494]) {
    const o = d.ctx.createOscillator()
    const g = d.ctx.createGain()
    o.type = 'sawtooth'
    o.frequency.value = f
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.03, t + 0.02)
    g.gain.setValueAtTime(0.03, t + 0.3)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    o.connect(g).connect(lp)
    o.start(t)
    o.stop(t + 0.45)
  }
}

const arp = (notes: string[], gap: number, inst: typeof marimba, vol: number) => (d: { ctx: BaseAudioContext; out: AudioNode }, t: number) =>
  notes.forEach((n, i) => inst(d, t + i * gap, hz(n), vol))

export const sfx = {
  click: () => play((d, t) => woodblock(d, t, 1300, 0.09)),
  coin: () => play((d, t) => {
    glock(d, t, hz('B5'), 0.06, 0.5)
    glock(d, t + 0.07, hz('E6'), 0.07, 0.9)
  }),
  start: () => play(arp(['G4', 'D5'], 0.08, marimba, 0.12)),
  error: () => play((d, t) => {
    marimba(d, t, hz('E3'), 0.14, 0.35)
    marimba(d, t + 0.12, hz('C3'), 0.14, 0.45)
  }),
  levelUp: () => play((d, t) => {
    arp(['C4', 'E4', 'G4', 'C5', 'E5', 'G5'], 0.07, pluck, 0.13)(d, t)
    glock(d, t + 0.42, hz('C6'), 0.07, 1.4)
  }),
  buy: () => play((d, t) => {
    arp(['G4', 'B4', 'D5'], 0.06, marimba, 0.11)(d, t)
    glock(d, t + 0.18, hz('G5'), 0.05, 0.8)
  }),
  horn: () => play(horn),
  // A soft chime on a clean shift; the race engine plays the gear change itself.
  shift: (good: boolean) => {
    if (good) play((d, t) => glock(d, t, hz('G6'), 0.03, 0.4))
  },
  win: () => play((d, t) => {
    arp(['C4', 'E4', 'G4', 'C5'], 0.11, marimba, 0.13)(d, t)
    arp(['E5', 'G5', 'C6'], 0.09, glock, 0.06)(d, t + 0.44)
    pluck(d, t + 0.44, hz('C3'), 0.12)
  }),
  lose: () => play(arp(['A3', 'F3', 'D3'], 0.2, pluck, 0.3)),
  // A flying car's engine catching then cutting: a soft thump with a puff of exhaust.
  putt: () => play((d, t) => {
    softKick(d, t, 0.16)
    shaker(d, t + 0.01, 0.03, 0.12, 900)
  }),
  // Hover jets lighting up: a low rush of air that swells and fades.
  jet: () => play((d, t) => {
    const len = 1.4
    const buf = d.ctx.createBuffer(1, Math.floor(d.ctx.sampleRate * len), d.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = d.ctx.createBufferSource()
    src.buffer = buf
    const lp = d.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(300, t)
    lp.frequency.exponentialRampToValueAtTime(1400, t + 0.5)
    lp.frequency.exponentialRampToValueAtTime(500, t + len)
    const g = d.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.25)
    g.gain.exponentialRampToValueAtTime(0.0001, t + len)
    src.connect(lp).connect(g).connect(d.out)
    src.start(t)
    src.stop(t + len)
  }),
  // Boost: a rising rush of filtered noise.
  boost: () => play((d, t) => {
    const len = 0.7
    const buf = d.ctx.createBuffer(1, Math.floor(d.ctx.sampleRate * len), d.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = d.ctx.createBufferSource()
    src.buffer = buf
    const bp = d.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.2
    bp.frequency.setValueAtTime(400, t)
    bp.frequency.exponentialRampToValueAtTime(2600, t + len)
    const g = d.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.08)
    g.gain.exponentialRampToValueAtTime(0.0001, t + len)
    src.connect(bp).connect(g).connect(d.out)
    src.start(t)
    src.stop(t + len)
  }),
  countdown: (go: boolean) => play((d, t) => {
    if (!go) return woodblock(d, t, 900, 0.12)
    for (const n of ['C5', 'E5', 'G5']) glock(d, t, hz(n), 0.05, 1)
    marimba(d, t, hz('C4'), 0.12)
  }),
}

// A burst of filtered noise swept from one pitch to another: tarps, whooshes.
function whoosh(d: { ctx: BaseAudioContext; out: AudioNode }, t: number, len: number, from: number, to: number, vol: number) {
  const buf = d.ctx.createBuffer(1, Math.floor(d.ctx.sampleRate * len), d.ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = d.ctx.createBufferSource()
  src.buffer = buf
  const bp = d.ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 0.9
  bp.frequency.setValueAtTime(from, t)
  bp.frequency.exponentialRampToValueAtTime(to, t + len)
  const g = d.ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + len * 0.25)
  g.gain.exponentialRampToValueAtTime(0.0001, t + len)
  src.connect(bp).connect(g).connect(d.out)
  src.start(t)
  src.stop(t + len)
}

type Tier = 'nothing' | 'small' | 'common' | 'scarce' | 'rare'

// Rusty's Rescue: every beat of a search has its own sound, timed by the 3D scene.
export const rescueSfx = {
  // Tapping a spot: a cheery double toot from the tow truck.
  go: () => play((d, t) => {
    horn(d, t)
    woodblock(d, t, 1500, 0.06)
  }),
  // The build-up under the tarp: a drumroll that speeds up and climbs, longer
  // and higher the better the find.
  rumble: (tier: Tier, len: number) => play((d, t) => {
    const top = tier === 'rare' ? 2 : tier === 'scarce' ? 1.5 : 1.2
    let at = 0
    let n = 0
    while (at < len) {
      const k = at / len
      woodblock(d, t + at, 700 * (1 + (top - 1) * k), 0.035 + k * 0.05)
      at += 0.11 - k * 0.075
      n++
    }
    if (tier === 'rare' || tier === 'scarce') whoosh(d, t, len, 200, 900, tier === 'rare' ? 0.05 : 0.03)
  }),
  // The tarp whipped off, then a chord that says how good the find is.
  reveal: (tier: Tier) => play((d, t) => {
    whoosh(d, t, 0.35, 1800, 500, 0.12)
    const h = t + 0.12
    if (tier === 'nothing') {
      // A deflated "womp womp".
      marimba(d, h, hz('D3'), 0.13, 0.4)
      marimba(d, h + 0.22, hz('Db3'), 0.12, 0.7)
      return
    }
    softKick(d, h, tier === 'small' ? 0.08 : 0.16)
    if (tier === 'small') {
      glock(d, h, hz('B5'), 0.06, 0.5)
      glock(d, h + 0.07, hz('E6'), 0.07, 0.9)
      return
    }
    if (tier === 'common') {
      for (const n of ['C4', 'E4', 'G4']) marimba(d, h, hz(n), 0.1)
      glock(d, h + 0.1, hz('C6'), 0.05, 1)
      return
    }
    if (tier === 'scarce') {
      arp(['D4', 'F#4', 'A4', 'D5', 'F#5'], 0.06, pluck, 0.12)(d, h)
      vibes(d, h + 0.3, hz('A5'), 0.06)
      glock(d, h + 0.3, hz('D6'), 0.06, 1.4)
      return
    }
    // Rare: a big bright chord with a choir swell under it.
    arp(['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6'], 0.05, pluck, 0.13)(d, h)
    choir(d, h, [hz('C4'), hz('G4'), hz('E5')], 0.03, 2.2)
    vibes(d, h + 0.36, hz('G5'), 0.07)
    glock(d, h + 0.36, hz('C7'), 0.05, 1.8)
    softKick(d, h + 0.36, 0.12)
  }),
  // The hook bites: a metal clunk.
  clunk: () => play((d, t) => {
    woodblock(d, t, 520, 0.1)
    marimba(d, t, hz('A2'), 0.1, 0.2)
  }),
  // A find lands: a car settles onto the tow line, a small find drops in the bed.
  land: (car: boolean) => play((d, t) => {
    softKick(d, t, car ? 0.16 : 0.07)
    if (car) marimba(d, t + 0.02, hz('G2'), 0.12, 0.3)
    else woodblock(d, t, 1700, 0.05)
  }),
  // One tick of a count-up, climbing a little each step.
  tick: (n: number) => play((d, t) => glock(d, t, hz('C6') * Math.pow(2, Math.min(n, 12) / 12), 0.025, 0.25)),
  // Heading home: the horn and a short rising run.
  home: () => play((d, t) => {
    horn(d, t)
    horn(d, t + 0.5)
    arp(['G4', 'C5', 'E5'], 0.09, marimba, 0.1)(d, t + 0.2)
  }),
  // The haul card: a proper fanfare.
  fanfare: (big: boolean) => play((d, t) => {
    arp(['C4', 'E4', 'G4', 'C5'], 0.1, marimba, 0.13)(d, t)
    arp(['E5', 'G5', 'C6'], 0.08, glock, 0.06)(d, t + 0.4)
    pluck(d, t + 0.4, hz('C3'), 0.13)
    softKick(d, t + 0.4, 0.14)
    if (big) choir(d, t + 0.4, [hz('C4'), hz('G4'), hz('E5')], 0.025, 2)
  }),
}

// Race engines live in engineAudio.ts; muting silences them through this hook.
let engineStop: (() => void) | null = null
export function onStopEngine(f: () => void) {
  engineStop = f
}
export function stopEngine() {
  engineStop?.()
}
