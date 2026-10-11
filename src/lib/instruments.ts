// Small synthesised instruments for the game's sound effects: a wooden
// marimba, a glockenspiel, a plucked harp string and a wood block. They
// replace plain beeps with tones that sound played rather than electronic.

type Dest = { ctx: BaseAudioContext; out: AudioNode }

function partial({ ctx, out }: Dest, t: number, freq: number, vol: number, decay: number, attack = 0.004) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.frequency.value = freq
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + decay + 0.02)
}

// Marimba: a warm fundamental and the bar's bright overtone near 4x, which dies fast.
export function marimba(d: Dest, t: number, freq: number, vol = 0.12, decay = 0.6) {
  partial(d, t, freq, vol, decay)
  partial(d, t, freq * 3.93, vol * 0.25, decay * 0.18)
  partial(d, t, freq * 9.2, vol * 0.05, 0.03)
}

// Glockenspiel: bright metal bars with the bell-like inharmonic overtones.
export function glock(d: Dest, t: number, freq: number, vol = 0.08, decay = 1.1) {
  partial(d, t, freq, vol, decay, 0.002)
  partial(d, t, freq * 2.76, vol * 0.35, decay * 0.5, 0.002)
  partial(d, t, freq * 5.4, vol * 0.12, decay * 0.25, 0.002)
}

// Harp/guitar pluck (Karplus-Strong), rendered once per pitch and cached.
const plucks = new Map<string, AudioBuffer>()
function pluckBuffer(ctx: BaseAudioContext, freq: number) {
  const key = `${ctx.sampleRate}:${Math.round(freq)}`
  const hit = plucks.get(key)
  if (hit) return hit
  const sr = ctx.sampleRate
  const len = Math.floor(sr * 1.4)
  const buf = ctx.createBuffer(1, len, sr)
  const d = buf.getChannelData(0)
  const period = Math.max(2, Math.round(sr / freq))
  const ring = new Float32Array(period)
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1
  let prev = 0
  for (let i = 0; i < len; i++) {
    const k = i % period
    const x = ring[k]
    // Averaging neighbours damps the highs over time, like a real string.
    ring[k] = 0.996 * 0.5 * (x + prev)
    prev = x
    d[i] = x
  }
  plucks.set(key, buf)
  return buf
}
export function pluck({ ctx, out }: Dest, t: number, freq: number, vol = 0.12) {
  const src = ctx.createBufferSource()
  const g = ctx.createGain()
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = Math.min(9000, freq * 8)
  src.buffer = pluckBuffer(ctx, freq)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.35)
  src.connect(tone).connect(g).connect(out)
  src.start(t)
}

// Wood block: a short knock, for taps and ticks.
export function woodblock({ ctx, out }: Dest, t: number, freq = 1200, vol = 0.1) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  const f = ctx.createBiquadFilter()
  o.type = 'triangle'
  o.frequency.setValueAtTime(freq * 1.15, t)
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.02)
  f.type = 'bandpass'
  f.frequency.value = freq
  f.Q.value = 3
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
  o.connect(f).connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.1)
}

// Note names to frequencies, for readable melodies.
const NOTES: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }
export function hz(name: string) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name)
  if (!m) throw new Error(`bad note ${name}`)
  const semis = NOTES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12
  return 440 * Math.pow(2, semis / 12)
}
