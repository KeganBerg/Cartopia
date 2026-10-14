// Plays Rave Mode's music while the event is on: our synthesized techno track
// (technoTrack.ts), or onte's "halcyon" (NCS) once its licence lands and
// HALCYON is on (raveSong.ts). Either way the build-up fades in through the
// ten-second warning so nobody is startled, then the drop. It plays on the
// music bus settings (the Menu's music switch and slider turn it down or off),
// falls silent while muted, during races and arcade games, and in a hidden
// tab, and the town's own music and the club give way to it.
//
// Everyone hears the same moment: where it is comes from the wall clock and
// the event's drop (techno.ts), not from when this player's audio started.
import { audioContext, audioOut, isMuted, onMuteChange } from './sound'
import { musicSettings, onMusicChange } from './townMusic'
import { onTownHold, townHeld } from '../scene/renderGate'
import { BAR_MS, BUILD_MS, CYCLE_BARS, onTechnoChange, technoDrop, technoOn } from '../game/techno'
import { HALCYON } from '../game/raveSong'
import type { TechnoTrack } from './technoTrack'

// The halcyon clip: the ten seconds before its second drop (2:25.5 in the
// song), the sixteen bars of the drop, and a moment more. Where the drop
// lands in it, and how long the looping drop is (s).
const DROP = BUILD_MS / 1000
const LOOP = (CYCLE_BARS * BAR_MS) / 1000
// How loud it runs at full music slider. It sits well above the town music: it's a party.
const TRIM = HALCYON ? 0.7 : 0.85

// Where in the halcyon clip to be, `s` seconds after the warning started.
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
let Track: typeof TechnoTrack | null = null
let song: AudioBuffer | null = null
let loading: Promise<unknown> | null = null
// Loaded only when a rave is on (or about to be), not by every player at startup.
export function prefetchTechno() {
  // The build-time switch itself, so the song's loader is left out of the game while it's off.
  if (__RAVE_HALCYON__) loadSong()
  else
    loading ??= import('./technoTrack').then((m) => {
      Track = m.TechnoTrack
      wake()
    })
}
function loadSong() {
  const c = audioContext()
  if (!c || song) return
  loading ??= import('./raveSongUrl')
    .then((m) => fetch(m.default))
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
const ready = () => (HALCYON ? !!song : !!Track)

let track: TechnoTrack | null = null
let src: AudioBufferSourceNode | null = null
let gain: GainNode | null = null
let startedAt = 0 // audio time the halcyon source started
let startedFrom = 0 // its offset in the clip then
let timer: ReturnType<typeof setInterval> | null = null
let quietSince = 0

function target() {
  const m = musicSettings()
  if (!technoOn() || !m.on || isMuted() || townHeld() || document.hidden) return 0
  return m.volume * TRIM
}

const playing = () => !!(src || track)

function stopAll() {
  try {
    src?.stop()
  } catch {
    /* already stopped */
  }
  src?.disconnect()
  gain?.disconnect()
  src = null
  gain = null
  track?.stop()
  track = null
}

// Where the playing halcyon source is in the clip now.
function playingAt(t: number) {
  const s = startedFrom + (t - startedAt)
  return s < DROP ? s : DROP + ((s - DROP) % LOOP)
}

// Starts (or re-syncs) halcyon at `want` in the clip.
function startSong(c: AudioContext, t: number, want: number) {
  stopAll()
  gain = c.createGain()
  gain.gain.value = 0
  gain.connect(audioOut() ?? c.destination)
  src = c.createBufferSource()
  src.buffer = song
  src.loop = true
  src.loopStart = DROP
  src.loopEnd = DROP + LOOP
  src.connect(gain)
  startedAt = t + 0.02
  startedFrom = want + 0.02
  src.start(startedAt, startedFrom)
}

function tick() {
  if (!ctx) return
  const v = target()
  const t = ctx.currentTime
  if (v > 0.001) {
    if (!ready()) return prefetchTechno()
    quietSince = 0
    // The wall-clock moment that will be heard at `t`.
    const lag = (ctx.outputLatency || ctx.baseLatency || 0) * 1000
    const wall = Date.now() + lag
    const s = (wall - (technoDrop() - BUILD_MS)) / 1000
    const level = v * fadeAt(s)
    if (HALCYON) {
      const want = clipAt(s)
      if (!src || Math.abs(playingAt(t) - want) > 0.08) startSong(ctx, t, want)
      gain!.gain.setTargetAtTime(level, t, 0.15)
    } else {
      if (!track) {
        track = new Track!(ctx, audioOut() ?? ctx.destination)
        track.level(0, t, 0.01)
      }
      track.level(level, t, 0.15)
      track.step(t, wall, technoDrop())
    }
  } else if (playing()) {
    // The event's end (or a mute, a race...): a short fade, then let it go.
    const tc = technoOn() ? 0.2 : 0.8
    gain?.gain.setTargetAtTime(0, t, tc)
    track?.level(0, t, tc)
    if (!quietSince) quietSince = t
    else if (t - quietSince > 4) stopAll()
  }
  if (!playing() && v <= 0.001 && timer) {
    clearInterval(timer)
    timer = null
  }
}

function wake() {
  if (target() <= 0.001 && !playing()) return
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
