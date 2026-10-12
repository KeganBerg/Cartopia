// Synthesized arcade sounds: a crash thump, a bumper tap and a short two-tone siren.
import { glock, marimba, shaker, woodblock } from './instruments'
import { audioContext, audioOut, knock } from './sound'

// The shared context, master output and a start time, or null while muted.
function dest() {
  const ctx = audioContext()
  const out = audioOut()
  return ctx && out ? { ctx, out, t: ctx.currentTime + 0.005 } : null
}

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
  // The panel's knock, which phone speakers can actually play.
  knock({ ctx, out }, t, 380, vol * 0.9)
}

// A crash: the thump, then bits of trim and glass skittering away.
export function crashSound() {
  thump(0.2, 900, 0.5)
  const d = dest()
  if (!d) return
  for (let i = 0; i < 5; i++) shaker(d, d.t + 0.04 + i * (0.04 + Math.random() * 0.05), 0.05 / (1 + i * 0.4), 0.05, 3200 + Math.random() * 2500)
}
export const bumpSound = () => thump(0.16, 600, 0.22)

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

// Impact wrench: a fast metal rattle of hammer blows that winds down.
export function wrenchSound() {
  const d = dest()
  if (!d) return
  let at = 0
  for (let i = 0; at < 0.38; i++) {
    const k = at / 0.38
    shaker(d, d.t + at, 0.07 * (1 - k * 0.6), 0.018, 2600 - k * 900)
    if (i % 3 === 0) woodblock(d, d.t + at, 620 - k * 200, 0.03 * (1 - k))
    at += 0.022 + k * 0.03
  }
  knock(d, d.t, 420, 0.06)
}

// A soft wooden "bonk-bonk" for a wrong tap, not a buzzer.
export function buzzSound() {
  const d = dest()
  if (!d) return
  marimba(d, d.t, 330, 0.09, 0.2)
  marimba(d, d.t + 0.1, 262, 0.09, 0.28)
  woodblock(d, d.t, 700, 0.04)
}

// A bright two-note bell: a drop delivered, a spot cleaned, a clean landing.
export function dingSound(pitch = 1) {
  const d = dest()
  if (!d) return
  glock(d, d.t, 880 * pitch, 0.07, 0.6)
  glock(d, d.t + 0.08, 1320 * pitch, 0.08, 1)
}

export const scrubSound = () => hiss(0.3, 'bandpass', 1500 + Math.random() * 900, 0.16, 1.5)
export const splashSound = () => hiss(0.22, 'bandpass', 1800, 0.5, 0.6)
export const fuelSound = () => hiss(0.25, 'bandpass', 900, 0.25, 0.8)
export const landSound = () => thump(0.17, 700, 0.4)
// Engine roar for a launch or take-off: a revving engine (two slightly detuned
// voices that throb with the firing, its tone opening up as it climbs) over a rush of air.
export function revSound(secs = 0.8) {
  const d = dest()
  if (!d) return
  const { ctx, out, t } = d
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 2
  lp.frequency.setValueAtTime(600, t)
  lp.frequency.exponentialRampToValueAtTime(2200, t + secs * 0.8)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.15, t + 0.08)
  g.gain.setValueAtTime(0.15, t + secs * 0.6)
  g.gain.exponentialRampToValueAtTime(0.0001, t + secs)
  // The throb of the cylinders firing, a little behind the pitch.
  const am = ctx.createGain()
  am.gain.value = 0.7
  const lfo = ctx.createOscillator()
  const depth = ctx.createGain()
  depth.gain.value = 0.3
  lfo.frequency.setValueAtTime(18, t)
  lfo.frequency.exponentialRampToValueAtTime(48, t + secs)
  lfo.connect(depth).connect(am.gain)
  am.connect(lp).connect(g).connect(out)
  for (const [type, cents, v] of [['sawtooth', -8, 0.5], ['sawtooth', 8, 0.5], ['sine', -1200, 0.4]] as const) {
    const o = ctx.createOscillator()
    const og = ctx.createGain()
    o.type = type
    o.detune.value = cents
    o.frequency.setValueAtTime(90, t)
    o.frequency.exponentialRampToValueAtTime(260, t + secs * 0.85)
    og.gain.value = v
    o.connect(og).connect(am)
    o.start(t)
    o.stop(t + secs + 0.05)
  }
  lfo.start(t)
  lfo.stop(t + secs + 0.05)
  hiss(0.07, 'bandpass', 1400, secs, 0.7)
}
