import { buildingDef, PLOT } from './data'
import { toWorld } from '../scene/grid'
import { turnOf } from './placement'
import { layoutRoads } from '../scene/traffic/layout'

// The walking network for townspeople. Pedestrians keep to the sidewalks that
// line every road, cross only on the zebra crossings painted next to
// intersections, and step off the sidewalk only onto open lawn or into small
// decorations (trees, benches, fountains, flower beds). Buildings are never
// walked through: a building is only ever the start or end of a trip.

export type Pt = [number, number] // world x, z
type Tile = [number, number]
export type WalkBuilding = { uid: string; def: string; x: number; z: number; rot?: number }

// Tile step for each side, indexed like building turns: 0 faces south (+z).
export const SIDES: Tile[] = [[0, 1], [1, 0], [0, -1], [-1, 0]]
const SIDEWALK = 0.2 // middle of the 0.4-wide sidewalk strip, from the road's edge
const ZEBRA = 0.32 // crosswalk stripes sit this far in from the intersection
// Lawn is slower going than sidewalk, so people only cut across when it saves a real detour.
const LAWN = 2.5
const TILE_COST = 2 * LAWN

// SIDES index -> grid DIRS index (east, west, south, north).
const SIDE_TO_DIR = [2, 0, 3, 1]

const key = (x: number, z: number) => `${x},${z}`
const owns = (land: string[], x: number, z: number) => land.includes(key(Math.floor(x / PLOT), Math.floor(z / PLOT)))
const lotSize = (def: string, rot?: number): Tile => {
  const d = buildingDef(def)
  return (rot ?? 0) % 2 ? [d.h, d.w] : [d.w, d.h]
}
// World position of the north-west corner of a tile.
const corner = (i: number, j: number): Pt => toWorld(i - 0.5, j - 0.5)

// A crosswalk being walked across. Cars can look these up to yield.
// `tile` and `dir` (grid DIRS order: east, west, south, north) name it the way
// the traffic sim's crossingSignal does.
export type Crossing = { id: string; mid: Pt; tile: string; dir: number }

// How many people are on each crosswalk right now, keyed by crosswalk id
// ("x,z:side": the road tile it's painted on and the side facing the
// intersection). Traffic can check this to stop for pedestrians.
export const pedestrianCrossings = new Map<string, number>()

type Edge = { to: number; cost: number; pts: Pt[]; cross?: Crossing }
export type WalkNode =
  | { kind: 'v'; pos: Pt } // a sidewalk corner
  | { kind: 't'; tile: Tile; center: Pt; decor: string | null; turn: number; uid: string | null } // lawn or small decoration
  | { kind: 'b'; uid: string; def: string; center: Pt } // a building's doors

export type WalkGraph = {
  nodes: WalkNode[]
  adj: Edge[][]
  byKey: Map<string, number>
  buildingNode: Map<string, number>
}

