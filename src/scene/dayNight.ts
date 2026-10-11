import { AdditiveBlending, Color, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { glowTex, windowGlowTex, windowTex } from './textures'
import { decal } from './layers'
import { movieTex } from './movie'

// One in-game day lasts 20 real minutes, tied to the clock so every player
// sees the same time of day. ?time=0..1 pins it (0.5 is midnight) for testing.
export const DAY_MS = 20 * 60 * 1000
const pinned = (() => {
  if (typeof location === 'undefined') return null
  const v = new URLSearchParams(location.search).get('time')
  return v === null ? null : Number(v)
})()

// 0 = noon, 0.5 = midnight.
export function dayPhase(now = Date.now()) {
  return pinned ?? (now % DAY_MS) / DAY_MS
}

// How dark it is, 0 (day) to 1 (night), with gentle dusk and dawn ramps.
export function nightAmount(phase: number) {
  const d = Math.abs(phase - 0.5) // 0 at midnight, 0.5 at noon
  if (d < 0.14) return 1
  if (d > 0.26) return 0
  return 1 - (d - 0.14) / 0.12
}

// How much of a sunset tint to add: peaks halfway through dusk and dawn.
export function duskAmount(phase: number) {
  const n = nightAmount(phase)
  return Math.max(0, 1 - Math.abs(n - 0.35) / 0.35)
}

// Shared materials whose glow follows the time of day. One instance each
// keeps the per-frame update to a handful of objects.
export const glowMats = {
  window: new MeshStandardMaterial({ map: windowTex(), emissiveMap: windowGlowTex(), emissive: new Color('#ffd27a'), emissiveIntensity: 0 }),
  bulb: new MeshStandardMaterial({ color: '#fff8e1', emissive: new Color('#ffcc66'), emissiveIntensity: 0.2 }),
  headlight: new MeshStandardMaterial({ color: '#fffde7', emissive: new Color('#fff3c4'), emissiveIntensity: 0.1 }),
  taillight: new MeshStandardMaterial({ color: '#d32f2f', emissive: new Color('#ff1744'), emissiveIntensity: 0 }),
  // The Drive-In's film plays unlit so it reads like a lit screen, a touch
  // dimmer by day when the sun washes it out.
  screen: new MeshBasicMaterial({ map: movieTex(), toneMapped: false }),
  // Glows lie flat on the ground, so they get a depth nudge to never flicker against it.
  pool: new MeshBasicMaterial({ map: glowTex(), color: '#ffcf7a', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false, ...decal() }),
  beam: new MeshBasicMaterial({ map: glowTex(), color: '#fff2c0', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false, ...decal() }),
}

export function applyNight(n: number) {
  glowMats.window.emissiveIntensity = n * 1.3
  glowMats.bulb.emissiveIntensity = 0.2 + n * 2.2
  glowMats.headlight.emissiveIntensity = 0.1 + n * 2
  glowMats.taillight.emissiveIntensity = n * 1.2
  glowMats.screen.color.setScalar(0.72 + n * 0.16)
  glowMats.pool.opacity = n * 0.75
  glowMats.beam.opacity = n * 0.5
  for (const m of [glowMats.pool, glowMats.beam]) m.visible = n > 0.02
}
