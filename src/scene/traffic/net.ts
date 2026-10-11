// The road network town cars drive on: lane curves through every road tile,
// which tiles are junctions (and which get traffic lights), and the places
// cars can visit, worked out from each building's front door.
import { GRID, TILE, buildingDef } from '../../game/data'
import { add, bend, cubic, line, pointAt, type Curve, type V2 } from './curves'
import { layoutRoads, type RoadLayout } from './layout'

export type { Light } from './layout'

export type Tile = [number, number]
export type Building = { uid: string; def: string; x: number; z: number; rot?: number }
export type TurnOf = (b: Building, roads: Set<string>) => number

// Directions match grid.ts DIRS: east, west, south, north. Opposite is d ^ 1.
export const D: V2[] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
// Distance from a road's centre line to the middle of a lane.
export const LANE = 0.44
const H = TILE / 2

export const opp = (d: number) => d ^ 1
export const tkey = (x: number, z: number) => `${x},${z}`
// The right-hand side of a car heading `d`.
export const right = (d: V2): V2 => [-d[1], d[0]]
export const dirOf = (v: V2) => D.findIndex(([x, z]) => Math.abs(x - v[0]) < 0.5 && Math.abs(z - v[1]) < 0.5)

const center = (x: number, z: number): V2 => [(x - (GRID - 1) / 2) * TILE, (z - (GRID - 1) / 2) * TILE]

export type Node = {
  key: string
  x: number
  z: number
  arms: boolean[] // road tile next door, per direction (not counting the far side of an avenue)
  drive: boolean[] // cars may leave this way
  oneWay: number // avenue side: the only way to drive, else -1
  cluster: number // the intersection a junction tile belongs to, else -1
  lots: boolean[] // a driveway into a business, per direction
  degree: number // road arms
  junction: boolean // cars need a turn to cross it
  signal: boolean // part of an intersection with traffic lights
  offset: number // where its intersection's light cycle starts
  clear: number // its all-red time
  depth: number // junction tiles between here and plain road (0 on plain road)
  spur: boolean // plain road leading only to a dead end
  occ: Map<string, { inDir: number; outDir: number }> // cars with a turn to cross
}

// A place cars pull up to. `tile` and `heading` are where the car is when it
// arrives: on that road tile, travelling so the business is on its right.
export type Stop = {
  uid: string
  def: string
  tile: string
  heading: number
  // Gas stations have a forecourt: turn in, stop at the pumps, drive out the other side.
  bay: null | { legs: Curve[]; stopLeg: number; lotDir: number; exit: string }
}

export type Net = {
  layout: RoadLayout
  nodes: Map<string, Node>
  stops: Stop[]
  stopSigns: Set<string> // `${tile}>${heading}`: a stop sign before driving into that junction tile that way
  verge: Set<string> // open ground beside the road (no road, no building) a broken-down car can pull onto
  curves: Map<string, Curve>
}

// Where a car crosses a road tile, entering heading `inDir` and leaving heading `outDir`.
export function roadCurve(net: Net, x: number, z: number, inDir: number, outDir: number): Curve {
  const k = `${x},${z},${inDir},${outDir}`
  let c = net.curves.get(k)
  if (c) return c
  c = laneCurve(center(x, z), inDir, outDir)
  net.curves.set(k, c)
  return c
}

function laneCurve(c: V2, inDir: number, outDir: number): Curve {
  const di = D[inDir]
  const dout = D[outDir]
  const e = add(add(c, di, -H), right(di), LANE)
  const x = add(add(c, dout, H), right(dout), LANE)
  if (inDir === outDir) return line(e, x)
  // Dead end: loop round inside the tile.
  if (outDir === opp(inDir)) return cubic(e, add(e, di, 1.5), add(x, di, 1.5), x)
  return bend(e, di, x)
}

// 0 straight on or a right turn, 1 left turn, 2 U-turn. Lower goes first.
export function turnRank(inDir: number, outDir: number) {
  if (inDir === outDir) return 0
  if (outDir === opp(inDir)) return 2
  const r = right(D[inDir])
  return r[0] === D[outDir][0] && r[1] === D[outDir][1] ? 0 : 1
}

