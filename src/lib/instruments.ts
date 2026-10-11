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

// Electric piano: a sine tine struck by a decaying FM bark, like a Rhodes.
// Soft and round low down, bell-like when played harder.
export function epiano({ ctx, out }: Dest, t: number, freq: number, vol = 0.08, decay = 2.4) {
  const c = ctx.createOscillator()
  const m = ctx.createOscillator()
  const mg = ctx.createGain()
  const g = ctx.createGain()
  c.frequency.value = freq
  m.frequency.value = freq
  mg.gain.setValueAtTime(freq * 1.6, t)
  mg.gain.exponentialRampToValueAtTime(freq * 0.08, t + 0.9)
  m.connect(mg).connect(c.frequency)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.006)
  g.gain.exponentialRampToValueAtTime(vol * 0.45, t + 0.35)
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  c.connect(g).connect(out)
  c.start(t)
  m.start(t)
  c.stop(t + decay + 0.05)
  m.stop(t + decay + 0.05)
  // The tine's metallic ping on the attack.
  partial({ ctx, out }, t, freq * 7.1, vol * 0.06, 0.12, 0.002)
}

// Shaker: a short burst of bright noise, for a light groove under music.
let shakeBuf: AudioBuffer | null = null
export function shaker({ ctx, out }: Dest, t: number, vol = 0.02, len = 0.07, bright = 7000) {
  if (!shakeBuf || shakeBuf.sampleRate !== ctx.sampleRate) {
    shakeBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate)
    const d = shakeBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const src = ctx.createBufferSource()
  src.buffer = shakeBuf
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = bright
  f.Q.value = 0.9
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + len * 0.35)
  g.gain.exponentialRampToValueAtTime(0.0001, t + len)
  src.connect(f).connect(g).connect(out)
  src.start(t, Math.random() * 0.1)
  src.stop(t + len + 0.02)
}

// A soft, rounded kick drum: a sine that drops in pitch.
export function softKick({ ctx, out }: Dest, t: number, vol = 0.12) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.frequency.setValueAtTime(110, t)
  o.frequency.exponentialRampToValueAtTime(48, t + 0.12)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.35)
}

// Vibraphone: soft metal bars with a slow motor tremolo, for smooth, mellow leads.
export function vibes({ ctx, out }: Dest, t: number, freq: number, vol = 0.06, decay = 2.6) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  // The motor's wobble.
  const trem = ctx.createGain()
  trem.gain.value = 0.75
  const lfo = ctx.createOscillator()
  const depth = ctx.createGain()
  lfo.frequency.value = 5
  depth.gain.value = 0.25
  lfo.connect(depth).connect(trem.gain)
  g.connect(trem).connect(out)
  for (const [mult, v, d] of [[1, 1, 1], [4, 0.12, 0.25], [10, 0.02, 0.05]]) {
    const o = ctx.createOscillator()
    const pg = ctx.createGain()
    o.frequency.value = freq * mult
    pg.gain.setValueAtTime(v, t)
    pg.gain.exponentialRampToValueAtTime(0.0001, t + decay * d)
    o.connect(pg).connect(g)
    o.start(t)
    o.stop(t + decay + 0.05)
  }
  lfo.start(t)
  lfo.stop(t + decay + 0.05)
}

// Flute: a breathy, rounded tone that swells in and sings with a little vibrato.
export function flute({ ctx, out }: Dest, t: number, freq: number, vol = 0.05, len = 0.5) {
  const end = t + Math.max(0.12, len)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.07)
  g.gain.setValueAtTime(vol, end)
  g.gain.exponentialRampToValueAtTime(0.0001, end + 0.25)
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = freq * 4
  g.connect(tone).connect(out)
  const lfo = ctx.createOscillator()
  const vib = ctx.createGain()
  lfo.frequency.value = 5
  vib.gain.setValueAtTime(0, t)
  vib.gain.linearRampToValueAtTime(freq * 0.006, t + 0.35)
  lfo.connect(vib)
  for (const [mult, v] of [[1, 1], [2, 0.18], [3, 0.05]]) {
    const o = ctx.createOscillator()
    const pg = ctx.createGain()
    o.frequency.value = freq * mult
    vib.connect(o.frequency)
    pg.gain.value = v
    o.connect(pg).connect(g)
    o.start(t)
    o.stop(end + 0.3)
  }
  lfo.start(t)
  lfo.stop(end + 0.3)
}

