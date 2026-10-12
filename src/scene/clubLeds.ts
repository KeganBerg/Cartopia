import { Color, MeshStandardMaterial } from 'three'
import { clubPulse } from '../lib/clubBeat'
import { isNight } from '../game/clock'
import { nightAmount, dayPhase } from './dayNight'
import { ledGridTex, ledPaneTex, windowTex } from './textures'

// The nightclub's LED windows: every window shows the same colour of the
// rainbow, and on every bass note they all move on to the next colour together
// and flash (clubBeat.ts). The big front window is a grid of LED cells in that
// same colour. Dark by day and while closed. Two shared materials, kept out of
// Batch by `live`, so the cost is the same for any number of windows.

export const RAINBOW = ['#ff1744', '#ff9100', '#ffea00', '#00e676', '#00b0ff', '#d500f9']

// The colour the club's windows show right now, and how brightly (0 by day,
// about 0.75 at night between notes, up to about 2.3 on a kick). Anything that
// lights up with the club (the Vanguard Tower's penthouse) reads it here so it
// shows the exact same colour on the same beat.
export function clubLedColor(out = new Color(), now = performance.now()) {
  return out.set(RAINBOW[clubPulse(now).step % RAINBOW.length])
}
export function clubLedGlow(now = performance.now()) {
  const lit = isNight() ? nightAmount(dayPhase()) : 0
  return lit * (0.75 + 1.6 * clubPulse(now).flash)
}

export const ledWindow = new MeshStandardMaterial({ map: windowTex(), emissiveMap: ledPaneTex(), emissive: new Color('#000000'), emissiveIntensity: 1 })
ledWindow.userData.live = true

export const ledFront = new MeshStandardMaterial({ map: ledGridTex(false), emissiveMap: ledGridTex(true), emissive: new Color('#000000'), emissiveIntensity: 1, roughness: 0.35 })
ledFront.userData.live = true

const tmp = new Color()

// Once a frame (ClubLife).
export function driveClubLeds(now = performance.now()) {
  const p = clubPulse(now)
  const lit = isNight() ? nightAmount(dayPhase()) : 0
  clubLedColor(tmp, now)
  ledWindow.emissive.copy(tmp).multiplyScalar(lit * (0.75 + 1.6 * p.flash))
  ledFront.emissive.copy(tmp).multiplyScalar(lit * (0.9 + 1.4 * p.flash))
}
