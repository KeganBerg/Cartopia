// Runs the Techno Night track while the event is on. It plays on the music
// bus settings (the Menu's music switch and slider turn it down or off),
// falls silent while muted, during races and arcade games, and in a hidden
// tab, and the town's own music and the club give way to it.
import { audioContext, audioOut, isMuted, onMuteChange } from './sound'
import { musicSettings, onMusicChange } from './townMusic'
import { onTownHold, townHeld } from '../scene/renderGate'
import { onTechnoChange, technoDrop, technoOn } from '../game/techno'
import { TechnoTrack } from './technoTrack'

// How loud the track runs at full music slider. It sits well above the town
// music: it's a party.
const TRIM = 0.85

let ctx: AudioContext | null = null
let track: TechnoTrack | null = null
let timer: ReturnType<typeof setInterval> | null = null
let quietSince = 0

function target() {
  const m = musicSettings()
  if (!technoOn() || !m.on || isMuted() || townHeld() || document.hidden) return 0
  return m.volume * TRIM
}

function tick() {
  if (!ctx) return
  const v = target()
  const t = ctx.currentTime
  if (v > 0.001) {
    if (!track) track = new TechnoTrack(ctx, audioOut() ?? ctx.destination)
    quietSince = 0
    track.level(v, t, 0.8)
    // The wall-clock moment that will be heard at `t`, so every town in the event is on the same beat.
    const lag = (ctx.outputLatency || ctx.baseLatency || 0) * 1000
    track.step(t, Date.now() + lag, technoDrop())
  } else if (track) {
    track.level(0, t, 0.3)
    if (!quietSince) quietSince = t
    else if (t - quietSince > 1.5) {
      track.stop()
      track = null
    }
  }
  if (!track && v <= 0.001 && timer) {
    clearInterval(timer)
    timer = null
  }
}

function wake() {
  if (target() <= 0.001 && !track) return
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
