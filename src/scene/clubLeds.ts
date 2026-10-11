import { Color, MeshStandardMaterial } from 'three'
import { clubPulse } from '../lib/clubBeat'
import { isNight } from '../game/clock'
import { nightAmount, dayPhase } from './dayNight'
import { danceFloorTex, ledPaneTex, windowTex } from './textures'

// The nightclub's LED windows: every window lights a colour of the rainbow,
// each a step along from its neighbour, and on every bass note the colours
// move on one step and flash (clubBeat.ts). The big front window is a grid of
// coloured cells that slides one cell per note. Dark by day and while closed.
// A handful of shared materials, kept out of Batch by `live`, so the cost is
// the same for any number of windows.

export const LED_COUNT = 6
export const RAINBOW = ['#ff1744', '#ff9100', '#ffea00', '#00e676', '#00b0ff', '#d500f9']

export const ledWindows = Array.from({ length: LED_COUNT }, () => {
  const m = new MeshStandardMaterial({ map: windowTex(), emissiveMap: ledPaneTex(), emissive: new Color('#000000'), emissiveIntensity: 1 })
  m.userData.live = true
  return m
})

// The front window's own copies of the dance-floor cells, so sliding them leaves the roof floor alone.
const cells = danceFloorTex(true, 4, 1).clone()
const cellsDim = danceFloorTex(false, 4, 1).clone()
cells.needsUpdate = cellsDim.needsUpdate = true
export const ledFront = new MeshStandardMaterial({ map: cellsDim, emissiveMap: cells, emissive: new Color('#ffffff'), emissiveIntensity: 0, roughness: 0.35 })
ledFront.userData.live = true

const tmp = new Color()
let lastStep = -1

// Brings the lights up to date; cheap enough to call every frame.
export function driveClubLeds(now = performance.now()) {
  const p = clubPulse(now)
  const lit = isNight() ? nightAmount(dayPhase()) : 0
  const glow = lit * (0.75 + 1.6 * p.flash)
  for (let i = 0; i < LED_COUNT; i++) {
    ledWindows[i].emissive.copy(tmp.set(RAINBOW[(i + p.step) % LED_COUNT])).multiplyScalar(glow)
  }
  ledFront.emissiveIntensity = lit * (0.9 + 1.4 * p.flash)
  if (p.step !== lastStep) {
    lastStep = p.step
    cells.offset.x = cellsDim.offset.x = (p.step % 4) * 0.25
  }
}