// Which pairs of moves through a junction cross or merge. Moves from the same
// side just queue behind each other, so they never conflict.
const CONFLICT = 0.86 // just under the gap between two lanes, so opposite traffic can pass
const conflictTable: boolean[] = (() => {
  const out: boolean[] = []
  const pts = (i: number, o: number) => {
    const c = laneCurve([0, 0], i, o)
    return Array.from({ length: 25 }, (_, n) => pointAt(c, (c.len * n) / 24))
  }
  for (let a = 0; a < 16; a++) {
    for (let b = 0; b < 16; b++) {
      const ai = a >> 2, ao = a & 3, bi = b >> 2, bo = b & 3
      if (ai === bi) { out.push(false); continue }
      const pa = pts(ai, ao)
      const pb = pts(bi, bo)
      out.push(pa.some((p) => pb.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < CONFLICT)))
    }
  }
  return out
})()

export const conflicts = (ai: number, ao: number, bi: number, bo: number) => conflictTable[((ai << 2) | ao) * 16 + ((bi << 2) | bo)]

// Right of way for cars entering heading `inDir`: through roads beat side roads,
// and anything on the road beats a car pulling out of a driveway.
export function priority(node: Node, inDir: number) {
  const from = opp(inDir)
  if (node.lots[from]) return 0
  return node.arms[from] && node.arms[inDir] ? 2 : 1
}

export function buildNet(roadList: string[], buildings: Building[], turnOf: TurnOf): Net {
  const roads = new Set(roadList)
  const layout = layoutRoads(roads)
  const nodes = new Map<string, Node>()
  for (const t of layout.tiles.values()) {
    const arms = t.arms.map((a, d) => a && d !== t.mate)
    const c = layout.clusters[t.cluster]
    nodes.set(t.key, {
      key: t.key, x: t.x, z: t.z, arms, drive: t.drive, oneWay: t.oneWay, cluster: t.cluster,
      lots: [false, false, false, false], degree: arms.filter(Boolean).length,
      junction: t.junction, signal: !!c?.signal, offset: c?.offset ?? 0, clear: c?.clear ?? 0,
      depth: 0, spur: false,
      occ: new Map(),
    })
  }
  const stopSigns = new Set(layout.clusters.flatMap((c) => c.entries.filter((e) => e.stop).map((e) => `${e.tile}>${e.heading}`)))
  const net: Net = { layout, nodes, stops: [], curves: new Map(), stopSigns, verge: new Set() }
  const built = new Set<string>()
  for (const b of buildings) {
    const d = buildingDef(b.def)
    if (!d) continue
    const [w, h] = turnOf(b, roads) % 2 ? [d.h, d.w] : [d.w, d.h]
    for (let x = 0; x < w; x++) for (let z = 0; z < h; z++) built.add(tkey(b.x + x, b.z + z))
  }
  for (const t of layout.tiles.values()) {
    for (const [dx, dz] of D) {
      const x = t.x + dx, z = t.z + dz
      const k = tkey(x, z)
      if (x >= 0 && z >= 0 && x < GRID && z < GRID && !roads.has(k) && !built.has(k)) net.verge.add(k)
    }
  }
  // How deep each junction sits inside a block of junction tiles (wide roads, plazas).
  const queue = [...nodes.values()].filter((n) => !n.junction)
  for (const n of nodes.values()) if (n.junction) n.depth = Infinity
  while (queue.length) {
    const n = queue.shift()!
    for (let d = 0; d < 4; d++) {
      const m = n.arms[d] && nodes.get(tkey(n.x + D[d][0], n.z + D[d][1]))
      if (m && m.depth > n.depth + 1) {
        m.depth = n.depth + 1
        queue.push(m)
      }
    }
  }
  for (const n of nodes.values()) if (n.depth === Infinity) n.depth = 1
  // Dead-end spurs: follow the plain road each way from every dead end.
  for (const end of nodes.values()) {
    if (end.degree !== 1) continue
    let at: Node | undefined = end
    let from = -1
    while (at && !at.junction && at.degree <= 2 && !at.spur) {
      at.spur = true
      const d: number = at.arms.findIndex((ok, i) => ok && i !== from)
      if (d < 0) break
      from = opp(d)
      at = nodes.get(tkey(at.x + D[d][0], at.z + D[d][1]))
    }
  }
  // Gas forecourts first: their driveways turn road tiles into junctions, which no one parks on.
  const sorted = [...buildings].sort((a, b) => Number(b.def === 'gas') - Number(a.def === 'gas'))
  for (const b of sorted) {
    const stop = stopFor(net, b, roads, turnOf)
    if (stop) net.stops.push(stop)
  }
  return net
}

