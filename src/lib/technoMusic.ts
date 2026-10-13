// Runs the Techno Night track while the event is on. It plays on the music
// bus settings (the Menu's music switch and slider turn it down or off),
// falls silent while muted, during races and arcade games, and in a hidden
// tab, and the town's own music and the club give way to it.
import { audioContext, audioOut, isMuted, onMuteChange } from './sound'
import { musicSettings, onMusicChange } from './townMusic'
import { onTownHold, townHeld } from '../scene/renderGate'
import { onTechnoChange, technoDrop, technoOn } from '../game/techno'
import type { TechnoTrack } from './technoTrack'

// The track's synth code loads in the background after startup (see prefetchTechno), not with the town.
let Track: typeof TechnoTrack | null = null
let loading: Promise<unknown> | null = null
export function prefetchTechno() {
  loading ??= import('./technoTrack').then((m) => {
    Track = m.TechnoTrack
    wake()
  })
}

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
    if (!Track) return prefetchTechno()
    if (!track) track = new Track(ctx, audioOut() ?? ctx.destination)
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

// A level-up's beat drop: five seconds of the Rave Mode drop on the sound
// effects bus. Returns the milliseconds until the drop lands, or null when it
// can't play (muted, a hidden tab, or Rave Mode already on).
export function levelDrop(): number | null {
  const c = audioContext()
  if (!c || technoOn() || document.hidden) return null
  if (!Track) {
    prefetchTechno()
    return null
  }
  const t = new Track(c, audioOut() ?? c.destination)
  const at = c.currentTime + 0.05
  t.level(0.5, at, 0.005)
  const drop = t.stinger(at)
  setTimeout(() => t.stop(), 7000)
  return (drop - c.currentTime) * 1000
}
