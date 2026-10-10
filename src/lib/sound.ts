// Tiny synthesized sound effects, so the game ships no audio files.

let ctx: AudioContext | null = null
let muted = (() => {
  try {
    return localStorage.getItem('cartopia-muted') === '1'
  } catch {
    return false
  }
})()

const listeners = new Set<() => void>()

function audio() {
  if (muted) return null
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
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
export function onMuteChange(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, slideTo?: number) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + start
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

export const sfx = {
  click: () => tone(660, 0, 0.06, 'triangle', 0.08),
  coin: () => {
    tone(988, 0, 0.08, 'square', 0.07)
    tone(1319, 0.07, 0.18, 'square', 0.07)
  },
  start: () => tone(300, 0, 0.15, 'triangle', 0.1, 520),
  error: () => tone(200, 0, 0.18, 'sawtooth', 0.06, 140),
  levelUp: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.12)),
  buy: () => [784, 988, 1175].forEach((f, i) => tone(f, i * 0.06, 0.12, 'square', 0.06)),
  horn: () => {
    tone(392, 0, 0.35, 'square', 0.06)
    tone(494, 0, 0.35, 'square', 0.05)
  },
  shift: (good: boolean) => tone(good ? 880 : 330, 0, 0.08, 'square', 0.08),
  win: () => [523, 659, 784, 659, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25, 'triangle', 0.13)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.16, 0.3, 'triangle', 0.1)),
  countdown: (go: boolean) => tone(go ? 880 : 440, 0, go ? 0.4 : 0.15, 'square', 0.08),
}

// Engine drone for races: a sawtooth whose pitch follows the rpm.
let engine: { o: OscillatorNode; g: GainNode } | null = null
export function engineRpm(rpm: number, gear: number) {
  const a = audio()
  if (!a) return
  if (!engine) {
    const o = a.createOscillator()
    const g = a.createGain()
    const f = a.createBiquadFilter()
    o.type = 'sawtooth'
    f.type = 'lowpass'
    f.frequency.value = 900
    g.gain.value = 0.05
    o.connect(f).connect(g).connect(a.destination)
    o.start()
    engine = { o, g }
  }
  engine.o.frequency.setTargetAtTime(55 + rpm * (140 - gear * 12), a.currentTime, 0.03)
}
export function stopEngine() {
  if (!engine) return
  try {
    engine.o.stop()
  } catch {
    /* already stopped */
  }
  engine = null
}
