import { describe, expect, it } from 'vitest'
import { buildWalkGraph, findPath, stepsFor, type Pt, type WalkBuilding } from './walkGraph'
import { buildingDef, START_LAND } from './data'
import { toTile, toWorld } from '../scene/grid'
import { layoutRoads } from '../scene/traffic/layout'

// The starter town: a loop road with a cross street.
const roads = new Set<string>()
for (let i = 4; i <= 19; i++) for (const [x, z] of [[i, 4], [i, 19], [4, i], [19, i], [i, 11]]) roads.add(`${x},${z}`)
let n = 0
const b = (def: string, x: number, z: number, rot?: number): WalkBuilding => ({ uid: `u${n++}`, def, x, z, rot })
const buildings = [
  b('showroom', 9, 9), b('garage', 13, 9), b('gas', 6, 3), b('pizza', 10, 3), b('pizza', 12, 3),
  b('pizza', 17, 10), b('house', 5, 9), b('house', 6, 9), b('house', 7, 9), b('house', 5, 10),
  b('house', 15, 17), b('house', 16, 17), b('house', 17, 17), b('tree', 5, 7), b('tree', 16, 9),
  b('bench', 8, 13, 2), b('fountain', 12, 13), b('pond', 14, 13), b('donut', 9, 20, 2),
]
const g = buildWalkGraph(roads, buildings, START_LAND)

const solid = new Map<string, string>()
for (const o of buildings) {
  const d = buildingDef(o.def)
  if (d.kind === 'decor' && d.w === 1) continue
  const [w, h] = (o.rot ?? 0) % 2 ? [d.h, d.w] : [d.w, d.h]
  for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < h; dz++) solid.set(`${o.x + dx},${o.z + dz}`, o.uid)
}

function walk(from: WalkBuilding, to: WalkBuilding) {
  const route = findPath(g, g.buildingNode.get(from.uid)!, g.byKey.get(`b${to.uid}`) ?? g.byKey.get(`t${to.x},${to.z}`)!)
  expect(route).not.toBeNull()
  const start = route!.edges[0].pts[0]
  return { steps: stepsFor(g, route!, start), start }
}

describe('walking network', () => {
  const pairs: [WalkBuilding, WalkBuilding][] = [
    [buildings[7], buildings[3]], // house tucked behind another house -> pizza across the street
    [buildings[10], buildings[5]], // house on the south road -> pizza on the east side
    [buildings[6], buildings[16]], // house -> fountain in the middle block
    [buildings[11], buildings[18]], // house -> donut shop outside the loop
    [buildings[8], buildings[17]], // house -> duck pond
  ]

  it('never walks through a building or across a road away from a crosswalk', () => {
    for (const [from, to] of pairs) {
      const { steps, start } = walk(from, to)
      let at: Pt = start
      for (const s of steps) {
        const len = Math.hypot(s.p[0] - at[0], s.p[1] - at[1])
        for (let k = 0; k <= len / 0.05; k++) {
          const f = len ? (k * 0.05) / len : 0
          const x = at[0] + (s.p[0] - at[0]) * f
          const z = at[1] + (s.p[1] - at[1]) * f
          const [tx, tz] = toTile(x, z)
          const owner = solid.get(`${tx},${tz}`)
          // Inside a lot is only allowed right at its own door (the lot edge).
          if (owner) {
            const [cx, cz] = toWorld(tx, tz)
            expect(owner === from.uid || owner === to.uid).toBe(true)
            expect(Math.max(Math.abs(x - cx), Math.abs(z - cz))).toBeGreaterThan(0.99)
          }
          // On a road tile: keep to the sidewalk unless this leg is a crosswalk.
          if (roads.has(`${tx},${tz}`) && !s.cross) {
            const [cx, cz] = toWorld(tx, tz)
            const edge = Math.max(Math.abs(x - cx), Math.abs(z - cz))
            expect(edge).toBeGreaterThan(0.55)
          }
        }
        at = s.p
      }
    }
  })

  it('crosses the street on zebra crossings', () => {
    const { steps } = walk(buildings[10], buildings[5])
    expect(steps.some((s) => s.cross)).toBe(true)
  })

  it("doesn't stroll through a covered lot from a newer build", () => {
    const g2 = buildWalkGraph(roads, [...buildings, b('crewhouse', 10, 15)], START_LAND)
    expect(g2.byKey.has('t10,15')).toBe(false)
    expect(g.byKey.has('t10,15')).toBe(true)
  })

  it('reaches every house from every other house', () => {
    const houses = buildings.filter((o) => o.def === 'house')
    for (const a of houses) for (const c of houses) if (a !== c) expect(findPath(g, g.buildingNode.get(a.uid)!, g.buildingNode.get(c.uid)!)).not.toBeNull()
  })

  it('crosses a divided avenue on both halves of the zebra crossing', () => {
    // An east-west avenue (rows 10 and 11) with a street crossing it at x = 11.
    const ave = new Set<string>()
    for (let x = 2; x <= 20; x++) ave.add(`${x},10`).add(`${x},11`)
    for (let z = 2; z <= 20; z++) ave.add(`11,${z}`)
    const north = b('house', 5, 9)
    const south = b('house', 5, 12, 2)
    const ga = buildWalkGraph(ave, [north, south], START_LAND)
    const route = findPath(ga, ga.buildingNode.get(north.uid)!, ga.buildingNode.get(south.uid)!)
    expect(route).not.toBeNull()
    const crossings = route!.edges.filter((e) => e.cross).map((e) => e.cross!.tile)
    // One leg over each side of the avenue, on the same zebra crossing (the
    // nearest is at the avenue's west end, where it meets the end junction).
    expect(crossings.sort()).toEqual(['3,10', '3,11'])
    const layout = layoutRoads(ave)
    expect(layout.tiles.get('2,10')!.junction).toBe(true)
  })
})

describe('solid decorations', () => {
  it('keeps walkers off hedges, fences and the finish arch, but not benches', () => {
    const hedges = [b('hedge', 6, 13), b('fence', 7, 13), b('arch', 6, 14), b('bench', 7, 14)]
    const g2 = buildWalkGraph(roads, [...buildings, ...hedges], START_LAND)
    for (const o of hedges.slice(0, 3)) {
      expect(g2.byKey.has(`t${o.x},${o.z}`)).toBe(false)
      expect(g2.byKey.has(`b${o.uid}`)).toBe(false)
    }
    expect(g2.byKey.has('t7,14')).toBe(true)
  })
})