// A warm string pad: detuned soft voices that swell in and fade out slowly.
export function pad({ ctx, out }: Dest, t: number, freqs: number[], vol = 0.02, len = 2) {
  const g = ctx.createGain()
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 1300
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.8, len * 0.4))
  g.gain.setValueAtTime(vol, t + len)
  g.gain.linearRampToValueAtTime(0, t + len + 1)
  f.connect(g).connect(out)
  for (const freq of freqs)
    for (const cents of [-7, 7]) {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = freq * Math.pow(2, cents / 1200)
      o.connect(f)
      o.start(t)
      o.stop(t + len + 1.05)
    }
}

// A round, smooth bass (like a fretless or a soft upright), held for `len`.
export function softBass({ ctx, out }: Dest, t: number, freq: number, vol = 0.16, len = 0.5) {
  const end = t + Math.max(0.1, len)
  const g = ctx.createGain()
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 420
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.015)
  g.gain.exponentialRampToValueAtTime(vol * 0.6, end)
  g.gain.exponentialRampToValueAtTime(0.0001, end + 0.15)
  f.connect(g).connect(out)
  for (const [type, v] of [['sine', 1], ['triangle', 0.35]] as const) {
    const o = ctx.createOscillator()
    const og = ctx.createGain()
    o.type = type
    o.frequency.value = freq
    og.gain.value = v
    o.connect(og).connect(f)
    o.start(t)
    o.stop(end + 0.2)
  }
}

// Cross-stick: the soft wooden click of a drummer playing it cool.
export function rim({ ctx, out }: Dest, t: number, vol = 0.03) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  const f = ctx.createBiquadFilter()
  o.type = 'triangle'
  o.frequency.value = 520
  f.type = 'bandpass'
  f.frequency.value = 1700
  f.Q.value = 2
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
  o.connect(f).connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.07)
}

// Choir: soft "aah" voices, an airy, angelic pad. Each voice is a buzzy tone
// shaped by the vowel's resonances, swelling in with a gentle vibrato.
const AAH = [[730, 1, 6], [1090, 0.5, 8], [2440, 0.18, 10]] as const
export function choir({ ctx, out }: Dest, t: number, freqs: number[], vol = 0.02, len = 2) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + Math.min(1.2, len * 0.45))
  g.gain.setValueAtTime(vol, t + len)
  g.gain.linearRampToValueAtTime(0, t + len + 1.4)
  g.connect(out)
  const vowel = AAH.map(([f, v, q]) => {
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = f
    bp.Q.value = q
    const bg = ctx.createGain()
    bg.gain.value = v * 2.5
    bp.connect(bg).connect(g)
    return bp
  })
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 4.6
  lfo.start(t)
  lfo.stop(t + len + 1.5)
  freqs.forEach((freq, i) => {
    for (const cents of [-8, 8]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = freq * Math.pow(2, cents / 1200)
      const vib = ctx.createGain()
      vib.gain.value = freq * 0.004
      lfo.connect(vib).connect(o.frequency)
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 3200
      o.connect(lp)
      for (const v of vowel) lp.connect(v)
      // Voices come in one after another, like singers.
      o.start(t + i * 0.06)
      o.stop(t + len + 1.5)
    }
  })
}

// Note names to frequencies, for readable melodies.
const NOTES: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }
export function hz(name: string) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name)
  if (!m) throw new Error(`bad note ${name}`)
  const semis = NOTES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12
  return 440 * Math.pow(2, semis / 12)
}
