// Merged buildings: two matching buildings side by side can be merged into one
// wide building (1x2), four standing in a square into one big building (2x2),
// and four of those into a giant one (4x4), so a packed town still reads from
// far out. One tap works the lot, and every building stays in the save with its
// own job, level and driver, but each earns the block's merge bonus on top
// (MERGE_BONUS in data.ts: +10% a pair, +25% a 2x2, +50% a 4x4). The
// top-left building of the block carries `merge` (see MERGE_CODES); the rest are found by
// position. A block that no longer lines up (moved on an older build, levels
// differ) simply shows as separate buildings again.

import { buildingDef, buildingLevel, MAX_BUILDING_LEVEL, mergeBonus, mergedFuelExtra } from './data'
import type { PlacedBuilding } from './store'

// Save value -> buildings across and down: 2 is a 2x2 square, 4 a 4x4, 21 two
// side by side along x and 12 two along z.
export const MERGE_CODES: Record<number, [number, number]> = { 4: [4, 4], 2: [2, 2], 21: [2, 1], 12: [1, 2] }
export type MergeGroup = {
  anchor: PlacedBuilding
  code: number
  cols: number
  rows: number
  members: PlacedBuilding[]
  // Top-left tile and size in tiles of the whole block.
  x: number
  z: number
  w: number
  h: number
}

const lot = (b: PlacedBuilding): [number, number] => {
  const d = buildingDef(b.def)
  return (b.rot ?? 0) % 2 ? [d.h, d.w] : [d.w, d.h]
}

// Decorations are single objects (a tree, a lamp, a bench): two of them make
// no sense as one bigger thing, so they never merge. Only these area-like
// ones do: parks and beds, which just grow into a bigger patch. A new decor
// stays unmergeable unless it's added here.
const MERGING_DECOR = new Set(['flowers', 'pumpkins', 'pond', 'playground', 'dogpark', 'skatepark', 'koi', 'garden', 'tennis', 'cornmaze'])

export function mergeable(def: string) {
  const d = buildingDef(def)
  if (d.kind === 'decor' && !MERGING_DECOR.has(d.id)) return false
  return !d.parked && !d.unique && d.kind !== 'obstacle' && d.kind !== 'showroom' && d.kind !== 'garage'
}

const alike = (a: PlacedBuilding, b: PlacedBuilding) => {
  if (a.def !== b.def || buildingLevel(a) !== buildingLevel(b)) return false
  const [w, h] = lot(a)
  const [w2, h2] = lot(b)
  return w === w2 && h === h2
}

const corners = (buildings: PlacedBuilding[]) => new Map(buildings.map((b) => [`${b.x},${b.z}`, b]))

// The cols x rows block of buildings like `a` with `a` in the top-left corner.
function block(a: PlacedBuilding, cols: number, rows: number, at: Map<string, PlacedBuilding>): PlacedBuilding[] | null {
  const [w, h] = lot(a)
  const out: PlacedBuilding[] = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const o = at.get(`${a.x + i * w},${a.z + j * h}`)
      if (!o || !alike(a, o)) return null
      out.push(o)
    }
  }
  return out
}

function group(anchor: PlacedBuilding, code: number, members: PlacedBuilding[]): MergeGroup {
  const [w, h] = lot(anchor)
  const [cols, rows] = MERGE_CODES[code]
  return { anchor, code, cols, rows, members, x: anchor.x, z: anchor.z, w: w * cols, h: h * rows }
}

export type Merges = { groups: Map<string, MergeGroup>; owner: Map<string, string> }

// Every merged block in the town, by anchor uid, and which block each building belongs to.
export function mergeGroups(buildings: PlacedBuilding[]): Merges {
  const at = corners(buildings)
  const groups = new Map<string, MergeGroup>()
  const owner = new Map<string, string>()
  // Biggest first, so a stale smaller flag inside a bigger block is ignored.
  for (const code of [4, 2, 21, 12]) {
    const [cols, rows] = MERGE_CODES[code]
    for (const b of buildings) {
      if (b.merge !== code || !mergeable(b.def) || owner.has(b.uid)) continue
      const m = block(b, cols, rows, at)
      if (!m || m.some((o) => owner.has(o.uid))) continue
      groups.set(b.uid, group(b, code, m))
      for (const o of m) owner.set(o.uid, b.uid)
    }
  }
  return { groups, owner }
}

// The merged block a building belongs to, if any.
export function groupOf(buildings: PlacedBuilding[], uid: string, merges = mergeGroups(buildings)) {
  const a = merges.owner.get(uid)
  return a ? merges.groups.get(a) : undefined
}

