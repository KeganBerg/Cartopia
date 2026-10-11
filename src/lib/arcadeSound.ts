// Synthesized arcade sounds: a crash thump, a bumper tap and a short two-tone siren.
import { audioContext, audioOut } from './sound'

function noise(ctx: BaseAudioContext, secs: number) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * secs), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2
  const src = ctx.createBufferSource()
  src.buffer = buf
  return src
}

function thump(vol: number, cutoff: number, secs: number) {
  const ctx = audioContext()
  const out = audioOut()
  if (!ctx || !out) return
  const t = ctx.currentTime + 0.005
  const n = noise(ctx, secs)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = cutoff
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + secs)
  n.connect(lp).connect(g).connect(out)
  n.start(t)
  // A low body knock under the noise.
  const o = ctx.createOscillator()
  const og = ctx.createGain()
  o.frequency.setValueAtTime(140, t)
  o.frequency.exponentialRampToValueAtTime(45, t + secs * 0.8)
  og.gain.setValueAtTime(vol * 0.8, t)
  og.gain.exponentialRampToValueAtTime(0.0001, t + secs * 0.8)
  o.connect(og).connect(out)
  o.start(t)
  o.stop(t + secs)
}

export const crashSound = () => thump(0.35, 900, 0.5)
export const bumpSound = () => thump(0.18, 600, 0.22)

// Wee-woo: a soft sine siren, quiet enough to sit under the music.
export function sirenSound(cycles = 2) {
  const ctx = audioContext()
  const out = audioOut()
  if (!ctx || !out) return
  const t = ctx.currentTime + 0.005
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'triangle'
  for (let i = 0; i < cycles * 2; i++) o.frequency.setValueAtTime(i % 2 ? 620 : 820, t + i * 0.32)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.045, t + 0.05)
  g.gain.setValueAtTime(0.045, t + cycles * 0.64 - 0.1)
  g.gain.linearRampToValueAtTime(0, t + cycles * 0.64)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + cycles * 0.64 + 0.05)
}

// A short filtered noise burst: the base of a wrench rattle, a spray hiss or a scrub.
function hiss(vol: number, type: BiquadFilterType, freq: number, secs: number, q = 1) {
  const ctx = audioContext()
  const out = audioOut()
  if (!ctx || !out) return
  const t = ctx.currentTime + 0.005
  const n = noise(ctx, secs)
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + secs)
  n.connect(f).connect(g).connect(out)
  n.start(t)
}

// Impact wrench: a fast buzzing rattle that winds down.
export function wrenchSound() {
  const ctx = audioContext()
  const out = audioOut()
  if (!ctx || !out) return
  const t = ctx.currentTime + 0.005
  const o = ctx.createOscillator()
  const lfo = ctx.createOscillator()
  const lg = ctx.createGain()
  const g = ctx.createGain()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(190, t)
  o.frequency.exponentialRampToValueAtTime(120, t + 0.35)
  lfo.frequency.value = 38
  lg.gain.value = 0.05
  g.gain.setValueAtTime(0.05, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38)
  lfo.connect(lg).connect(g.gain)
  o.connect(g).connect(out)
  o.start(t)
  lfo.start(t)
  o.stop(t + 0.4)
  lfo.stop(t + 0.4)
  hiss(0.05, 'bandpass', 2400, 0.3, 2)
}

// A soft error buzz for a wrong tap.
export function buzzSound() {
  const ctx = audioContext()
  const out = audioOut()
  if (!ctx || !out) return
  const t = ctx.currentTime + 0.005
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'square'
  o.frequency.value = 110
  g.gain.setValueAtTime(0.04, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.26)
}

// A bright two-note ding: a drop delivered, a spot cleaned, a clean landing.
export function dingSound(pitch = 1) {
  const ctx = audioContext()
  const out = audioOut()
  if (!ctx || !out) return
  const t = ctx.currentTime + 0.005
  ;[880, 1320].forEach((f, i) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = f * pitch
    g.gain.setValueAtTime(0, t + i * 0.08)
    g.gain.linearRampToValueAtTime(0.06, t + i * 0.08 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + 0.35)
    o.connect(g).connect(out)
    o.start(t + i * 0.08)
    o.stop(t + i * 0.08 + 0.4)
  })
}

export const scrubSound = () => hiss(0.035, 'bandpass', 1500 + Math.random() * 900, 0.12, 1.5)
export const splashSound = () => hiss(0.08, 'highpass', 2500, 0.5)
export const fuelSound = () => hiss(0.025, 'lowpass', 700, 0.2)
export const landSound = () => thump(0.28, 700, 0.4)
// Engine roar for a launch or take-off: a rising sawtooth under a rush of air.
export function revSound(secs = 0.8) {
  const ctx = audioContext()
  const out = audioOut()
  if (!ctx || !out) return
  const t = ctx.currentTime + 0.005
  const o = ctx.createOscillator()
  const lp = ctx.createBiquadFilter()
  const g = ctx.createGain()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(70, t)
  o.frequency.exponentialRampToValueAtTime(220, t + secs)
  lp.type = 'lowpass'
  lp.frequency.value = 900
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.08)
  g.gain.exponentialRampToValueAtTime(0.0001, t + secs)
  o.connect(lp).connect(g).connect(out)
  o.start(t)
  o.stop(t + secs + 0.05)
  hiss(0.04, 'lowpass', 1200, secs)
}