export function buildWalkGraph(roads: Set<string>, buildings: WalkBuilding[], land: string[]): WalkGraph {
  const nodes: WalkNode[] = []
  const adj: Edge[][] = []
  const byKey = new Map<string, number>()
  const buildingNode = new Map<string, number>()
  const isRoad = (x: number, z: number) => roads.has(key(x, z))

  const add = (k: string, n: WalkNode) => {
    const found = byKey.get(k)
    if (found != null) return found
    byKey.set(k, nodes.length)
    nodes.push(n)
    adj.push([])
    return nodes.length - 1
  }
  const link = (a: number, b: number, cost: number, pts: Pt[], cross?: Crossing) => {
    if (adj[a].some((e) => e.to === b && !e.cross === !cross)) return
    adj[a].push({ to: b, cost, pts, cross })
    adj[b].push({ to: a, cost, pts: [...pts].reverse(), cross })
  }

  // Sidewalk corner (i, j) sits just off the corner where four tiles meet,
  // nudged onto the sidewalk on the road side.
  const vertex = (i: number, j: number) => {
    const [cx, cz] = corner(i, j)
    let sx = 0
    let sz = 0
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const w = isRoad(i + (dx < 0 ? -1 : 0), j + (dz < 0 ? -1 : 0)) ? 1 : -1
      sx += w * dx
      sz += w * dz
    }
    return add(`v${i},${j}`, { kind: 'v', pos: [cx + Math.sign(sx) * SIDEWALK, cz + Math.sign(sz) * SIDEWALK] })
  }
  // The two corners of a tile's side, in order.
  const sideCorners = (x: number, z: number, s: number): [Tile, Tile] => {
    const [dx, dz] = SIDES[s]
    if (dx === 1) return [[x + 1, z], [x + 1, z + 1]]
    if (dx === -1) return [[x, z], [x, z + 1]]
    if (dz === 1) return [[x, z + 1], [x + 1, z + 1]]
    return [[x, z], [x + 1, z]]
  }
  const sideMid = (x: number, z: number, s: number, inset = 0): Pt => {
    const [wx, wz] = toWorld(x, z)
    const [dx, dz] = SIDES[s]
    return [wx + dx * (1 - inset), wz + dz * (1 - inset)]
  }
  const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])

  // Sidewalks and crosswalks. Zebra crossings are painted where the road layout
  // (shared with the road renderer and traffic) says a road meets an intersection.
  const layout = layoutRoads(roads)
  const junction = (x: number, z: number) => !!layout.tiles.get(key(x, z))?.junction
  for (const k of roads) {
    const [x, z] = k.split(',').map(Number)
    SIDES.forEach(([dx, dz], s) => {
      const [ca, cb] = sideCorners(x, z, s)
      if (!isRoad(x + dx, z + dz)) {
        const a = vertex(...ca)
        const b = vertex(...cb)
        const na = nodes[a] as { pos: Pt }
        const nb = nodes[b] as { pos: Pt }
        link(a, b, dist(na.pos, nb.pos), [])
      } else if (!junction(x, z) && junction(x + dx, z + dz)) {
        // Zebra crossing on this tile, just before the intersection.
        const a = vertex(...ca)
        const b = vertex(...cb)
        const [ax, az] = corner(...ca)
        const [bx, bz] = corner(...cb)
        const ux = Math.sign(bx - ax)
        const uz = Math.sign(bz - az)
        const p1: Pt = [ax + ux * SIDEWALK - dx * ZEBRA, az + uz * SIDEWALK - dz * ZEBRA]
        const p2: Pt = [bx - ux * SIDEWALK - dx * ZEBRA, bz - uz * SIDEWALK - dz * ZEBRA]
        link(a, b, dist(p1, p2) + 1.5, [p1, p2], {
          id: `${k}:${s}`, mid: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2], tile: k, dir: SIDE_TO_DIR[s],
        })
      }
    })
  }

  // Who sits on each tile.
  const occ = new Map<string, WalkBuilding>()
  for (const b of buildings) {
    const [w, h] = lotSize(b.def, b.rot)
    for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < h; dz++) occ.set(key(b.x + dx, b.z + dz), b)
  }
  // Small decorations are strolled around; everything else is solid.
  const strollable = (b: WalkBuilding) => {
    const d = buildingDef(b.def)
    // A covered "coming soon" lot from a newer build is solid, whatever its size turns out to be.
    return d.kind === 'decor' && d.w === 1 && d.h === 1 && !d.parked && !d.solid
  }
  const walkTile = (x: number, z: number): number | null => {
    if (isRoad(x, z) || !owns(land, x, z)) return null
    const b = occ.get(key(x, z))
    if (b && !strollable(b)) return null
    return add(`t${x},${z}`, {
      kind: 't', tile: [x, z], center: toWorld(x, z),
      decor: b ? b.def : null, turn: b ? turnOf(b, roads) : 0, uid: b ? b.uid : null,
    })
  }

  // Lawns and decorations: to each other, and onto the sidewalk.
  const tiles = new Set<string>()
  for (const l of land) {
    const [px, pz] = l.split(',').map(Number)
    for (let x = px * PLOT; x < (px + 1) * PLOT; x++) for (let z = pz * PLOT; z < (pz + 1) * PLOT; z++) tiles.add(key(x, z))
  }
  for (const k of tiles) {
    const [x, z] = k.split(',').map(Number)
    const t = walkTile(x, z)
    if (t == null) continue
    SIDES.forEach(([dx, dz], s) => {
      const nx = x + dx
      const nz = z + dz
      if (isRoad(nx, nz)) {
        const mid = sideMid(x, z, s, 0.05)
        for (const c of sideCorners(x, z, s)) {
          const v = vertex(...c)
          link(t, v, dist(mid, (nodes[v] as { pos: Pt }).pos) * LAWN + 0.5, [mid])
        }
      } else if (s < 2) {
        const n = walkTile(nx, nz)
        if (n != null) link(t, n, TILE_COST, [sideMid(x, z, s)])
      }
    })
  }

  // Doors: from the front of each building onto the sidewalk or lawn in front.
  for (const b of buildings) {
    const d = buildingDef(b.def)
    if (d.kind === 'obstacle' || d.solid || strollable(b)) continue
    const [w, h] = lotSize(b.def, b.rot)
    const [cx, cz] = toWorld(b.x + (w - 1) / 2, b.z + (h - 1) / 2)
    const node = add(`b${b.uid}`, { kind: 'b', uid: b.uid, def: b.def, center: [cx, cz] })
    buildingNode.set(b.uid, node)
    const front = turnOf(b, roads)
    const order = [front, ...[0, 1, 2, 3].filter((s) => s !== front)]
    for (const s of order) {
      const [dx, dz] = SIDES[s]
      let linked = false
      for (let ix = 0; ix < w; ix++) {
        for (let iz = 0; iz < h; iz++) {
          const fx = b.x + ix
          const fz = b.z + iz
          // Only tiles on this edge of the lot.
          if ((dx === 1 && ix !== w - 1) || (dx === -1 && ix !== 0) || (dz === 1 && iz !== h - 1) || (dz === -1 && iz !== 0)) continue
          const door = sideMid(fx, fz, s)
          if (isRoad(fx + dx, fz + dz)) {
            for (const c of sideCorners(fx, fz, s)) link(node, vertex(...c), 0.5, [door])
            linked = true
          } else {
            const t = walkTile(fx + dx, fz + dz)
            if (t != null) {
              link(node, t, 0.5 + TILE_COST, [door])
              linked = true
            }
          }
        }
      }
      // Use the front door when it opens onto somewhere walkable.
      if (linked) break
    }
  }

  return { nodes, adj, byKey, buildingNode }
}


