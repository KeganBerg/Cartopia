import type { Vector3 } from 'three'

// Race camera helpers: frame-rate independent smoothing, eased hand-offs between shots, and
// the cinematic angles the race cuts to once the player's car is in top gear (nothing left
// to shift, so the camera gets to show off): a low chase off the rear bumper, a tracking
// shot from the kerb ahead looking back at both cars, and a head-on shot low on the road ahead.

// Share of the way to move toward a target this frame: `rate` per second, whatever the frame rate.
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt)
export const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

export type Angle = 'low' | 'side' | 'front'
export const ANGLES: Angle[] = ['low', 'side', 'front']
export const ANGLE_TIME = 1.6 // seconds on each angle
export const CHASE_GAP = 2.2 // seconds back on the chase view between runs of angles
export const TOP_HOLD = 0.5 // seconds in top gear before the first cut
export const LINE_CLEAR = 1.1 // back on the chase view this long before the line
// Field of view each angle wants, on top of the chase view's.
export const ANGLE_FOV: Record<Angle, number> = { low: 6, side: -4, front: 2 }

export type Director = { angle: Angle | null; t: number; next: number; top: number; gap: number }
export const freshDirector = (): Director => ({ angle: null, t: 0, next: 0, top: 0, gap: 0 })

// Picks the shot for this frame. `inTop`: the player's car is in top gear; `eta`: seconds
// until it reaches the line; `allowed`: no replay, hero shot or reduced motion in the way.
// Every change is a cut. Returns true on a frame that cut.
export function direct(d: Director, dt: number, inTop: boolean, eta: number, allowed: boolean): boolean {
  d.top = inTop ? d.top + dt : 0
  const was = d.angle
  if (!allowed || !inTop || eta < LINE_CLEAR) {
    d.angle = null
    d.gap = 0
    return was !== null
  }
  if (d.angle) {
    d.t += dt
    if (d.t < ANGLE_TIME) return false
    // On to the next angle if it can play out in full before the line, else back to the chase.
    const i = ANGLES.indexOf(d.angle) + 1
    d.angle = i < ANGLES.length && eta > ANGLE_TIME + LINE_CLEAR ? ANGLES[i] : null
    d.t = 0
    d.gap = 0
    return true
  }
  d.gap += dt
  if (d.top >= TOP_HOLD && (d.next === 0 || d.gap >= CHASE_GAP) && eta > ANGLE_TIME + LINE_CLEAR) {
    d.angle = ANGLES[0]
    d.t = 0
    d.next++
    return true
  }
  return false
}

// Where an angle puts the camera. The player's car is centred at (x, 0, z), `nose` from its
// centre to its front bumper; `road` is the half width of the street (the camera stays on the
// tarmac, clear of the barriers). Tall phone screens sit a touch higher and further out so the
// car still fills the narrow frame. Writes into `pos` and `at`.
export function angleCam(a: Angle, t: number, x: number, z: number, nose: number, road: number, tall: boolean, pos: Vector3, at: Vector3) {
  const k = Math.min(1, t / ANGLE_TIME)
  if (a === 'low') {
    // Down at bumper height behind the car, creeping in as it pulls away.
    const back = nose * (tall ? 3.4 : 2.9) - k * nose * 0.4
    pos.set(x + 0.18, tall ? 0.42 : 0.32, z - back)
    at.set(x - 0.05, 0.3, z + 6)
  } else if (a === 'side') {
    // On the kerb ahead of the car looking back across both lanes as they come through.
    pos.set(road - 0.22, tall ? 1.05 : 0.8, z + nose * (tall ? 6.5 : 5) - k * nose * 1.2)
    at.set(x * 0.3, 0.3, z - nose * 1.2)
  } else {
    // Low on the road ahead, the car charging straight at the lens with the rival behind it.
    pos.set(x + 0.08, tall ? 0.42 : 0.36, z + nose * (tall ? 5.6 : 4.6) - k * nose * 1.4)
    at.set(x - 0.05, 0.32, z - nose)
  }
}
