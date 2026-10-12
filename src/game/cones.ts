import type { Kart, Track } from './kart'

// Traffic cones lining the inside of a kart track's tightest bends. Pure looks:
// a kart that clips one sends it tumbling and loses nothing, and the cone pops
// back on its spot a few seconds later.

export type SmashCone = {
  hx: number; hz: number // its spot
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  rx: number; rz: number; spin: number // tumble
  hit: number // race time it was knocked, -1 while it stands
}

const CORNERS = 3 // bends that get cones
const PER = 5 // cones per bend
const GAP = 2 // track samples between cones
const CLEAR = 3.5 // keep this far from pads, ramps and crates
export const CONE_REACH = 0.95 // kart centre to cone that knocks it
const GRAVITY = 30
const BACK = 6 // seconds until a knocked cone is back

export function placeCones(t: Track): SmashCone[] {
  // The sharpest bends, each a fair way round the lap from the others.
  const order = Array.from({ length: t.n }, (_, i) => i).sort((a, b) => Math.abs(t.curve[b]) - Math.abs(t.curve[a]))
  const apexes: number[] = []
  const far = t.n / (CORNERS * 2)
  for (const i of order) {
    if (apexes.length >= CORNERS) break
    if (apexes.every((a) => Math.min(Math.abs(a - i), t.n - Math.abs(a - i)) > far)) apexes.push(i)
  }
  const busy = [...t.boosts, ...t.ramps, ...t.crates]
  const out: SmashCone[] = []
  for (const a of apexes) {
    const side = Math.sign(t.curve[a]) || 1
    for (let k = 0; k < PER; k++) {
      const i = (a + (k - (PER - 1) / 2) * GAP + t.n) % t.n
      const off = side * (t.half - 0.45)
      const x = t.x[i] + t.nx[i] * off
      const z = t.z[i] + t.nz[i] * off
      if (busy.some((b) => Math.hypot(b.x - x, b.z - z) < CLEAR)) continue
      out.push({ hx: x, hz: z, x, y: 0, z, vx: 0, vy: 0, vz: 0, rx: 0, rz: 0, spin: 0, hit: -1 })
    }
  }
  return out
}

// Knock, fly and put back. `now` is the race clock. Returns how many were knocked this step (for a sound).
export function stepCones(cones: SmashCone[], karts: Kart[], now: number, dt: number): number {
  let knocked = 0
  for (const c of cones) {
    if (c.hit < 0) {
      const k = karts.find((k) => k.y < 1 && Math.hypot(k.x - c.x, k.z - c.z) < CONE_REACH)
      if (!k) continue
      const speed = Math.hypot(k.vx, k.vz)
      // Away from the kart, along its travel, and up.
      const ax = c.x - k.x, az = c.z - k.z
      const d = Math.hypot(ax, az) || 1
      c.vx = k.vx * 0.7 + (ax / d) * 3
      c.vz = k.vz * 0.7 + (az / d) * 3
      c.vy = 4 + speed * 0.25
      c.spin = 6 + speed * 0.4
      c.hit = now
      knocked++
      continue
    }
    if (now - c.hit > BACK) {
      Object.assign(c, { x: c.hx, z: c.hz, y: 0, vx: 0, vy: 0, vz: 0, rx: 0, rz: 0, spin: 0, hit: -1 })
      continue
    }
    c.vy -= GRAVITY * dt
    c.x += c.vx * dt
    c.y += c.vy * dt
    c.z += c.vz * dt
    c.rx += c.spin * dt
    c.rz += c.spin * 0.6 * dt
    if (c.y <= 0) {
      // Bounce, then lie on its side.
      c.y = 0
      c.vy = Math.abs(c.vy) > 2 ? -c.vy * 0.35 : 0
      c.vx *= 0.6
      c.vz *= 0.6
      c.spin *= 0.5
      if (c.vy === 0) {
        c.rx = Math.PI / 2
        c.spin = 0
      }
    }
  }
  return knocked
}