// Cheapest route between two nodes (Dijkstra over a small binary heap).
export function findPath(g: WalkGraph, start: number, goal: number): { nodes: number[]; edges: Edge[] } | null {
  if (start === goal) return { nodes: [start], edges: [] }
  const n = g.nodes.length
  const best = new Float64Array(n).fill(Infinity)
  const prev = new Int32Array(n).fill(-1)
  const prevEdge: (Edge | null)[] = new Array(n).fill(null)
  const heap: [number, number][] = []
  const push = (c: number, i: number) => {
    heap.push([c, i])
    let k = heap.length - 1
    while (k > 0) {
      const p = (k - 1) >> 1
      if (heap[p][0] <= heap[k][0]) break
      ;[heap[p], heap[k]] = [heap[k], heap[p]]
      k = p
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()!
    if (heap.length) {
      heap[0] = last
      let k = 0
      for (;;) {
        const l = k * 2 + 1
        const r = l + 1
        let m = k
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === k) break
        ;[heap[m], heap[k]] = [heap[k], heap[m]]
        k = m
      }
    }
    return top
  }
  best[start] = 0
  push(0, start)
  while (heap.length) {
    const [c, i] = pop()
    if (c > best[i]) continue
    if (i === goal) break
    // Buildings are dead ends: you can't walk in one door and out the other.
    if (i !== start && g.nodes[i].kind === 'b') continue
    for (const e of g.adj[i]) {
      const nc = c + e.cost
      if (nc < best[e.to]) {
        best[e.to] = nc
        prev[e.to] = i
        prevEdge[e.to] = e
        push(nc, e.to)
      }
    }
  }
  if (best[goal] === Infinity) return null
  const nodes: number[] = []
  const edges: Edge[] = []
  for (let at = goal; at !== start; at = prev[at]) {
    nodes.unshift(at)
    edges.unshift(prevEdge[at]!)
  }
  nodes.unshift(start)
  return { nodes, edges }
}

