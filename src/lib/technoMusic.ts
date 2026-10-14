// Plays Rave Mode's song (onte - "halcyon", NCS) while the event is on: its
// build-up through the ten-second warning, fading in so nobody is startled,
// then the drop and its sixteen bars looping until the event ends. It plays on
// the music bus settings (the Menu's music switch and slider turn it down or
// off), falls silent while muted, during races and arcade games, and in a
// hidden tab, and the town's own music and the club give way to it.
//
// Everyone hears the same moment: where it is in the song comes from the wall
// clock and the event's drop (techno.ts), not from when this player's audio started.
import { audioContext, audioOut, isMuted, onMuteChange } from './sound'
import { musicSettings, onMusicChange } from './townMusic'
import { onTownHold, townHeld } from '../scene/renderGate'
import { BAR_MS, BUILD_MS, CYCLE_BARS, onTechnoChange, technoDrop, technoOn } from '../game/techno'

// The clip in public/audio: the ten seconds before halcyon's second drop
// (2:15.5 in the song), the sixteen bars of the drop, and a moment more.
const SRC = '/audio/rave-halcyon.mp3'
// Where the drop lands in the clip, and how long the looping drop is (s).
const DROP = BUILD_MS / 1000
const LOOP = (CYCLE_BARS * BAR_MS) / 1000
// How loud it runs at full music slider. It sits well above the town music: it's a party.
const TRIM = 0.7

// Where in the clip to be, `s` seconds after the warning started.
export function clipAt(s: number) {
  return s < DROP ? Math.max(0, s) : DROP + ((s - DROP) % LOOP)
}
// How far faded in, `s` seconds after the warning started: from silence to
// full over the warning, gently at first.
export function fadeAt(s: number) {
  const x = Math.min(1, Math.max(0, s / DROP))
  return x * x
}

let ctx: AudioContext | null = null
let song: AudioBuffer | null = null
let loading: Promise<unknown> | null = null
// Fetched only when a rave is on (or about to be), not by every player at startup.
export function prefetchTechno() {
  const c = audioContext()
  if (!c || song) return
  loading ??= fetch(SRC)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((b) => c.decodeAudioData(b))
    .then((b) => {
      song = b
      wake()
    })
    .catch(() => {
      loading = null
    })
}

let src: AudioBufferSourceNode | null = null
let gain: GainNode | null = null
let startedAt = 0 // audio time the source started
let startedFrom = 0 // its offset in the clip then
let timer: ReturnType<typeof setInterval> | null = null
let quietSince = 0

function target() {
  const m = musicSettings()
  if (!technoOn() || !m.on || isMuted() || townHeld() || document.hidden) return 0
  return m.volume * TRIM
}

function stopSource() {
  try {
    src?.stop()
  } catch {
    /* already stopped */
  }
  src?.disconnect()
  gain?.disconnect()
  src = null
  gain = null
}

// Where the playing source is in the clip now.
function playingAt(t: number) {
  const s = startedFrom + (t - startedAt)
  return s < DROP ? s : DROP + ((s - DROP) % LOOP)
}

function tick() {
  if (!ctx) return
  const v = target()
  const t = ctx.currentTime
  if (v > 0.001) {
    if (!song) return prefetchTechno()
    quietSince = 0
    // The wall-clock moment that will be heard at `t`.
    const lag = (ctx.outputLatency || ctx.baseLatency || 0) * 1000
    const s = (Date.now() + lag - (technoDrop() - BUILD_MS)) / 1000
    const want = clipAt(s)
    // Start, or re-sync if it has drifted from the wall clock.
    if (!src || Math.abs(playingAt(t) - want) > 0.08) {
      stopSource()
      gain = ctx.createGain()
      gain.gain.value = 0
      gain.connect(audioOut() ?? ctx.destination)
      src = ctx.createBufferSource()
      src.buffer = song
      src.loop = true
      src.loopStart = DROP
      src.loopEnd = DROP + LOOP
      src.connect(gain)
      startedAt = t + 0.02
      startedFrom = want + 0.02
      src.start(startedAt, startedFrom)
    }
    gain!.gain.setTargetAtTime(v * fadeAt(s), t, 0.15)
  } else if (src && gain) {
    // The event's end (or a mute, a race...): a short fade, then let it go.
    gain.gain.setTargetAtTime(0, t, technoOn() ? 0.2 : 0.8)
    if (!quietSince) quietSince = t
    else if (t - quietSince > 4) stopSource()
  }
  if (!src && v <= 0.001 && timer) {
    clearInterval(timer)
    timer = null
  }
}

function wake() {
  if (target() <= 0.001 && !src) return
  ctx = audioContext()
  if (!ctx) return
  if (!timer) timer = setInterval(tick, 100)
  tick()
}

let started = false
export function startTechnoMusic() {
  if (started || typeof window === 'undefined') return
  started = true
  for (const e of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(e, wake, { passive: true })
  document.addEventListener('visibilitychange', wake)
  onMuteChange(wake)
  onTownHold(wake)
  onMusicChange(wake)
  onTechnoChange(wake)
  wake()
}
