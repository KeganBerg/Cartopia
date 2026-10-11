// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Box3, BoxGeometry, CircleGeometry, CylinderGeometry, Matrix3, Mesh, Object3D, PlaneGeometry, Vector3, type Material } from 'three'
import { BUILDINGS, TILE } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { LAYER } from './layers'

// No flicker (Z-fighting): two flat faces that face the same way, overlap and
// sit at (almost) the same height or depth fight over the same pixels, which
// shows as stripes on phones. That's a mat lying flush on the lot paving, a
// sign glued to a wall at the wall's own depth, two pads with the same top.
// This draws a building at each growth form, on the lot paving it sits on in
// town, and lists every such pair. Add a building's id to CHECKED once its
// model passes. Fix one by lifting the top piece a clear
// step (GAP or more), or give a flat decal `decal()` from layers.ts.

const LEVELS = [1, 4, 7, 10]
const CHECKED = new Set(['club'])
// Phones with a 16-bit depth buffer need about this much between two faces.
const GAP = 0.001
// Overlaps smaller than this (in square units) are seams, not visible fights.
const AREA = 0.0004

type Face = { axis: 0 | 1 | 2; sign: 1 | -1; at: number; lo: [number, number]; hi: [number, number]; who: string; off: boolean; mesh: Object3D | null; look: string; glass: boolean; round?: boolean }

const offset = (m: Material | Material[]) => [m].flat().some((x) => x.polygonOffset)
const hidden = (o: Object3D) => {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return true
  return false
}

function label(o: Object3D) {
  const g = (o as Mesh).geometry
  const at = o.getWorldPosition(new Vector3())
  const mat = [(o as Mesh).material].flat()[0] as Material & { color?: { getHexString(): string } }
  return `${g.type} #${mat?.color?.getHexString() ?? '?'} at ${[at.x, at.y, at.z].map((v) => v.toFixed(3)).join(',')}`
}

// The world axis a direction lies along, if it lies along one.
function along(v: Vector3): [0 | 1 | 2, 1 | -1] | null {
  const a = [v.x, v.y, v.z]
  const i = a.findIndex((c) => Math.abs(c) > 0.999 * v.length())
  return i < 0 ? null : [i as 0 | 1 | 2, a[i] > 0 ? 1 : -1]
}

function faces(o: Object3D): Face[] {
  const mesh = o as Mesh
  const g = mesh.geometry
  if (!g.boundingBox) g.computeBoundingBox()
  const box = new Box3().copy(g.boundingBox!).applyMatrix4(o.matrixWorld)
  const lin = new Matrix3().setFromMatrix4(o.matrixWorld)
  const cols = [0, 1, 2].map((i) => new Vector3().setFromMatrix3Column(lin, i))
  const who = label(o)
  const off = offset(mesh.material)
  const mat = [mesh.material].flat()[0] as Material & { color?: { getHexString(): string }; map?: { uuid: string } | null; emissive?: { getHexString(): string } }
  // Two faces drawn the same (same colour, no picture) can't be told apart, so they can't flicker.
  const look = mat.map ? mat.map.uuid : `${mat.type}${mat.color?.getHexString()}${mat.emissive?.getHexString() ?? ''}`
  // See-through glows that don't write depth just add up; they never fight each other.
  const glass = mat.transparent && !mat.depthWrite
  const out: Face[] = []
  const add = (axis: 0 | 1 | 2, sign: 1 | -1, round = false) => {
    const [u, v] = [0, 1, 2].filter((k) => k !== axis) as [number, number]
    const mn = box.min.toArray(), mx = box.max.toArray()
    out.push({ axis, sign, at: sign > 0 ? mx[axis] : mn[axis], lo: [mn[u], mn[v]], hi: [mx[u], mx[v]], who, off, mesh: o, look, glass, round })
  }
  if (g instanceof BoxGeometry) {
    // Only boxes squared up with the world: their faces are the bounding box's.
    const dirs = cols.map(along)
    if (dirs.some((d) => !d)) return out
    for (const [axis] of dirs as [0 | 1 | 2, 1 | -1][]) { add(axis, 1); add(axis, -1) }
  } else if (g instanceof PlaneGeometry || g instanceof CircleGeometry) {
    const d = along(cols[2])
    if (d) add(d[0], d[1], g instanceof CircleGeometry)
  } else if (g instanceof CylinderGeometry) {
    const d = along(cols[1])
    if (!d) return out
    const { radiusTop, radiusBottom, openEnded } = g.parameters
    if (openEnded) return out
    // Cap ends: the top one faces +axis (in its own frame).
    if (radiusTop > 0.001) add(d[0], d[1], true)
    if (radiusBottom > 0.001) add(d[0], (-d[1]) as 1 | -1, true)
  }
  return out
}

