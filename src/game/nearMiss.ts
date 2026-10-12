// Near misses in a kart race: another kart slips past the player's (or the player past it) close
// enough to feel it, without touching. A call on screen and a buzz; it pays nothing.
import { KART_R, type Kart } from './kart'

// Centre to centre: closer than NEAR_R is close; closer than NEAR_TOUCH was a rub, not a miss.
export const NEAR_R = KART_R * 2 + 0.9
export const NEAR_TOUCH = KART_R * 2 + 0.15
// The player has to be moving properly (metres per second), and calls don't come too often.
export const NEAR_SPEED = 9
export const NEAR_GAP = 3

type Body = Pick<Kart, 'id' | 'x' | 'z' | 'y' | 'vx' | 'vz' | 'h' | 'spin'>
// close: karts inside NEAR_R, with which side of the player they came in on (ahead 1, behind -1)
// and the nearest they've been. last: when the last call came.
export type NearMiss = { close: Map<number, { side: number; min: number }>; last: number }
export const nearMiss = (): NearMiss => ({ close: new Map(), last: -Infinity })

// Called every frame at race time t: true when a kart has just slipped past without touching.
export function stepNearMiss(s: NearMiss, me: Body, others: Body[], t: number) {
  const fx = Math.sin(me.h), fz = Math.cos(me.h)
  const fast = Math.hypot(me.vx, me.vz) >= NEAR_SPEED && me.spin <= 0
  let call = false
  for (const o of others) {
    if (o.id === me.id) continue
    const dx = o.x - me.x, dz = o.z - me.z
    const d = Math.hypot(dx, dz)
    const side = dx * fx + dz * fz >= 0 ? 1 : -1
    const p = s.close.get(o.id)
    if (d < NEAR_R && Math.abs(o.y - me.y) < 0.8) {
      if (p) p.min = Math.min(p.min, d)
      else s.close.set(o.id, { side, min: d })
      continue
    }
    if (!p) continue
    s.close.delete(o.id)
    // Out the other side from where it came in, never touching, at speed.
    if (side !== p.side && p.min >= NEAR_TOUCH && fast && t - s.last >= NEAR_GAP) {
      s.last = t
      call = true
    }
  }
  return call
}
