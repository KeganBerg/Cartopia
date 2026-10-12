import { AdditiveBlending, Color, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { danceFloorTex, glowTex, windowGlowTex, windowTex } from './textures'
import { decal } from './layers'
import { movieTex } from './movie'
import { closingGlow, hoursUniforms } from './closingTime'
import { townHour } from '../game/clock'

export { dayPhase, nightAmount, duskAmount } from '../game/clock'

// Shared materials whose glow follows the time of day. One instance each
// keeps the per-frame update to a handful of objects.
export const glowMats = {
  // Three panes per window, each switched off on its own at closing time.
  window: closingGlow(new MeshStandardMaterial({ map: windowTex(), emissiveMap: windowGlowTex(), emissive: new Color('#ffc46a'), emissiveIntensity: 0 }), [3, 1], 'window'),
  bulb: new MeshStandardMaterial({ color: '#fff4dc', emissive: new Color('#ffbb55'), emissiveIntensity: 0.2 }),
  headlight: new MeshStandardMaterial({ color: '#fffde7', emissive: new Color('#fff3c4'), emissiveIntensity: 0.1 }),
  taillight: new MeshStandardMaterial({ color: '#d32f2f', emissive: new Color('#ff1744'), emissiveIntensity: 0 }),
  // The Drive-In's film plays unlit so it reads like a lit screen, a touch
  // dimmer by day when the sun washes it out.
  screen: new MeshBasicMaterial({ map: movieTex(), toneMapped: false }),
  // Glows lie flat on the ground, so they get a depth nudge to never flicker against it.
  pool: new MeshBasicMaterial({ map: glowTex(), color: '#ffc070', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false, ...decal() }),
  beam: new MeshBasicMaterial({ map: glowTex(), color: '#fff2c0', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false, ...decal() }),
  // Nightclub neon: dark tubes by day that light up after dusk.
  neonPink: neon('#ff2bd6'),
  neonCyan: neon('#00e5ff'),
  neonViolet: neon('#b04dff'),
  danceFloor: new MeshStandardMaterial({ map: danceFloorTex(false, 2, 1), emissiveMap: danceFloorTex(true, 2, 1), emissive: new Color('#ffffff'), emissiveIntensity: 0, roughness: 0.35 }),
}

function neon(c: string) {
  return new MeshStandardMaterial({ color: new Color(c).multiplyScalar(0.35), emissive: new Color(c), emissiveIntensity: 0.05, toneMapped: false })
}

// Other things that follow the night (signs drawn elsewhere register here and
// are brought up to date straight away).
const hooks = new Set<(n: number) => void>()
let nightNow = 0
export function onNight(f: (n: number) => void) {
  hooks.add(f)
  f(nightNow)
}

// `gloom` (0..1) is daytime darkness from bad weather: drivers switch their
// headlights on and street lamps come up, though windows and neon wait for night.
export function applyNight(n: number, gloom = 0) {
  const lamps = Math.max(n, gloom * 0.8)
  // Windows warm up a little in gloomy weather too, for a cosy lit-from-inside town.
  glowMats.window.emissiveIntensity = Math.max(n, gloom * 0.55) * 1.45
  glowMats.bulb.emissiveIntensity = 0.2 + lamps * 2.2
  glowMats.headlight.emissiveIntensity = 0.1 + Math.max(n, gloom) * 2
  glowMats.taillight.emissiveIntensity = Math.max(n, gloom) * 1.2
  glowMats.screen.color.setScalar(0.72 + n * 0.16)
  glowMats.pool.opacity = lamps * 0.75
  glowMats.beam.opacity = Math.max(n, gloom) * 0.5
  for (const m of [glowMats.pool, glowMats.beam]) m.visible = m.opacity > 0.01
  for (const m of [glowMats.neonPink, glowMats.neonCyan, glowMats.neonViolet]) m.emissiveIntensity = 0.05 + n * 1.5
  glowMats.danceFloor.emissiveIntensity = n * 1.3
  hoursUniforms.uHour.value = townHour()
  hoursUniforms.uNight.value = n
  nightNow = n
  for (const f of hooks) f(n)
}