// A face pressed against or inside a solid box can't be seen (the back of a
// sign on a wall, the bottom of a step), so it can't flicker.
function buried(f: Face, solids: Box3[]) {
  const [u, v] = [0, 1, 2].filter((k) => k !== f.axis)
  return solids.some((b) => {
    const mn = b.min.toArray(), mx = b.max.toArray()
    return f.at > mn[f.axis] - GAP && f.at < mx[f.axis] + GAP && f.lo[0] > mn[u] - GAP && f.hi[0] < mx[u] + GAP && f.lo[1] > mn[v] - GAP && f.hi[1] < mx[v] + GAP
  })
}

// Round faces (cylinder caps, discs) are only as big as their circle, not their bounding square.
function touch(a: Face, b: Face) {
  const c = (f: Face) => [(f.lo[0] + f.hi[0]) / 2, (f.lo[1] + f.hi[1]) / 2]
  const r = (f: Face) => Math.min(f.hi[0] - f.lo[0], f.hi[1] - f.lo[1]) / 2
  if (a.round && b.round) {
    const [ca, cb] = [c(a), c(b)]
    return Math.hypot(ca[0] - cb[0], ca[1] - cb[1]) < r(a) + r(b) - 0.01
  }
  const [rd, sq] = a.round ? [a, b] : [b, a]
  const [x, y] = c(rd)
  const nx = Math.max(sq.lo[0], Math.min(x, sq.hi[0])), ny = Math.max(sq.lo[1], Math.min(y, sq.hi[1]))
  return Math.hypot(x - nx, y - ny) < r(rd) - 0.01
}

function fights(all: Face[], solids: Map<Object3D, Box3>) {
  const bad: string[] = []
  const list = all.filter((f) => !buried(f, [...solids].filter(([o]) => o !== f.mesh).map(([, b]) => b)))
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j]
      if (a.mesh === b.mesh || a.axis !== b.axis || a.sign !== b.sign) continue
      if (Math.abs(a.at - b.at) >= GAP) continue
      if (a.off !== b.off || a.look === b.look || (a.glass && b.glass)) continue
      const w = Math.min(a.hi[0], b.hi[0]) - Math.max(a.lo[0], b.lo[0])
      const h = Math.min(a.hi[1], b.hi[1]) - Math.max(a.lo[1], b.lo[1])
      if (w <= 0 || h <= 0 || w * h < AREA) continue
      if ((a.round || b.round) && !touch(a, b)) continue
      // The ground never faces down: skip faces the camera can't see from above.
      if (a.axis === 1 && a.sign < 0) continue
      bad.push(`${'xyz'[a.axis]}${a.sign > 0 ? '+' : '-'} ${a.who}  ~  ${b.who}  (${(w * h).toFixed(4)})`)
    }
  }
  return bad
}

async function scan(def: (typeof BUILDINGS)[number], level: number) {
  const r = await ReactThreeTestRenderer.create(<BuildingModel def={def} level={level} />)
  await ReactThreeTestRenderer.act(async () => r.advanceFrames(2, 1 / 60))
  const scene = r.scene.instance as Object3D
  scene.updateMatrixWorld(true)
  const list: Face[] = []
  const solids = new Map<Object3D, Box3>()
  scene.traverse((o) => {
    if (!(o as Mesh).isMesh || (o as Mesh & { isInstancedMesh?: boolean }).isInstancedMesh || hidden(o)) return
    const f = faces(o)
    list.push(...f)
    const mat = [(o as Mesh).material].flat()[0]
    if ((o as Mesh).geometry instanceof BoxGeometry && f.length && !mat.transparent) solids.set(o, new Box3().copy((o as Mesh).geometry.boundingBox!).applyMatrix4(o.matrixWorld))
  })
  // The lot paving the town lays under every building (World.tsx).
  if (def.kind !== 'decor' && def.kind !== 'obstacle') {
    const hw = (def.w * TILE - 0.1) / 2, hd = (def.h * TILE - 0.1) / 2
    list.push({ axis: 1, sign: 1, at: LAYER.lot, lo: [-hw, -hd], hi: [hw, hd], who: 'lot paving', off: false, mesh: null, look: 'lot', glass: false })
  }
  const bad = fights(list, solids)
  await r.unmount()
  return bad
}

describe('no flickering flat faces', () => {
  for (const def of BUILDINGS.filter((d) => CHECKED.has(d.id))) {
    it(def.id, async () => {
      const bad = new Set<string>()
      for (const level of LEVELS) for (const b of await scan(def, level)) bad.add(`L${level} ${b}`)
      expect([...bad]).toEqual([])
    })
  }
})
