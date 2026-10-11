// How a town's road tiles fit together, shared by the road renderer and the
// traffic sim so paint, crosswalks, lights and cars always agree.
//
// - A plain tile is a single road with a lane each way.
// - Two tiles side by side along a straight run make a divided avenue: each
//   side is one-way (traffic keeps right), with a median line between them.
// - Every other tile where roads meet (T's, crossings, the ends of avenues,
//   and any bigger block of road like a 3x3 or 4x4 plaza) is a junction tile.
//   Touching junction tiles form one intersection with one set of lights.

// Directions match grid.ts DIRS: east, west, south, north. Opposite is d ^ 1.
const DX = [1, -1, 0, 0]
const DZ = [0, 0, 1, -1]

export type RoadTile = {
  key: string
  x: number
  z: number
  arms: boolean[] // road next door, per direction (physically joined)
  drive: boolean[] // cars may leave this way
  oneWay: number // the only heading allowed on an avenue side, else -1
  mate: number // avenue: direction of the other side, else -1
  junction: boolean
  cluster: number // intersection this junction tile belongs to, else -1
}

// A lane driving into an intersection. `stop`: a stop sign (the side road of a T without lights).
export type Entry = { tile: string; from: string; heading: number; stop?: boolean }

export type Intersection = {
  id: number
  tiles: string[]
  signal: boolean // traffic lights
  offset: number // where its light cycle starts, in seconds
  clear: number // all-red seconds, for lightAt
  entries: Entry[]
}

export type RoadLayout = { tiles: Map<string, RoadTile>; clusters: Intersection[] }

// Traffic light timing, in seconds: green, yellow, then all-red while the
// crossing empties (longer across a big intersection).
export const GREEN = 7
export const YELLOW = 2
export const ALL_RED = 1.2

export type Light = 'green' | 'yellow' | 'red'

// All-red time for an intersection `span` tiles across.
export const clearTime = (span: number) => Math.min(3.5, ALL_RED + 0.5 * (span - 1))

// Light shown to cars heading `heading` into an intersection whose cycle starts
// at `offset` (east-west traffic goes first). Pedestrians crossing a road may
// walk while the traffic along that road is red.
export function lightAt(offset: number, heading: number, t: number, clear = ALL_RED): Light {
  const half = GREEN + YELLOW + clear
  const cycle = half * 2
  const p = (((t + offset) % cycle) + cycle) % cycle
  const local = heading < 2 ? p : (p + half) % cycle
  return local < GREEN ? 'green' : local < GREEN + YELLOW ? 'yellow' : 'red'
}

const k = (x: number, z: number) => `${x},${z}`

export function layoutRoads(list: Iterable<string>): RoadLayout {
  const roads = new Set(list)
  const has = (x: number, z: number) => roads.has(k(x, z))
  const tiles = new Map<string, RoadTile>()
  for (const key of roads) {
    const [x, z] = key.split(',').map(Number)
    const arms = [0, 1, 2, 3].map((d) => has(x + DX[d], z + DZ[d]))
    tiles.set(key, { key, x, z, arms, drive: [...arms], oneWay: -1, mate: -1, junction: false, cluster: -1 })
  }

  // One side of an avenue running along `axis` (0: east-west, 2: north-south):
  // exactly one road beside it, that road has only it beside it, and the two
  // carry on (or stop) together.
  const side = (t: RoadTile, axis: number) => {
    const across = axis === 0 ? [2, 3] : [0, 1]
    const beside = across.filter((d) => t.arms[d])
    if (beside.length !== 1) return -1
    const md = beside[0]
    const m = tiles.get(k(t.x + DX[md], t.z + DZ[md]))!
    if (m.arms[md]) return -1 // a third lane: wider than an avenue
    if (m.arms[axis] !== t.arms[axis] || m.arms[axis + 1] !== t.arms[axis + 1]) return -1
    return t.arms[axis] && t.arms[axis + 1] ? md : -1
  }
  // Part of a 2x2 block of road (avenues, plazas).
  const inBlock = (t: RoadTile) =>
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].some(([sx, sz]) => has(t.x + sx, t.z) && has(t.x, t.z + sz) && has(t.x + sx, t.z + sz))

  for (const t of tiles.values()) {
    for (const axis of [0, 2]) {
      const md = side(t, axis)
      if (md < 0) continue
      t.mate = md
      // Keep right: east-west avenues run east on the south side, north-south
      // ones run south on the west side.
      t.oneWay = axis === 0 ? (md === 3 ? 0 : 1) : (md === 0 ? 2 : 3)
      t.drive = [false, false, false, false]
      t.drive[t.oneWay] = true
    }
  }
  for (const t of tiles.values()) {
    const degree = t.arms.filter(Boolean).length
    t.junction = t.oneWay < 0 && (degree >= 3 || inBlock(t))
  }
  // Never drive the wrong way into an avenue.
  for (const t of tiles.values()) {
    for (let d = 0; d < 4; d++) {
      const n = t.drive[d] && tiles.get(k(t.x + DX[d], t.z + DZ[d]))
      if (n && n.oneWay >= 0 && n.oneWay !== d) t.drive[d] = false
    }
  }

  // Touching junction tiles make one intersection.
  const clusters: Intersection[] = []
  for (const t of tiles.values()) {
    if (!t.junction || t.cluster >= 0) continue
    const c: Intersection = { id: clusters.length, tiles: [], signal: false, offset: 0, clear: ALL_RED, entries: [] }
    clusters.push(c)
    const queue = [t]
    t.cluster = c.id
    while (queue.length) {
      const j = queue.shift()!
      c.tiles.push(j.key)
      for (let d = 0; d < 4; d++) {
        const n = j.arms[d] && tiles.get(k(j.x + DX[d], j.z + DZ[d]))
        if (!n) continue
        if (n.junction) {
          if (n.cluster < 0) {
            n.cluster = c.id
            queue.push(n)
          }
        } else if (n.drive[d ^ 1]) {
          c.entries.push({ tile: j.key, from: n.key, heading: d ^ 1 })
        }
      }
    }
    // Lights where traffic comes in along both roads from at least four lanes.
    const axes = new Set(c.entries.map((e) => (e.heading < 2 ? 'x' : 'z')))
    c.signal = axes.size === 2 && c.entries.length >= 4
    // No lights where a side road meets a through road: a stop sign on the side road.
    if (!c.signal && axes.size === 2) {
      const along = (e: Entry) => (e.heading < 2 ? 'x' : 'z')
      const n = c.entries.filter((e) => along(e) === 'x').length
      const minor = n * 2 < c.entries.length ? 'x' : n * 2 > c.entries.length ? 'z' : null
      for (const e of c.entries) if (along(e) === minor) e.stop = true
    }
    const xs = c.tiles.map((t) => tiles.get(t)!.x)
    const zs = c.tiles.map((t) => tiles.get(t)!.z)
    c.clear = clearTime(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) + 1)
    c.offset = (((xs[0] * 7349 + zs[0] * 4091) % 97) / 97) * 20
  }
  return { tiles, clusters }
}