// A road tile a car can pull up beside: the road runs straight past with no junction.
function curbOk(net: Net, k: string, heading: number) {
  const n = net.nodes.get(k)
  return !!n && n.degree === 2 && !n.junction && n.drive[heading] && n.arms[opp(heading)]
}

function stopFor(net: Net, b: Building, roads: Set<string>, turnOf: TurnOf): Stop | null {
  const d = buildingDef(b.def)
  // Homes have no curb stop, except trailer homes, where the town's beaters park.
  if (!d || d.kind === 'decor' || d.kind === 'obstacle' || (d.kind === 'house' && d.id !== 'trailer')) return null
  const turn = turnOf(b, roads)
  const [w, h] = turn % 2 ? [d.h, d.w] : [d.w, d.h]
  // Front door direction for each quarter turn: south, east, north, west.
  const front = [2, 0, 3, 1][turn]
  const inLot = (x: number, z: number) => x >= b.x && x < b.x + w && z >= b.z && z < b.z + h

  if (d.kind === 'gas') {
    const bay = gasBay(net, b, turn, w, h, front)
    if (bay) return bay
  }
  // Pull up at the curb, front door first, else beside any side that touches a road.
  const cx = b.x + (w - 1) / 2
  const cz = b.z + (h - 1) / 2
  for (const side of [front, ...[0, 1, 2, 3].filter((s) => s !== front && s !== opp(front)), opp(front)]) {
    const [dx, dz] = D[side]
    const options: { k: string; dist: number }[] = []
    for (let x = b.x; x < b.x + w; x++) {
      for (let z = b.z; z < b.z + h; z++) {
        if (inLot(x + dx, z + dz)) continue
        options.push({ k: tkey(x + dx, z + dz), dist: Math.hypot(x - cx, z - cz) })
      }
    }
    options.sort((p, q) => p.dist - q.dist)
    // Heading with the lot on the right-hand side.
    const heading = dirOf([-dz, dx])
    const hit = options.find((o) => curbOk(net, o.k, heading))
    if (hit) return { uid: b.uid, def: b.def, tile: hit.k, heading, bay: null }
  }
  return null
}

