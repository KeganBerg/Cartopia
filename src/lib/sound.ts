// Tiny synthesized sound effects, so the game ships no audio files.
// Everything audible shares one AudioContext and goes through one master
// output, so the Sound toggle silences it all. Other audio (the town ambience,
// race engines) gets both from audioContext() and audioOut().

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
  o.connect(g).connect(master!)
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
  // A soft chime on a clean shift; the race engine plays the gear change itself.
  shift: (good: boolean) => {
    if (good) tone(1568, 0, 0.12, 'sine', 0.035)
  },
  win: () => [523, 659, 784, 659, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25, 'triangle', 0.13)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.16, 0.3, 'triangle', 0.1)),
  countdown: (go: boolean) => tone(go ? 880 : 440, 0, go ? 0.4 : 0.15, 'square', 0.08),
}

// Race engines live in engineAudio.ts; muting silences them through this hook.
let engineStop: (() => void) | null = null
export function onStopEngine(f: () => void) {
  engineStop = f
}
export function stopEngine() {
  engineStop?.()
}