// The merge bonus each merged building earns, by uid (loose buildings are left out).
export function mergeBoosts(buildings: PlacedBuilding[], merges = mergeGroups(buildings)): Map<string, number> {
  const out = new Map<string, number>()
  for (const g of merges.groups.values()) for (const o of g.members) out.set(o.uid, mergeBonus(g.members.length))
  return out
}

// Extra fuel every merged house and gas station block holds on top of its buildings' own.
export function mergeFuel(buildings: PlacedBuilding[], merges = mergeGroups(buildings)) {
  let n = 0
  for (const g of merges.groups.values()) n += mergedFuelExtra(buildingDef(g.anchor.def), buildingLevel(g.anchor), g.members.length)
  return n
}

// Blocks that could be merged right now: four matching buildings in a square
// (loose, or pairs that sit wholly inside it), four matching merged squares in
// a square, or two matching loose buildings side by side that aren't already
// part of a square on offer.
export function mergeCandidates(buildings: PlacedBuilding[], merges = mergeGroups(buildings)): MergeGroup[] {
  const at = corners(buildings)
  const out: MergeGroup[] = []
  const inSquare = new Set<string>()
  for (const b of buildings) {
    if (!mergeable(b.def) || (merges.owner.has(b.uid) && merges.owner.get(b.uid) !== b.uid)) continue
    const m = block(b, 2, 2, at)
    const ids = new Set(m?.map((o) => o.uid))
    const fits = (o: PlacedBuilding) => {
      const g = merges.groups.get(merges.owner.get(o.uid) ?? '')
      return !g || (g.members.length === 2 && g.members.every((x) => ids.has(x.uid)))
    }
    if (m && m.every(fits)) {
      out.push(group(b, 2, m))
      for (const o of m) inSquare.add(o.uid)
    }
  }
  for (const b of buildings) {
    if (!mergeable(b.def) || merges.owner.has(b.uid) || inSquare.has(b.uid)) continue
    for (const code of [21, 12]) {
      const [cols, rows] = MERGE_CODES[code]
      const m = block(b, cols, rows, at)
      if (m && !m.some((o) => merges.owner.has(o.uid) || inSquare.has(o.uid))) out.push(group(b, code, m))
    }
  }
  for (const g of merges.groups.values()) {
    if (g.code !== 2) continue
    const quads = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, j]) => {
      const o = at.get(`${g.x + i * g.w},${g.z + j * g.h}`)
      const q = o && merges.groups.get(o.uid)
      return q && q.code === 2 && alike(g.anchor, q.anchor) ? q : null
    })
    if (quads.every(Boolean)) out.push(group(g.anchor, 4, quads.flatMap((q) => q!.members)))
  }
  return out
}

// Saves with the block merged (anchor flagged, the rest cleared).
export function applyMerge(buildings: PlacedBuilding[], c: MergeGroup): PlacedBuilding[] {
  const ids = new Set(c.members.map((o) => o.uid))
  return buildings.map((b) => (b.uid === c.anchor.uid ? { ...unflag(b), merge: c.code } : ids.has(b.uid) ? unflag(b) : b))
}

// Saves with the block split one step: a 4x4 back into four 2x2s, a 2x2 or a pair back into loose buildings.
export function applySplit(buildings: PlacedBuilding[], g: MergeGroup): PlacedBuilding[] {
  const quads = new Set<string>()
  if (g.code === 4) {
    const [w, h] = lot(g.anchor)
    for (const b of g.members) if ((b.x - g.x) % (w * 2) === 0 && (b.z - g.z) % (h * 2) === 0) quads.add(b.uid)
  }
  const ids = new Set(g.members.map((o) => o.uid))
  return buildings.map((b) => (quads.has(b.uid) ? { ...b, merge: 2 } : ids.has(b.uid) ? unflag(b) : b))
}

// Saves with the whole block shifted so its top-left corner sits at x, z. Every
// building keeps its place in the block, so it stays merged.
export function moveGroup(buildings: PlacedBuilding[], g: MergeGroup, x: number, z: number): PlacedBuilding[] {
  const dx = x - g.x
  const dz = z - g.z
  const ids = new Set(g.members.map((o) => o.uid))
  return buildings.map((b) => (ids.has(b.uid) ? { ...b, x: b.x + dx, z: b.z + dz } : b))
}

function unflag(b: PlacedBuilding): PlacedBuilding {
  if (b.merge == null && b.mturn == null) return b
  const { merge: _, mturn: __, ...rest } = b
  return rest
}