// Forecourt route through the gas station, in the station's own frame (front is +z,
// lot centre at the origin): turn in from the road tile in front of the east half,
// pull up beside the pumps, and leave across the west half.
function gasBay(net: Net, b: Building, turn: number, w: number, h: number, front: number): Stop | null {
  const theta = (turn * Math.PI) / 2
  const cos = Math.cos(theta), sin = Math.sin(theta)
  const [cx, cz] = center(b.x + (w - 1) / 2, b.z + (h - 1) / 2)
  const toWorld = (p: V2): V2 => [cx + p[0] * cos + p[1] * sin, cz - p[0] * sin + p[1] * cos]
  const dir = (p: V2): V2 => [p[0] * cos + p[1] * sin, -p[0] * sin + p[1] * cos]
  const tileAt = (p: V2) => {
    const q = toWorld(p)
    return tkey(Math.round(q[0] / TILE + (GRID - 1) / 2), Math.round(q[1] / TILE + (GRID - 1) / 2))
  }
  const enter = tileAt([1, 2])
  const exit = tileAt([-1, 2])
  const a = net.nodes.get(enter)
  const z = net.nodes.get(exit)
  if (!a || !z || a.junction || z.junction) return null
  const heading = dirOf(dir([-1, 0]))
  const lotDir = opp(front)
  // The car must be able to arrive heading west (station frame) and leave the exit tile.
  if (!a.arms[opp(heading)] || (a.oneWay >= 0 && a.oneWay !== heading) || !z.drive.some((ok, i) => ok && i !== lotDir)) return null
  const r = 0.75
  const p0: V2 = [1 + LANE, 1]
  const p1: V2 = [1 + LANE - r, 1 - r]
  const p2: V2 = [-(1 + LANE - r), 1 - r]
  const p3: V2 = [-(1 + LANE), 1]
  const legs = [
    bend(toWorld(p0), dir([0, -1]), toWorld(p1)),
    line(toWorld(p1), toWorld(p2)),
    bend(toWorld(p2), dir([-1, 0]), toWorld(p3)),
  ]
  a.lots[lotDir] = true
  a.junction = true
  z.lots[lotDir] = true
  z.junction = true
  return { uid: b.uid, def: b.def, tile: enter, heading, bay: { legs, stopLeg: 1, lotDir, exit } }
}

// Shortest legal drive from entering tile `start` heading `h` to arriving at
// `goal` heading `gh`: no U-turns except at dead ends, unless there is no other
// way (a ring road), when a car may turn round on a quiet stretch of road.
// Returns the direction to leave each tile on the way, not including the goal tile.
// `stalls`: lanes with a broken-down car in them, not to turn round just after.
export function route(net: Net, start: string, h: number, goal: string, gh: number, avoid?: Set<string>, stalls?: Set<string>): number[] | null {
  return search(net, start, h, goal, gh, avoid, false) ?? search(net, start, h, goal, gh, avoid, true, stalls)
}

// A plain two-way stretch of road a car can turn round on.
export const uTurnOk = (n: Node) => !n.junction && n.degree === 2 && n.oneWay < 0 && n.lots.every((l) => !l)

function search(net: Net, start: string, h: number, goal: string, gh: number, avoid: Set<string> | undefined, turnRound: boolean, stalls?: Set<string>) {
  const sk = `${start}|${h}`
  const gk = `${goal}|${gh}`
  const prev = new Map<string, [string, number] | null>([[sk, null]])
  const queue = [sk]
  while (queue.length) {
    const cur = queue.shift()!
    if (cur === gk) {
      const outs: number[] = []
      for (let at = cur; prev.get(at); at = prev.get(at)![0]) outs.unshift(prev.get(at)![1])
      return outs
    }
    const [k, hs] = cur.split('|')
    const node = net.nodes.get(k)
    if (!node) continue
    const outs = exits(node, Number(hs))
    // Turn round only on open road: not on the first tile, nor just past a broken-down
    // car, where the car would have to get past it first.
    const justPast = () => {
      for (let at: string | undefined = cur, n = 0; at && n < 3; at = prev.get(at)?.[0], n++) if (stalls?.has(at)) return true
      return false
    }
    if (turnRound && uTurnOk(node) && k !== start && !justPast()) outs.push(opp(Number(hs)))
    for (const o of outs) {
      const nk = `${tkey(node.x + D[o][0], node.z + D[o][1])}|${o}`
      if (prev.has(nk) || (avoid?.has(nk) && nk !== gk)) continue
      prev.set(nk, [cur, o])
      queue.push(nk)
    }
  }
  return null
}

// Ways out of a road tile for a car entering heading `h`: anything but back,
// unless it is a dead end.
export function exits(node: Node, h: number) {
  const out: number[] = []
  for (let o = 0; o < 4; o++) if (node.drive[o] && o !== opp(h)) out.push(o)
  if (!out.length && node.drive[opp(h)]) out.push(opp(h))
  return out
}
