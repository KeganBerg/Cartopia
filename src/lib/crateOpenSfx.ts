// How each crate sounds as it bursts open, grander the rarer the crate: Street pops its lid,
// Garage's shutters rattle down, Gold creaks open like a chest with a ring of bells and
// Diamond shatters into a spray of glass. Built from instruments.ts and filtered noise.
import type { CrateId } from '../game/crates'
import { crashSound } from './arcadeSound'
import { glock, marimba, shaker, softKick, vibes, woodblock } from './instruments'
import { audioContext, audioOut, knock } from './sound'

type Dest = { ctx: BaseAudioContext; out: AudioNode }

function dest() {
  const ctx = audioContext()
  const out = audioOut()
  return ctx && out ? { ctx, out, t: ctx.currentTime + 0.005 } : null
}

// A burst of filtered noise: a pop of air, a hiss of shutters or the crack of glass.
function noise({ ctx, out }: Dest, t: number, vol: number, type: BiquadFilterType, freq: number, secs: number, q = 1) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * secs), ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2
  const src = ctx.createBufferSource()
  src.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + secs)
  src.connect(f).connect(g).connect(out)
  src.start(t)
}

// Street: a cork-like pop, the lid knocking off, a woody clatter.
function streetOpen() {
  const d = dest()
  if (!d) return
  noise(d, d.t, 0.22, 'bandpass', 900, 0.12, 1.4)
  woodblock(d, d.t, 520, 0.09)
  woodblock(d, d.t + 0.05, 760, 0.06)
  knock(d, d.t, 300, 0.08)
  marimba(d, d.t + 0.08, 392, 0.05, 0.3)
}

// Garage: a latch clunk, then the shutters rattle down slat by slat and thud home.
function garageOpen() {
  const d = dest()
  if (!d) return
  knock(d, d.t, 220, 0.1)
  softKick(d, d.t, 0.1)
  let at = 0.04
  for (let i = 0; i < 14; i++) {
    shaker(d, d.t + at, 0.045 * (1 - i / 20), 0.03, 4200 - i * 120)
    if (i % 2 === 0) woodblock(d, d.t + at, 900 - i * 25, 0.025)
    at += 0.028
  }
  noise(d, d.t + 0.05, 0.08, 'highpass', 2500, 0.4)
  knock(d, d.t + at + 0.02, 180, 0.09)
}

// Gold: a heavy hinge creak, a warm boom and a ring of bells climbing up.
function goldOpen() {
  const d = dest()
  if (!d) return
  crashSound()
  noise(d, d.t, 0.06, 'bandpass', 380, 0.35, 8)
  softKick(d, d.t + 0.02, 0.14)
  const notes = [784, 988, 1175, 1568, 1976]
  notes.forEach((f, i) => glock(d, d.t + 0.08 + i * 0.06, f, 0.05, 1.2))
  vibes(d, d.t + 0.1, 523, 0.05, 2.2)
  for (let i = 0; i < 8; i++) shaker(d, d.t + 0.3 + i * 0.07, 0.012, 0.06, 11000)
}

// Diamond: a deep boom, a sharp crack and a long spray of glass tinkles falling away.
function diamondOpen() {
  const d = dest()
  if (!d) return
  crashSound()
  softKick(d, d.t, 0.2)
  noise(d, d.t, 0.25, 'highpass', 3200, 0.5)
  noise(d, d.t, 0.12, 'bandpass', 6500, 0.9, 2)
  for (let i = 0; i < 26; i++) {
    const at = 0.02 + Math.pow(i / 26, 1.6) * 1.4 + Math.random() * 0.04
    glock(d, d.t + at, 2600 + Math.random() * 3200, 0.03 * (1 - i / 34), 0.35)
  }
  vibes(d, d.t + 0.15, 659, 0.05, 2.6)
  vibes(d, d.t + 0.15, 988, 0.04, 2.6)
}

export function crateOpenSound(id: CrateId) {
  if (id === 'street') streetOpen()
  else if (id === 'garage') garageOpen()
  else if (id === 'gold') goldOpen()
  else diamondOpen()
}
