import { buildingDef, PLOT, TILE } from './data'
import { toTile, toWorld } from '../scene/grid'
import { turnOf } from './placement'
import { layoutRoads } from '../scene/traffic/layout'
import { DIRS } from '../scene/grid'
import { footprintOf, furnitureOf } from './streetFurniture'

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
  | { kind: 'b'; uid: string; def: string; center: Pt; turn: number } // a building's doors (turn: the side it faces)

export type WalkGraph = {
  nodes: WalkNode[]
  adj: Edge[][]
  byKey: Map<string, number>
  buildingNode: Map<string, number>
}

// How far a walker's body reaches either side of their path (torso, without the swinging arms).
export const BODY = 0.12

// Whether p stands inside a convex footprint.
function inFoot(p: Pt, poly: Pt[]) {
  const side = (i: number) => {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
  }
  const s = poly.map((_, i) => side(i))
  return s.every((v) => v >= 0) || s.every((v) => v <= 0)
}

// How far p stands from a convex footprint (0 inside it).
function footGap(p: Pt, poly: Pt[]) {
  if (inFoot(p, poly)) return 0
  let best = Infinity
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)))
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz))
  })
  return best
}

// The way from a to b along a sidewalk, stepping round each footprint (a polygon on the ground)
// that comes within BODY of the straight line: off to whichever side of it is nearer, back on
// past it. The points between a and b (a and b themselves left out); none when nothing is in the way.
export function detour(a: Pt, b: Pt, feet: Pt[][], ok: (p: Pt) => boolean = () => true): Pt[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (!feet.length || len < 1e-6) return []
  const ux = (b[0] - a[0]) / len
  const uz = (b[1] - a[1]) / len
  // Along (t) and across (d, + to the left of a -> b) for a point.
  const along = (p: Pt) => (p[0] - a[0]) * ux + (p[1] - a[1]) * uz
  const across = (p: Pt) => -(p[0] - a[0]) * uz + (p[1] - a[1]) * ux
  const at = (t: number, d: number): Pt => [a[0] + ux * t - uz * d, a[1] + uz * t + ux * d]
  const blocks = feet.map((poly) => {
    const ts = poly.map(along)
    const ds = poly.map(across)
    return { t0: Math.min(...ts) - BODY, t1: Math.max(...ts) + BODY, d0: Math.min(...ds) - BODY, d1: Math.max(...ds) + BODY }
  }).filter((k) => k.d0 < 0 && k.d1 > 0 && k.t1 > 0 && k.t0 < len).sort((p, q) => p.t0 - q.t0)
  const pts: Pt[] = []
  for (const k of blocks) {
    // Step aside to the nearer clear side (that stays where ok allows), starting a little
    // before it and back on a little after.
    const t0 = Math.max(0.02, k.t0)
    const t1 = Math.min(len - 0.02, k.t1)
    const [near, far] = -k.d0 < k.d1 ? [k.d0, k.d1] : [k.d1, k.d0]
    const d = ok(at(t0, near)) && ok(at(t1, near)) ? near : far
    const ease = 0.12
    if (t0 - ease > 0.02) pts.push(at(t0 - ease, 0))
    pts.push(at(t0, d), at(t1, d))
    if (t1 + ease < len - 0.02) pts.push(at(t1 + ease, 0))
  }
  return pts
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
  // Footprints of the lamps, hydrants and furniture on the sidewalks, as the road renderer
  // stands them (World.tsx Roads), by road tile: every path is bent round them below.
  const layout = layoutRoads(roads)
  const feet = new Map<string, Pt[][]>()
  for (const t of layout.tiles.values()) {
    const xing = DIRS.map(([dx, dz]) => !t.junction && !!layout.tiles.get(key(t.x + dx, t.z + dz))?.junction)
    const [wx, wz] = toWorld(t.x, t.z)
    const list = furnitureOf({ ...t, xing }).map((f) => footprintOf(f).map(([fx, fz]) => [wx + fx, wz + fz] as Pt))
    if (list.length) feet.set(key(t.x, t.z), list)
  }
  const posOf = (n: WalkNode): Pt => (n.kind === 'v' ? n.pos : n.center)
  // The footprints on the road tiles a segment passes over.
  const feetNear = (p: Pt, q: Pt) => {
    const found: Pt[][] = []
    const [i0, j0] = toTile(Math.min(p[0], q[0]), Math.min(p[1], q[1]))
    const [i1, j1] = toTile(Math.max(p[0], q[0]), Math.max(p[1], q[1]))
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) found.push(...(feet.get(key(i, j)) ?? []))
    return found
  }
  const sideMid = (x: number, z: number, s: number, inset = 0): Pt => {
    const [wx, wz] = toWorld(x, z)
    const [dx, dz] = SIDES[s]
    return [wx + dx * (1 - inset), wz + dz * (1 - inset)]
  }
  // Where a path steps off a lot onto the sidewalk at side s of tile (x, z): out from the lot's
  // edge (inset into the lot) straight across to the walking line, at the middle of the side or
  // slid along it to a spot where no furniture stands in the way. Both points, lot side first.
  const onto = (x: number, z: number, s: number, inset = 0): Pt[] => {
    const mid = sideMid(x, z, s, inset)
    const [dx, dz] = SIDES[s]
    const out = inset + SIDEWALK
    for (const off of [0, 0.3, -0.3, 0.5, -0.5, 0.7, -0.7]) {
      const p: Pt = [mid[0] + dz * off, mid[1] + dx * off]
      const q: Pt = [p[0] + dx * out, p[1] + dz * out]
      const near = feetNear([p[0] - 1, p[1] - 1], [p[0] + 1, p[1] + 1])
      const steps = [0, 0.25, 0.5, 0.75, 1].map((k): Pt => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k])
      if (near.every((f) => steps.every((st) => footGap(st, f) >= BODY))) return [p, q]
    }
    return [mid]
  }
  // Detours stay on the sidewalk: on a road tile, within its sidewalk band (never out into
  // the roadway or into a lot).
  const onWalk = (p: Pt) => {
    const [i, j] = toTile(p[0], p[1])
    if (!isRoad(i, j)) return false
    const [cx, cz] = toWorld(i, j)
    return Math.max(Math.abs(p[0] - cx), Math.abs(p[1] - cz)) > TILE / 2 - 0.44
  }
  const link = (a: number, b: number, cost: number, pts: Pt[], cross?: Crossing) => {
    if (adj[a].some((e) => e.to === b && !e.cross === !cross)) return
    if (!cross && feet.size) {
      const way = [posOf(nodes[a]), ...pts, posOf(nodes[b])]
      const bent: Pt[] = []
      for (let i = 1; i < way.length; i++) {
        bent.push(...detour(way[i - 1], way[i], feetNear(way[i - 1], way[i]), onWalk))
        if (i < way.length - 1) bent.push(way[i])
      }
      if (bent.length !== pts.length) {
        cost += 0.1
        pts = bent
      }
    }
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
  const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])

  // Sidewalks and crosswalks. Zebra crossings are painted where the road layout
  // (shared with the road renderer and traffic) says a road meets an intersection.
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
        const step = onto(x, z, s, 0.05)
        for (const c of sideCorners(x, z, s)) {
          const v = vertex(...c)
          link(t, v, dist(step[0], (nodes[v] as { pos: Pt }).pos) * LAWN + 0.5, step)
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
    const front = turnOf(b, roads)
    const node = add(`b${b.uid}`, { kind: 'b', uid: b.uid, def: b.def, center: [cx, cz], turn: front })
    buildingNode.set(b.uid, node)
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
          if (isRoad(fx + dx, fz + dz)) {
            const door = onto(fx, fz, s)
            for (const c of sideCorners(fx, fz, s)) link(node, vertex(...c), 0.5, door)
            linked = true
          } else {
            const t = walkTile(fx + dx, fz + dz)
            if (t != null) {
              link(node, t, 0.5 + TILE_COST, [sideMid(fx, fz, s)])
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

