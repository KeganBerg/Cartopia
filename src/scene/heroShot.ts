import type { Vector3 } from 'three'
import { reducedMotion } from '../game/fx'

// The finish hero shot: as the player's own car runs out past the line the camera leaves
// the chase view for two quick moves round it (a low sweep from the front corner to its
// flank, then a rise up over the back), so the paint, skin and mods get a look-in on every
// finish. The race screens hold their result card while it plays; a tap sets `skip`.
export const HERO_TIME = 2.2 // seconds
export const heroShot = { on: false, skip: false }
export const resetHero = (): void => void Object.assign(heroShot, { on: false, skip: false })
// Off with reduced motion (it's a camera move nobody asked for), or once the player has tapped past it.
export const heroWanted = () => !heroShot.skip && !reducedMotion()

const ease = (t: number) => t * t * (3 - 2 * t)
const mix = (a: number, b: number, t: number) => a + (b - a) * t

// Where the camera sits `t` seconds into the shot. The car is at (x, y, z) with its nose along
// (sin h, cos h) and `len` long; `side` (±1) picks the flank, `room` caps how far out
// sideways and back it may go (a drag strip is narrow). Writes into `pos` and `at`.
export function heroCam(t: number, x: number, y: number, z: number, h: number, len: number, side: number, room: number, pos: Vector3, at: Vector3) {
  const k = Math.min(1, Math.max(0, t / HERO_TIME))
  // a: angle round from the nose (0 dead ahead, π dead behind); r and up in car lengths.
  let a: number, r: number, up: number
  if (k < 0.55) {
    const e = ease(k / 0.55)
    a = mix(0.6, 1.5, e); r = mix(1.9, 1.6, e); up = mix(0.2, 0.3, e)
  } else {
    const e = ease((k - 0.55) / 0.45)
    a = mix(1.5, 2.55, e); r = mix(1.6, 2.4, e); up = mix(0.3, 0.95, e)
  }
  const d = Math.min(r * len, room)
  const fx = Math.sin(h), fz = Math.cos(h)
  const sx = Math.cos(h) * side, sz = -Math.sin(h) * side
  const ca = Math.cos(a), sa = Math.sin(a)
  pos.set(x + (fx * ca + sx * sa) * d, y + up * len, z + (fz * ca + sz * sa) * d)
  at.set(x + fx * len * 0.1, y + len * 0.14, z + fz * len * 0.1)
}
