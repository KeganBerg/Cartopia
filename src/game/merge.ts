// Merged buildings: four matching buildings standing in a square can be merged
// into one big building (2x2), and four of those into a giant one (4x4), so a
// packed town still reads from far out. Merging is only a look and one tap for
// the lot: every building stays in the save with its own job, level and driver,
// so the economy and the cloud guard see exactly what they saw before. The
// top-left building of the block carries `merge: 2 | 4`; the rest are found by
// position. A block that no longer lines up (moved on an older build, levels
// differ) simply shows as separate buildings again.

import { buildingDef, buildingLevel } from './data'
import type { PlacedBuilding } from './store'

export type MergeSize = 2 | 4
export type MergeGroup = {
  anchor: PlacedBuilding
  size: MergeSize
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

export function mergeable(def: string) {
  const d = buildingDef(def)
  return !d.parked && !d.unique && d.kind !== 'obstacle' && d.kind !== 'showroom' && d.kind !== 'garage'
}

const alike = (a: PlacedBuilding, b: PlacedBuilding) => {
  if (a.def !== b.def || buildingLevel(a) !== buildingLevel(b)) return false
  const [w, h] = lot(a)
  const [w2, h2] = lot(b)
  return w === w2 && h === h2
}

const corners = (buildings: PlacedBuilding[]) => new Map(buildings.map((b) => [`${b.x},${b.z}`, b]))

// The n x n square of buildings like `a` with `a` in the top-left corner.
function square(a: PlacedBuilding, n: number, at: Map<string, PlacedBuilding>): PlacedBuilding[] | null {
  const [w, h] = lot(a)
  const out: PlacedBuilding[] = []
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const o = at.get(`${a.x + i * w},${a.z + j * h}`)
      if (!o || !alike(a, o)) return null
      out.push(o)
    }
  }
  return out
}

function group(anchor: PlacedBuilding, size: MergeSize, members: PlacedBuilding[]): MergeGroup {
  const [w, h] = lot(anchor)
  return { anchor, size, members, x: anchor.x, z: anchor.z, w: w * size, h: h * size }
}

export type Merges = { groups: Map<string, MergeGroup>; owner: Map<string, string> }

// Every merged block in the town, by anchor uid, and which block each building belongs to.
export function mergeGroups(buildings: PlacedBuilding[]): Merges {
  const at = corners(buildings)
  const groups = new Map<string, MergeGroup>()
  const owner = new Map<string, string>()
  for (const size of [4, 2] as const) {
    for (const b of buildings) {
      if (b.merge !== size || !mergeable(b.def) || owner.has(b.uid)) continue
      const m = square(b, size, at)
      if (!m || m.some((o) => owner.has(o.uid))) continue
      groups.set(b.uid, group(b, size, m))
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

// Blocks that could be merged right now: four matching loose buildings in a
// square, or four matching merged blocks in a square.
export function mergeCandidates(buildings: PlacedBuilding[], merges = mergeGroups(buildings)): MergeGroup[] {
  const at = corners(buildings)
  const out: MergeGroup[] = []
  for (const b of buildings) {
    if (!mergeable(b.def) || merges.owner.has(b.uid)) continue
    const m = square(b, 2, at)
    if (m && !m.some((o) => merges.owner.has(o.uid))) out.push(group(b, 2, m))
  }
  for (const g of merges.groups.values()) {
    if (g.size !== 2) continue
    const quads = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, j]) => {
      const o = at.get(`${g.x + i * g.w},${g.z + j * g.h}`)
      const q = o && merges.groups.get(o.uid)
      return q && q.size === 2 && alike(g.anchor, q.anchor) ? q : null
    })
    if (quads.every(Boolean)) out.push(group(g.anchor, 4, quads.flatMap((q) => q!.members)))
  }
  return out
}

// Saves with the block merged (anchor flagged, the rest cleared).
export function applyMerge(buildings: PlacedBuilding[], c: MergeGroup): PlacedBuilding[] {
  const ids = new Set(c.members.map((o) => o.uid))
  return buildings.map((b) => (b.uid === c.anchor.uid ? { ...b, merge: c.size } : ids.has(b.uid) ? unflag(b) : b))
}

// Saves with the block split one step: a 4x4 back into four 2x2s, a 2x2 back into four buildings.
export function applySplit(buildings: PlacedBuilding[], g: MergeGroup): PlacedBuilding[] {
  const quads = new Set<string>()
  if (g.size === 4) {
    const [w, h] = lot(g.anchor)
    for (const b of g.members) if ((b.x - g.x) % (w * 2) === 0 && (b.z - g.z) % (h * 2) === 0) quads.add(b.uid)
  }
  const ids = new Set(g.members.map((o) => o.uid))
  return buildings.map((b) => (quads.has(b.uid) ? { ...b, merge: 2 } : ids.has(b.uid) ? unflag(b) : b))
}

function unflag(b: PlacedBuilding): PlacedBuilding {
  if (b.merge == null) return b
  const { merge: _, ...rest } = b
  return rest
}

// Which way the big building faces: towards a road along the block's edge.
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
  const order = d.w === d.h ? [0, 1, 2, 3] : [p, p + 2]
  return order.find(touches) ?? order[0]
}
