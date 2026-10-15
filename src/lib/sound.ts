// Tiny synthesized sound effects, so the game ships no audio files.
// Everything audible shares one AudioContext and goes through one master
// output, so the Sound toggle silences it all. Other audio (the town ambience,
// race engines) gets both from audioContext() and audioOut().
import { choir, epiano, glock, hz, marimba, pluck, shaker, softBass, softKick, vibes, woodblock } from './instruments'
import type { Body } from '../game/data'

let ctx: AudioContext | null = null
let master: GainNode | null = null
// Sound effects and engines go through their own fader into the master, so
// Settings can turn them down without touching the music or town sounds.
let effects: GainNode | null = null
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

// A safety net on the master output: untouched below -6 dBFS, rounding off
// anything louder instead of clipping, so a level-up landing on a collect, the
// music and the town sounds never crackles on phone speakers.
export function softClipCurve(n = 4097) {
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    const a = Math.abs(x)
    c[i] = Math.sign(x) * (a <= 0.5 ? a : 0.5 + 0.5 * Math.tanh((a - 0.5) / 0.5))
  }
  return c
}
function softClip(c: BaseAudioContext) {
  const w = c.createWaveShaper()
  w.curve = softClipCurve()
  w.oversample = '2x'
  return w
}

let effectsVolume = (() => {
  try {
    const v = localStorage.getItem('cartopia-sfx-volume')
    return v !== null && Number.isFinite(Number(v)) ? Math.min(1, Math.max(0, Number(v))) : 1
  } catch {
    return 1
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
      master.connect(softClip(ctx)).connect(ctx.destination)
      effects = ctx.createGain()
      effects.gain.value = effectsVolume
      effects.connect(master)
      const rate = ctx.sampleRate
      if (typeof requestIdleCallback === 'function') requestIdleCallback(() => bakeFanfare(rate), { timeout: 5000 })
      else setTimeout(() => bakeFanfare(rate), 3000)
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
// The effects fader: sound effects, engines and the arcade play through this.
export const sfxOut = (): AudioNode | null => (audio() ? effects : null)

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
export const getSfxVolume = () => effectsVolume
export function setSfxVolume(v: number) {
  effectsVolume = Math.min(1, Math.max(0, v))
  try {
    localStorage.setItem('cartopia-sfx-volume', String(effectsVolume))
  } catch {
    /* storage unavailable */
  }
  if (ctx && effects) effects.gain.setTargetAtTime(effectsVolume, ctx.currentTime, 0.05)
  listeners.forEach((l) => l())
}
export function onMuteChange(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

// Sounds that a slider, a burst of chat messages or a run of taps could fire
// many times over: once per `ms` at most.
const lastPlayed = new Map<string, number>()
function throttled(key: string, ms: number) {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (now - (lastPlayed.get(key) ?? -Infinity) < ms) return true
  lastPlayed.set(key, now)
  return false
}

// Each effect is played on a little instrument (see instruments.ts) rather than a raw beep.
function play(f: (d: { ctx: BaseAudioContext; out: AudioNode }, t: number) => void, delay = 0) {
  // Before the player's first tap the context can't run yet, and anything queued
  // (a menu opening on load, a gift arriving) would burst out on that first tap.
  if (typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive === false) return
  const a = audio()
  if (!a || !effects) return
  f({ ctx: a, out: effects }, a.currentTime + 0.005 + delay)
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
    g.gain.linearRampToValueAtTime(0.045, t + 0.02)
    g.gain.setValueAtTime(0.045, t + 0.3)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    o.connect(g).connect(lp)
    o.start(t)
    o.stop(t + 0.45)
  }
}

// The ice cream truck's horn: the opening of Greensleeves (an old folk tune ice cream vans
// play) on a music box, a soft pluck an octave down so phone speakers carry it. About 1.5 s.
export function iceCreamJingle(d: { ctx: BaseAudioContext; out: AudioNode }, t: number, vol = 1) {
  const beat = 0.16
  const tune: [string, number][] = [['A5', 1], ['C6', 2], ['D6', 1], ['E6', 1.5], ['F6', 0.5], ['E6', 1], ['D6', 2], ['B5', 1]]
  let at = t
  for (const [n, len] of tune) {
    const f = hz(n)
    glock(d, at, f, 0.06 * vol, 0.45 + len * 0.15)
    glock(d, at + 0.004, f * 2, 0.012 * vol, 0.25)
    pluck(d, at, f / 2, 0.05 * vol)
    at += len * beat
  }
}

// Bodies whose horn plays a tune instead of a honk.
const JINGLE_BODIES: readonly Body[] = ['icecream']
export const hornJingles = (body?: Body | null) => !!body && JINGLE_BODIES.includes(body)

// The mid-range body of a thud: phone speakers can't play a kick drum's low
// thump, so anything that lands or bumps gets this knock on top to be heard.
export function knock(d: { ctx: BaseAudioContext; out: AudioNode }, t: number, freq = 420, vol = 0.1) {
  const o = d.ctx.createOscillator()
  const g = d.ctx.createGain()
  const lp = d.ctx.createBiquadFilter()
  o.type = 'triangle'
  o.frequency.setValueAtTime(freq * 1.8, t)
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.04)
  lp.type = 'lowpass'
  lp.frequency.value = freq * 5
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.003)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
  o.connect(lp).connect(g).connect(d.out)
  o.start(t)
  o.stop(t + 0.16)
  shaker(d, t, vol * 0.5, 0.05, freq * 6)
}

// The coin sound: two bright bell notes with a little sparkle on top.
function coinChime(d: { ctx: BaseAudioContext; out: AudioNode }, t: number, v: number) {
  glock(d, t, hz('B5'), 0.07 * v, 0.5)
  glock(d, t + 0.07, hz('E6'), 0.085 * v, 1)
  glock(d, t + 0.07, hz('E7'), 0.012 * v, 0.4)
}

// The biggest everyday moment, the level-up: a short, warm fanfare. A
// "ta-da-da-DAA" pickup into a held chord, an answering phrase up to a bell,
// a soft choir under it.
export function levelFanfare(dest: { ctx: BaseAudioContext; out: AudioNode }, t: number) {
  const out = dest.ctx.createGain()
  out.gain.value = 1.4
  out.connect(dest.out)
  const d = { ctx: dest.ctx, out }
  const lift = [['G4', 0], ['A4', 0.1], ['B4', 0.2]] as const
  for (const [n, at] of lift) {
    marimba(d, t + at, hz(n), 0.1, 0.35)
    glock(d, t + at, hz(n) * 2, 0.025, 0.3)
  }
  const hit = t + 0.32
  for (const n of ['C4', 'E4', 'G4', 'C5']) epiano(d, hit, hz(n), 0.045, 1.8)
  vibes(d, hit, hz('C5'), 0.07, 1.4)
  softBass(d, hit, hz('C3'), 0.14, 0.9)
  softKick(d, hit, 0.08)
  // The answer: up to the high C, where it rings out.
  marimba(d, hit + 0.36, hz('E5'), 0.09, 0.4)
  marimba(d, hit + 0.5, hz('G5'), 0.09, 0.4)
  glock(d, hit + 0.64, hz('C6'), 0.08, 1.8)
  vibes(d, hit + 0.64, hz('G5'), 0.045, 1.8)
  choir(d, hit + 0.1, [hz('C4'), hz('G4'), hz('E5')], 0.018, 1.6)
  shaker(d, hit + 0.64, 0.015, 0.4, 8000)
}

// The fanfare rendered once ahead of time (when the sound starts up, while the
// game is idle), so a level-up only starts a buffer: building it live is a
// burst of main-thread work right as the splash opens.
let fanfare: AudioBuffer | null = null
let baking = false
function bakeFanfare(rate: number) {
  if (fanfare || baking || typeof OfflineAudioContext === 'undefined') return
  baking = true
  const off = new OfflineAudioContext(2, Math.ceil(rate * 3.6), rate)
  levelFanfare({ ctx: off, out: off.destination }, 0)
  off.startRendering().then((b) => (fanfare = b), () => (baking = false))
}

const arp = (notes: string[], gap: number, inst: typeof marimba, vol: number) => (d: { ctx: BaseAudioContext; out: AudioNode }, t: number) =>
  notes.forEach((n, i) => inst(d, t + i * gap, hz(n), vol))

export const sfx = {
  click: () => play((d, t) => woodblock(d, t, 1300, 0.09)),
  coin: () => play((d, t) => coinChime(d, t, 1)),
  // Collect All: a short cascade of coins, longer the more it gathered.
  coins: (n: number) => play((d, t) => {
    const k = Math.max(1, Math.min(6, Math.round(n)))
    coinChime(d, t, 1)
    const run = ['G6', 'B6', 'D7', 'E7', 'G7']
    for (let i = 1; i < k; i++) glock(d, t + 0.1 + i * 0.055, hz(run[i - 1]), 0.035, 0.5)
    if (k > 2) shaker(d, t + 0.08, 0.025, 0.06 * k, 6500)
  }),
  start: () => play(arp(['G4', 'D5'], 0.08, marimba, 0.12)),
  // Another player wants to race: two quick start-light pips, then a bright
  // rising call. Short and friendly, so it reads as an invite, not an alarm.
  challenge: () => play((d, t) => {
    glock(d, t, hz('A5'), 0.07, 0.25)
    glock(d, t + 0.13, hz('A5'), 0.07, 0.25)
    arp(['D5', 'A5'], 0.07, pluck, 0.18)(d, t + 0.28)
    glock(d, t + 0.35, hz('D7'), 0.055, 1)
    vibes(d, t + 0.35, hz('F#5'), 0.07, 1.2)
  }),
  // A menu sliding open or shut: one soft wooden tock, up to open and down to close.
  menuOpen: () => !throttled('menu', 120) && play((d, t) => {
    marimba(d, t, hz('G4'), 0.05, 0.25)
    marimba(d, t + 0.045, hz('D5'), 0.06, 0.3)
  }),
  menuClose: () => !throttled('menu', 120) && play((d, t) => {
    marimba(d, t, hz('D5'), 0.045, 0.25)
    marimba(d, t + 0.045, hz('G4'), 0.05, 0.3)
  }),
  // Switching tabs inside a menu: the lightest tick.
  tab: () => !throttled('tab', 60) && play((d, t) => woodblock(d, t, 1500, 0.06)),
  // Putting something on: a hat, a trail, a colour theme, the race car.
  equip: () => !throttled('equip', 150) && play((d, t) => {
    marimba(d, t, hz('E5'), 0.09, 0.4)
    marimba(d, t + 0.06, hz('B5'), 0.08, 0.45)
    glock(d, t + 0.06, hz('E7'), 0.025, 0.6)
    shaker(d, t + 0.06, 0.012, 0.05, 8000)
  }),
  // Something arrived for you (a gift, a friend request, a postcard): a warm doorbell.
  notify: () => !throttled('notify', 1500) && play((d, t) => {
    vibes(d, t, hz('E5'), 0.1, 1.4)
    vibes(d, t + 0.16, hz('A5'), 0.1, 1.8)
    glock(d, t + 0.16, hz('A6'), 0.04, 1.2)
  }),
  // A new chat message: a single soft pluck with a sparkle, at most every few seconds.
  message: () => !throttled('message', 4000) && play((d, t) => {
    pluck(d, t, hz('B5'), 0.12)
    glock(d, t + 0.05, hz('F#6'), 0.04, 0.7)
  }),
  // Sending something (a chat line, a postcard, a gift, a part): a quick upward flick.
  send: () => !throttled('send', 150) && play((d, t) => {
    pluck(d, t, hz('A4'), 0.08)
    pluck(d, t + 0.05, hz('E5'), 0.08)
    shaker(d, t + 0.02, 0.014, 0.08, 6000)
  }),
  // A small win that isn't coins: parts from the crew, a friendship level, the season recap.
  reward: () => !throttled('reward', 300) && play((d, t) => {
    for (const n of ['C5', 'E5', 'G5']) marimba(d, t, hz(n), 0.07, 0.6)
    glock(d, t + 0.09, hz('C7'), 0.045, 1.2)
    glock(d, t + 0.16, hz('G6'), 0.035, 1)
  }),
  // Something new opened up (a feature, a title): a rising sparkle with a breath of choir.
  unlock: () => !throttled('unlock', 600) && play((d, t) => {
    for (const [i, n] of ['C6', 'E6', 'G6', 'C7'].entries()) glock(d, t + i * 0.07, hz(n), 0.045, 1.1)
    marimba(d, t, hz('C5'), 0.07, 0.5)
    vibes(d, t + 0.21, hz('E5'), 0.06, 1.6)
    choir(d, t + 0.05, [hz('C5'), hz('G5')], 0.014, 1.2)
  }),
  // A tutorial step done: a short two-note nod.
  step: () => play((d, t) => {
    marimba(d, t, hz('C5'), 0.08, 0.35)
    marimba(d, t + 0.08, hz('G5'), 0.08, 0.5)
    glock(d, t + 0.08, hz('G6'), 0.025, 0.6)
  }),
  // A gentle "uh-uh": low enough to read as no, an octave up so phones play it.
  error: () => play((d, t) => {
    marimba(d, t, hz('E4'), 0.1, 0.3)
    marimba(d, t, hz('E3'), 0.07, 0.3)
    marimba(d, t + 0.12, hz('C4'), 0.1, 0.4)
    marimba(d, t + 0.12, hz('C3'), 0.07, 0.4)
  }),
  levelUp: () => play((d, t) => {
    if (!fanfare) return levelFanfare(d, t)
    const src = d.ctx.createBufferSource()
    src.buffer = fanfare
    src.connect(d.out)
    src.start(t)
  }),
  buy: () => play((d, t) => {
    arp(['G4', 'B4', 'D5'], 0.06, marimba, 0.11)(d, t)
    glock(d, t + 0.18, hz('G5'), 0.05, 0.8)
  }),
  // A car's horn: the ice cream truck plays its jingle instead.
  horn: (body?: Body | null) => play(hornJingles(body) ? iceCreamJingle : horn),
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
    softKick(d, t, 0.14)
    knock(d, t, 320, 0.16)
    shaker(d, t + 0.01, 0.05, 0.14, 900)
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
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.25)
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
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.08)
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
    knock(d, t, 440, 0.08)
    marimba(d, t, hz('A2'), 0.1, 0.2)
  }),
  // A find lands: a car settles onto the tow line, a small find drops in the bed.
  land: (car: boolean) => play((d, t) => {
    softKick(d, t, car ? 0.14 : 0.07)
    knock(d, t, car ? 340 : 520, car ? 0.18 : 0.07)
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

// Crate openings: a swell while the crate strains, and a reveal that says how good the pull is.
export const crateSfx = {
  // The glow building inside: a rising choir and a quickening shimmer.
  charge: (len: number) => play((d, t) => {
    choir(d, t, [hz('G3'), hz('D4')], 0.012, len * 0.7)
    let at = 0
    const notes = ['G5', 'A5', 'B5', 'D6', 'E6', 'G6', 'A6', 'B6', 'D7']
    for (let i = 0; at < len; i++) {
      glock(d, t + at, hz(notes[Math.min(i, notes.length - 1)]), 0.012 + (at / len) * 0.03, 0.4)
      at += 0.16 - (at / len) * 0.11
    }
  }),
  // 0 coins or a common part, 1 a good part or a jackpot, 2 rare, 3 a car or legendary skin.
  reveal: (tier: number, coins: boolean) => play((d, t) => {
    if (tier === 0) {
      if (coins) {
        coinChime(d, t, 1)
        for (const [i, n] of ['G6', 'B6', 'D7'].entries()) glock(d, t + 0.12 + i * 0.06, hz(n), 0.03, 0.5)
      } else arp(['G4', 'B4', 'D5'], 0.06, marimba, 0.12)(d, t)
      return
    }
    if (tier === 1) {
      for (const n of ['C4', 'E4', 'G4']) marimba(d, t, hz(n), 0.11)
      glock(d, t + 0.1, hz('C6'), 0.07, 1.2)
      glock(d, t + 0.17, hz('G6'), 0.04, 1)
      return
    }
    if (tier === 2) {
      arp(['D4', 'F#4', 'A4', 'D5', 'F#5', 'A5'], 0.06, pluck, 0.15)(d, t)
      vibes(d, t + 0.36, hz('A5'), 0.07)
      glock(d, t + 0.36, hz('D6'), 0.08, 1.6)
      choir(d, t, [hz('D4'), hz('A4')], 0.016, 1.2)
      return
    }
    arp(['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6'], 0.05, pluck, 0.16)(d, t)
    choir(d, t, [hz('C4'), hz('G4'), hz('E5')], 0.03, 2.2)
    vibes(d, t + 0.36, hz('G5'), 0.08)
    glock(d, t + 0.36, hz('C7'), 0.06, 1.8)
    glock(d, t + 0.36, hz('E6'), 0.07, 1.8)
    softKick(d, t + 0.36, 0.12)
    knock(d, t + 0.36, 400, 0.08)
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

// Every tab row in the game ticks when you switch to another tab.
if (typeof window !== 'undefined') {
  window.addEventListener('click', (e) => {
    const tab = e.target instanceof Element ? e.target.closest('[role="tab"]') : null
    if (tab && tab.getAttribute('aria-selected') !== 'true' && !tab.hasAttribute('disabled')) sfx.tab()
  }, true)
}
