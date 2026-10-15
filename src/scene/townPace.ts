import { create } from 'zustand'

// How hard the town canvas works on this device: how sharp it draws and how often.
// When a phone can't keep up, every tap waits behind the frame being drawn, so the game
// feels laggy to touch. PostFx steps down here first: fewer pixels or fewer frames switch
// instantly, while dropping effects recompiles every shader and freezes for seconds.
export const PACES = [
  { dpr: 2, fps: 60 },
  { dpr: 1.5, fps: 60 },
  { dpr: 1.25, fps: 60 },
  { dpr: 1, fps: 60 },
  { dpr: 1, fps: 30 },
] as const
export type Pace = (typeof PACES)[number]

const STORE = 'cartopia-pace'

// Phones start at 1.5x sharpness (more makes iOS drop the WebGL context); a device that had to step down this session starts there.
export function startPace(small: boolean): number {
  let i = small ? 1 : 0
  try {
    const saved = Number(sessionStorage.getItem(STORE))
    if (saved > i && saved < PACES.length) i = saved
  } catch {
    // Storage can be blocked; the default is fine.
  }
  return i
}

// The next step that actually draws less here: on a 1x screen the sharpness steps change
// nothing, so it goes straight to fewer frames. null when there's nothing left to drop.
export function nextPace(i: number, screenDpr: number): number | null {
  const now = PACES[i]
  const drawn = Math.min(now.dpr, Math.max(1, screenDpr))
  for (let j = i + 1; j < PACES.length; j++) {
    const p = PACES[j]
    if (p.fps < now.fps || Math.min(p.dpr, Math.max(1, screenDpr)) < drawn) return j
  }
  return null
}

const small = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700
export const useTownPace = create<{ step: number }>(() => ({ step: typeof window === 'undefined' ? 0 : startPace(small) }))

// One step down; false when the town is already at its lightest.
export function paceDown(): boolean {
  const next = nextPace(useTownPace.getState().step, typeof window === 'undefined' ? 1 : window.devicePixelRatio)
  if (next == null) return false
  useTownPace.setState({ step: next })
  try {
    sessionStorage.setItem(STORE, String(next))
  } catch {
    // Not remembered; it steps down again if needed.
  }
  return true
}

// A 2x screen already draws four pixels per point, so 2x edge smoothing on top of that looks
// the same as 4x for half the work; at 2x a laptop's 4x frame was ~170 MB of graphics memory.
// From the screen, not the current sharpness, so a step down never rebuilds the effects (a freeze).
export const samplesFor = (tier: 'high' | 'low' | 'off', screenDpr: number) => (tier !== 'high' ? 2 : screenDpr >= 1.75 ? 2 : 4)
// A computer's town gives up sharpness below 50 frames a second; fewer frames (30) and fewer
// effects still wait for below 40, as on phones (a 45 fps desktop is smoother than a 30 fps one).
export const phoneSize = () => typeof window !== 'undefined' && (Math.min(window.innerWidth, window.innerHeight) < 700 || /iPhone|iPod|Android.*Mobile/.test(navigator.userAgent))
export function lowestFps(town: boolean | undefined, pace: number, phone: boolean, screenDpr: number) {
  if (town && PACES[pace].fps < 60) return 22
  const next = town && !phone ? nextPace(pace, screenDpr) : null
  return next != null && PACES[next].fps === PACES[pace].fps ? 50 : 40
}
