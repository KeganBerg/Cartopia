import { createContext, useContext, useMemo } from 'react'
import { rand } from './RaceVenues'
import type { Track } from '../game/kart'

// Where scenery can go round a kart circuit: clear of the track by a margin, along either
// side at a given offset from the barrier, and which side is the outside of a bend.
export function useSpots(t: Track) {
  return useMemo(() => {
    const cell = 8
    const grid = new Map<string, number[]>()
    for (let i = 0; i < t.n; i++) {
      const k = `${Math.floor(t.x[i] / cell)},${Math.floor(t.z[i] / cell)}`
      const l = grid.get(k) ?? []
      l.push(i)
      grid.set(k, l)
    }
    const clearOf = (x: number, z: number, d: number) => {
      const r = Math.ceil(d / cell)
      const cx = Math.floor(x / cell), cz = Math.floor(z / cell)
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (const i of grid.get(`${cx + a},${cz + b}`) ?? []) if ((t.x[i] - x) ** 2 + (t.z[i] - z) ** 2 < d * d) return false
      return true
    }
    const along = (step: number, off: number, side: -1 | 1, clear: number, seed: number, jitter = 0) => {
      const r = rand(seed)
      const out: { x: number; z: number; ry: number; i: number; r: () => number }[] = []
      for (let s = r() * step; s < t.n; s += step * (0.75 + r() * 0.5)) {
        const i = Math.floor(s)
        const o = side * (t.wall + off + r() * jitter)
        const x = t.x[i] + t.nx[i] * o, z = t.z[i] + t.nz[i] * o
        if (!clearOf(x, z, t.wall + clear)) continue
        // Facing back toward the track.
        out.push({ x, z, ry: Math.atan2(-t.nx[i] * side, -t.nz[i] * side), i, r })
      }
      return out
    }
    // The bend's outside: + left when the track turns right.
    const outside = (i: number) => (t.curve[i] < 0 ? 1 : -1) as -1 | 1
    // Inside the loop (the infield) or outside it: count centre-line crossings of a ray to +x.
    const inside = (x: number, z: number) => {
      let c = false
      for (let i = 0, j = t.n - 1; i < t.n; j = i++) {
        if ((t.z[i] > z) !== (t.z[j] > z) && x < ((t.x[j] - t.x[i]) * (z - t.z[i])) / (t.z[j] - t.z[i]) + t.x[i]) c = !c
      }
      return c
    }
    // Up to `count` spots at least `need` from the centre line and `gap` from each other (and
    // from anything in `taken`), inside or outside the loop, within `reach` of the middle.
    const open = (o: { need: number; count: number; seed: number; gap?: number; where?: 'in' | 'out'; reach?: number; taken?: { x: number; z: number; r: number }[] }) => {
      const r = rand(o.seed)
      const out: { x: number; z: number; r: () => number }[] = []
      const reach = o.reach ?? 110
      const gap = o.gap ?? o.need
      for (let k = 0; k < o.count * 60 && out.length < o.count; k++) {
        const x = (r() - 0.5) * 2 * reach, z = (r() - 0.5) * 2 * reach
        if (!clearOf(x, z, t.wall + o.need)) continue
        if (o.where && inside(x, z) !== (o.where === 'in')) continue
        if (out.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < gap * gap)) continue
        if (o.taken?.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < (p.r + o.need) ** 2)) continue
        out.push({ x, z, r })
      }
      return out
    }
    return { clearOf, along, outside, inside, open }
  }, [t])
}

// A point `lx` across and `lz` toward the track from a spot facing the track.
export const local = (o: { x: number; z: number; ry: number }, lx: number, lz: number) => ({
  x: o.x + lx * Math.cos(o.ry) + lz * Math.sin(o.ry),
  z: o.z - lx * Math.sin(o.ry) + lz * Math.cos(o.ry),
})

export type FanZone = { x: number; z: number; ry: number; i: number }
export const ZONE_R = 9 // keep other scenery this far from a fan zone's middle
export const nearZone = (zones: FanZone[], x: number, z: number, r = ZONE_R) => zones.some((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < r * r)

// Fan zones: terraces just behind the barrier on the outside of bends, where the town or
// canyon folk stand and cheer. Shared so every scenery layer can keep out of them. None at
// the harbour, where the fans watch from boats.
export function useFanZones(t: Track): FanZone[] {
  const s = useSpots(t)
  return useMemo(() => {
    if (t.def.theme === 'docks') return []
    // Keep clear of the canyon's roadside stop (same pick as the scenery's).
    const avoid = t.def.theme === 'desert' ? s.along(200, 5, 1, 5, 89).slice(0, 1) : []
    const out: FanZone[] = []
    const K = 16
    for (let k = 0; k < K && out.length < 4; k++) {
      const i = Math.floor(((k + 0.4) / K) * t.n)
      // Not on the start straight, which has the grandstands and pits.
      if (i < 24 || i > t.n - 50) continue
      const side = s.outside(i)
      const o = side * (t.wall + 4.6)
      const z0 = { x: t.x[i] + t.nx[i] * o, z: t.z[i] + t.nz[i] * o, ry: Math.atan2(-t.nx[i] * side, -t.nz[i] * side) }
      const ok = [-8.5, -4, 0, 4, 8.5].every((lx) => [-2.8, 1.8].every((lz) => {
        const p = local(z0, lx, lz)
        return s.clearOf(p.x, p.z, t.wall + 2.2)
      }))
      if (!ok || out.some((q) => (q.x - z0.x) ** 2 + (q.z - z0.z) ** 2 < 32 * 32) || avoid.some((a) => (a.x - z0.x) ** 2 + (a.z - z0.z) ** 2 < 18 * 18)) continue
      out.push({ ...z0, i })
    }
    return out
  }, [t, s])
}

// How far away cheering fans are still drawn (less on a phone: a fan there is a few pixels).
export const FansFar = createContext(150)
export const useFansFar = () => useContext(FansFar)
// How many frames each crowd move lasts (2 on a phone: fans wave at half the frame rate).
export const FansEvery = createContext(1)
export const useFansEvery = () => useContext(FansEvery)