// Which side of a tile a point is on.
export function sideOf(center: Pt, p: Pt) {
  const dx = p[0] - center[0]
  const dz = p[1] - center[1]
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 1 : 3
  return dz > 0 ? 0 : 2
}

// Waypoints for crossing a tile from one point on (or in) it to another.
// Lawn is crossed straight; decorations are walked around, corner to corner,
// so nobody strides through a fountain or a flower bed.
export function transit(node: WalkNode, from: Pt, to: Pt): Pt[] {
  if (node.kind !== 't' || !node.decor) return []
  const c = node.center
  const a = sideOf(c, from)
  const b = sideOf(c, to)
  const out: Pt[] = []
  const inside = (p: Pt) => Math.hypot(p[0] - c[0], p[1] - c[1]) < 0.9
  const mid = (s: number): Pt => [c[0] + SIDES[s][0] * 0.95, c[1] + SIDES[s][1] * 0.95]
  if (inside(from)) out.push(mid(a))
  if (a !== b) {
    // Corner k sits between side k and side k+1 (S-E, E-N, N-W, W-S).
    const cornerPt = (k: number): Pt => {
      const [ax, az] = SIDES[k]
      const [bx, bz] = SIDES[(k + 1) % 4]
      return [c[0] + (ax + bx) * 0.85, c[1] + (az + bz) * 0.85]
    }
    const cw = (b - a + 4) % 4
    if (cw === 1) out.push(cornerPt(a))
    else if (cw === 3) out.push(cornerPt(b))
    else if (Math.random() < 0.5) out.push(cornerPt(a), cornerPt((a + 1) % 4))
    else out.push(cornerPt((a + 3) % 4), cornerPt((a + 2) % 4))
  }
  if (inside(to)) out.push(mid(b))
  return out
}

const nodePos = (n: WalkNode): Pt => (n.kind === 'v' ? n.pos : n.center)

// One leg of a walk: head for `p`. A leg with `cross` steps onto a crosswalk.
export type Step = { p: Pt; cross?: Crossing }

// Turn a route into the points to walk through, starting from where the walker stands.
export function stepsFor(g: WalkGraph, route: { nodes: number[]; edges: Edge[] }, from: Pt): Step[] {
  const steps: Step[] = []
  let at = from
  const go = (p: Pt, cross?: Crossing) => {
    steps.push({ p, cross })
    at = p
  }
  route.edges.forEach((e, i) => {
    const here = g.nodes[route.nodes[i]]
    const first = e.pts[0] ?? nodePos(g.nodes[e.to])
    for (const p of transit(here, at, first)) go(p)
    if (here.kind === 'v' && i > 0) go(here.pos)
    e.pts.forEach((p, j) => go(p, e.cross && j === e.pts.length - 1 ? e.cross : undefined))
  })
  const last = g.nodes[route.nodes[route.nodes.length - 1]]
  if (last.kind === 'v') go(last.pos)
  return steps
}