// Saves with the block turned a quarter clockwise in place, or null when the
// turned block doesn't fit. A square block of square lots only changes which
// way it faces. Anything else swaps its width and depth: the buildings are laid
// out again across the new footprint (centred on the old one, as a single
// building turns), each keeping its own job, level and driver.
// `free` says whether a tile can take part of the turned block.
export function rotateGroup(buildings: PlacedBuilding[], g: MergeGroup, turn: number, free: (x: number, z: number) => boolean): PlacedBuilding[] | null {
  const d = buildingDef(g.anchor.def)
  const to = (turn + 1) % 4
  const square = d.w === d.h
  if (square && g.cols === g.rows) return buildings.map((b) => (b.uid === g.anchor.uid ? { ...b, mturn: to } : b))
  const cols = g.rows
  const rows = g.cols
  const code = cols === rows ? g.code : cols > rows ? 21 : 12
  const [mw, mh] = square || to % 2 === 0 ? [d.w, d.h] : [d.h, d.w]
  const W = mw * cols
  const H = mh * rows
  const x = g.x + (g.w - W) / 2
  const z = g.z + (g.h - H) / 2
  // No exact middle when the sizes differ by an odd number of tiles. Round one
  // way going sideways and back the other way coming home, so four turns land
  // where they began.
  const near = to % 2 ? Math.floor : Math.ceil
  const far = to % 2 ? Math.ceil : Math.floor
  const spots: [number, number][] = [[near(x), near(z)], [far(x), near(z)], [near(x), far(z)], [far(x), far(z)]]
  const fits = ([sx, sz]: [number, number]) => {
    for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) if (!free(sx + i, sz + j)) return false
    return true
  }
  const spot = spots.find(fits)
  if (!spot) return null
  // The anchor stays the top-left building, so the block still reads as merged.
  const order = [g.anchor, ...g.members.filter((o) => o.uid !== g.anchor.uid)]
  const at = new Map(order.map((o, k) => [o.uid, [spot[0] + (k % cols) * mw, spot[1] + Math.floor(k / cols) * mh]]))
  return buildings.map((b) => {
    const p = at.get(b.uid)
    if (!p) return b
    const moved = { ...unflag(b), x: p[0], z: p[1], ...(square ? {} : { rot: to }) }
    return b.uid === g.anchor.uid ? { ...moved, merge: code, mturn: to } : moved
  })
}

// Which way the big building faces: the player's turn (`mturn` on the anchor)
// if it suits the block's shape, else towards a road along the block's edge.
// Lots that aren't square keep their orientation and can only flip.
export function groupTurn(g: MergeGroup, roads: Set<string>) {
  const d = buildingDef(g.anchor.def)
  const touches = (t: number) => {
    const n = t % 2 ? g.h : g.w
    for (let i = 0; i < n; i++) {
      const [x, z] =
        t === 0 ? [g.x + i, g.z + g.h] : t === 2 ? [g.x + i, g.z - 1]
        : t === 1 ? [g.x + g.w, g.z + i] : [g.x - 1, g.z + i]
      if (roads.has(`${x},${z}`)) return true
    }
    return false
  }
  const p = (g.anchor.rot ?? 0) % 2
  // A pair of square lots stands lengthways along the pair.
  const order = d.w !== d.h ? [p, p + 2] : g.cols === g.rows ? [0, 1, 2, 3] : g.cols > g.rows ? [0, 2] : [1, 3]
  const chosen = g.anchor.mturn
  if (chosen != null && order.includes(chosen)) return chosen
  return order.find(touches) ?? order[0]
}

// How much to grow one building's model to fill the block, in its own turned
// frame. Squares grow evenly; a pair gets longer only, at the same height:
// its walls repeat more bays rather than growing taller (see useBays).
export function groupScale(g: MergeGroup, turn: number): [number, number, number] {
  if (g.cols === g.rows) return [g.cols, g.cols, g.cols]
  // The model's own x runs along world x when it faces north or south.
  const alongX = g.cols > g.rows
  return alongX === (turn % 2 === 0) ? [2, 1, 1] : [1, 1, 2]
}

// Four level 10 houses merged into a square become a landmark skyscraper
// (Vanguard Tower, src/scene/Landmark.tsx) instead of one scaled-up Sky Tower.
// Four of those merged again make a giant one.
export const LANDMARK_NAME = 'Vanguard Tower'
export const isLandmark = (g: Pick<MergeGroup, 'anchor' | 'cols' | 'rows'>) =>
  g.anchor.def === 'house' && buildingLevel(g.anchor) >= MAX_BUILDING_LEVEL && g.cols === g.rows
