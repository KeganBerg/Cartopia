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
