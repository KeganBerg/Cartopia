// Tiny synthesized sound effects, so the game ships no audio files.
// Everything audible shares one AudioContext and goes through one master
// output, so the Sound toggle silences it all. Other audio (the town ambience,
// race engines) gets both from audioContext() and audioOut().
import { glock, hz, marimba, pluck, woodblock } from './instruments'

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
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

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
  const unlock = () => {
    const a = audio()
    if (!a) return
    // A silent blip inside the gesture is what actually unlocks iOS.
    const src = a.createBufferSource()
    src.buffer = a.createBuffer(1, 1, 22050)
    src.connect(a.destination)
    src.start()
    if (a.state === 'running') events.forEach((e) => window.removeEventListener(e, unlock, true))
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
  if (ctx && master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05)
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

// Race engines live in engineAudio.ts; muting silences them through this hook.
let engineStop: (() => void) | null = null
export function onStopEngine(f: () => void) {
  engineStop = f
}
export function stopEngine() {
  engineStop?.()
}
