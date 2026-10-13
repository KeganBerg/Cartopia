import type { Track } from './kart'

// Road obstacles for kart races that have them (the Grand Prix's reversed rounds and
// Bumper Blast). Each one slows a kart down but never stops it:
// boxes: a pile blocking one lane; driving into it is a hard stop-and-shove.
// pothole: a jolt that bounces the kart and costs a fifth of its speed.
// ice: a slick patch; the kart slides wide for a moment after crossing it.
// glass: two workers carry a pane of glass across the road on a loop; hit it and it
// shatters (cartoon style) for a quarter of your speed.
// Everything is placed from the track itself, so a reversed circuit gets its own layout.

export type ObstacleKind = 'boxes' | 'pothole' | 'ice' | 'glass'
// i: track sample; off: across the road (+ left); w: width across; l: length along.
export type Obstacle = { kind: ObstacleKind; i: number; off: number; x: number; z: number; h: number; w: number; l: number }

const SPOTS = [0.15, 0.27, 0.4, 0.53, 0.66, 0.8, 0.9]
const KINDS: ObstacleKind[] = ['boxes', 'pothole', 'ice', 'glass', 'boxes', 'pothole', 'ice']
const CLEAR = 10 // keep this far (in track samples) from pads, ramps and crates

export function placeObstacles(t: Track, many = false): Obstacle[] {
  const busy = [...t.boosts.map((p) => p.i), ...t.ramps.map((p) => p.i), ...t.crates.map((c) => c.i)]
  const gap = (a: number, b: number) => Math.min(Math.abs(a - b), t.n - Math.abs(a - b))
  const out: Obstacle[] = []
  const spots = many ? [...SPOTS, ...SPOTS.map((s) => s + 0.06)] : SPOTS.slice(0, 4)
  spots.forEach((s, n) => {
    let i = Math.round(s * t.n) % t.n
    // Slide along until clear of the track's own features.
    for (let tries = 0; tries < 40 && busy.some((b) => gap(b, i) < CLEAR); tries++) i = (i + 3) % t.n
    if (busy.some((b) => gap(b, i) < CLEAR) || out.some((o) => gap(o.i, i) < CLEAR)) return
    const kind = KINDS[n % KINDS.length]
    const side = n % 2 ? 1 : -1
    const half = t.half
    const [off, w, l] =
      // The pile runs out to the barrier, so nobody gets wedged behind it.
      kind === 'boxes' ? [side * (half - 0.15), 4.4, 1.3]
      : kind === 'pothole' ? [side * 1.1, 1.6, 1.6]
      : kind === 'ice' ? [0, half * 1.5, 6]
      : [0, half * 2 + 2, 1]
    out.push({ kind, i, off, x: t.x[i] + t.nx[i] * off, z: t.z[i] + t.nz[i] * off, h: Math.atan2(t.tx[i], t.tz[i]), w, l })
  })
  return out
}

// A point relative to an obstacle's centre: along its heading and across the road (+ left).
export function local(o: Obstacle, t: Track, x: number, z: number) {
  const dx = x - o.x, dz = z - o.z
  return { fwd: dx * Math.sin(o.h) + dz * Math.cos(o.h), side: dx * t.nx[o.i] + dz * t.nz[o.i] }
}

// The glass crossing: the pane's place across the road (+ left of the centre) at race
// time `now`, or null while the workers wait at the roadside. They take CROSS seconds to
// cross, then rest; `cycle` counts the crossings so a shattered pane comes back whole.
const CROSS = 5
const REST = 3
export const GLASS_W = 2
export function glassAt(o: Obstacle, now: number): { across: number; cycle: number } | null {
  const period = CROSS + REST
  const cycle = Math.floor(now / period)
  const p = (now - cycle * period) / CROSS
  if (p > 1) return null
  // Alternate directions so it reads as a there-and-back trip.
  const reach = o.w / 2
  const across = (cycle % 2 ? 1 : -1) * (reach - p * reach * 2)
  return { across, cycle }
}
