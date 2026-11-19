import { describe, expect, it } from 'vitest'
import { BODY, buildWalkGraph, detour, type Pt, type WalkBuilding } from './walkGraph'
import { START_LAND } from './data'
import { footprintOf, furnitureOf } from './streetFurniture'
import { DIRS, toWorld } from '../scene/grid'
import { layoutRoads } from '../scene/traffic/layout'

// Distance from p to the segment a-b.
function toSeg(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const l2 = dx * dx + dz * dz
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz)
}
const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
const meets = (a: Pt, b: Pt, c: Pt, d: Pt) => cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0
// Distance from the segment a-b to a convex footprint (0 when it runs through it).
function clearance(a: Pt, b: Pt, poly: Pt[]) {
  const inside = (p: Pt) => poly.every((q, i) => cross(q, poly[(i + 1) % poly.length], p) >= 0) || poly.every((q, i) => cross(q, poly[(i + 1) % poly.length], p) <= 0)
  if (inside(a) || inside(b)) return 0
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const c = poly[i]
    const d = poly[(i + 1) % poly.length]
    if (meets(a, b, c, d)) return 0
    best = Math.min(best, toSeg(c, a, b), toSeg(d, a, b), toSeg(a, c, d), toSeg(b, c, d))
  }
  return best
}

// Every footprint in a town, in world coordinates.
function allFeet(roads: Set<string>) {
  const layout = layoutRoads(roads)
  const out: Pt[][] = []
  for (const t of layout.tiles.values()) {
    const xing = DIRS.map(([dx, dz]) => !t.junction && !!layout.tiles.get(`${t.x + dx},${t.z + dz}`)?.junction)
    const [wx, wz] = toWorld(t.x, t.z)
    for (const f of furnitureOf({ ...t, xing })) out.push(footprintOf(f).map(([x, z]) => [wx + x, wz + z] as Pt))
  }
  return out
}

// The closest any walking path in the town comes to a lamp, hydrant or piece of furniture.
function closest(roads: Set<string>, buildings: WalkBuilding[]) {
  const g = buildWalkGraph(roads, buildings, START_LAND)
  const feet = allFeet(roads)
  const pos = (i: number) => {
    const n = g.nodes[i]
    return n.kind === 'v' ? n.pos : n.center
  }
  let worst = Infinity
  g.adj.forEach((edges, a) => {
    for (const e of edges) {
      if (e.cross) continue
      const way = [pos(a), ...e.pts, pos(e.to)]
      for (let i = 1; i < way.length; i++) for (const f of feet) {
        const c = clearance(way[i - 1], way[i], f)
        worst = Math.min(worst, c)
      }
    }
  })
  return { worst, feet: feet.length }
}

describe('townspeople and sidewalk furniture', () => {
  it('steps round a lamp post in the way', () => {
    const post: Pt[] = [[0.9, -0.1], [1.1, -0.1], [1.1, 0.1], [0.9, 0.1]]
    const pts = detour([0, 0], [2, 0], [post])
    expect(pts.length).toBeGreaterThan(0)
    const way: Pt[] = [[0, 0], ...pts, [2, 0]]
    for (let i = 1; i < way.length; i++) expect(clearance(way[i - 1], way[i], post)).toBeGreaterThanOrEqual(BODY - 1e-9)
  })

  it('walks straight on when nothing is in the way', () => {
    expect(detour([0, 0], [2, 0], [[[0.9, 0.5], [1.1, 0.5], [1.1, 0.7], [0.9, 0.7]]])).toEqual([])
  })

  // A starter-sized loop with a cross street, and a big grid of streets with an avenue (a road
  // two tiles wide), so every lamp, hydrant and furniture case in furnitureOf turns up.
  const loop = new Set<string>()
  for (let i = 4; i <= 19; i++) for (const [x, z] of [[i, 4], [i, 19], [4, i], [19, i], [i, 11]]) loop.add(`${x},${z}`)
  const grid = new Set<string>()
  for (let i = 0; i <= 40; i++) for (const c of [0, 6, 12, 18, 24, 30, 36]) {
    grid.add(`${i},${c}`)
    grid.add(`${c},${i}`)
  }
  for (let i = 0; i <= 40; i++) grid.add(`${i},${13}`)
  for (const [name, roads] of [['starter loop', loop], ['big grid with an avenue', grid]] as const) {
    it(`keeps every path in the ${name} clear of every lamp, hydrant and piece of furniture`, () => {
      const { worst, feet } = closest(roads, [])
      expect(feet).toBeGreaterThan(10)
      expect(worst).toBeGreaterThanOrEqual(BODY - 1e-6)
    })
  }
})
