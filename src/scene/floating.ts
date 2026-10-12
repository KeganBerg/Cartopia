import { Box3, InstancedMesh, Matrix4, Mesh, Plane, Sphere, SphereGeometry, Triangle, Vector3, type BufferGeometry, type Object3D } from 'three'

// Finds pieces of a model that hang in the air: anything not resting on the
// ground or touching something that does. Pieces touch when their real shapes
// meet, not just their bounding boxes: a box round a stadium ring, a turned
// beam or a plinth reaches well past the solid, and a sign hanging inside that
// box with nothing holding it up would pass (the speedway's sign did). So two
// pieces touch only when a point on one (a corner, or a point along an edge)
// is within TOUCH of the other's solid, or a ball (a bulb, a lamp globe) really
// reaches it. Mark something meant to fly (a bird, a drone, a
// glow halo) with userData.air on it or a parent group.
// src/scene/floating.test.tsx runs this over every building.
export const TOUCH = 0.05
// Balls must really sit on or against something, within this.
const SNUG = 0.015

type Piece = { o: Object3D; box: Box3; ball?: Sphere; hull?: Plane[]; pts?: Vector3[]; tris?: Triangle[] }
export type Clump = Piece & { n: number; gap: number; members: Piece[] }

// Solid shapes whose faces bound them, so a point's distance outside is the
// furthest it is past any face.
const CONVEX = /^(Box|Cylinder|Cone|Sphere|Octahedron|Icosahedron|Dodecahedron|Tetrahedron|Capsule)Geometry$/

function airborne(o: Object3D) {
  for (let p: Object3D | null = o; p; p = p.parent) if (p.userData.air) return true
  return false
}

function shown(o: Object3D) {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false
  return true
}

// A shape whose faces really close round it: an open tube, a slice of a cone
// or a dome has no cap, so its face planes don't bound it.
function closed(g: BufferGeometry) {
  const q = (g as unknown as { parameters?: Record<string, number | boolean> }).parameters ?? {}
  if (q.openEnded) return false
  if (q.thetaLength != null && (q.thetaLength as number) < Math.PI * 2 - 1e-6 && !/Sphere/.test(g.type)) return false
  if (/Sphere/.test(g.type) && ((q.phiLength as number) < Math.PI * 2 - 1e-6 || (q.thetaLength as number) < Math.PI - 1e-6)) return false
  return true
}

// Points on a shape in its own space: its corners and points along its edges,
// no further apart than STEP, so a board crossing a post finds the post.
const STEP = 0.04
const samples = new WeakMap<BufferGeometry, Vector3[]>()
function samplesOf(g: BufferGeometry) {
  let out = samples.get(g)
  if (out) return out
  out = []
  const pos = g.getAttribute('position')
  const idx = g.getIndex()
  const n = idx ? idx.count : pos.count
  const key = (v: Vector3) => `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`
  const seen = new Set<string>()
  const a = new Vector3(), b = new Vector3()
  const at = (i: number, v: Vector3) => v.fromBufferAttribute(pos, idx ? idx.getX(i) : i)
  for (let i = 0; i + 2 < n; i += 3) for (let e = 0; e < 3; e++) {
    at(i + e, a)
    at(i + ((e + 1) % 3), b)
    const k = [key(a), key(b)].sort().join('|')
    if (seen.has(k)) continue
    seen.add(k)
    const m = Math.min(24, Math.max(1, Math.ceil(a.distanceTo(b) / STEP)))
    for (let j = 0; j < m; j++) out.push(a.clone().lerp(b, j / m))
  }
  samples.set(g, out)
  return out
}

const tris = new WeakMap<BufferGeometry, Triangle[]>()
function trisOf(g: BufferGeometry) {
  let out = tris.get(g)
  if (out) return out
  out = []
  const pos = g.getAttribute('position')
  const idx = g.getIndex()
  const n = idx ? idx.count : pos.count
  const at = (i: number) => new Vector3().fromBufferAttribute(pos, idx ? idx.getX(i) : i)
  for (let i = 0; i + 2 < n; i += 3) out.push(new Triangle(at(i), at(i + 1), at(i + 2)))
  tris.set(g, out)
  return out
}

const hulls = new WeakMap<BufferGeometry, Plane[]>()
// The geometry's face planes in its own space, one per direction.
function hullOf(g: BufferGeometry) {
  let h = hulls.get(g)
  if (h) return h
  h = []
  const pos = g.getAttribute('position')
  const idx = g.getIndex()
  const n = idx ? idx.count : pos.count
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), t = new Triangle()
  const at = (i: number, v: Vector3) => v.fromBufferAttribute(pos, idx ? idx.getX(i) : i)
  for (let i = 0; i + 2 < n; i += 3) {
    t.set(at(i, a), at(i + 1, b), at(i + 2, c))
    if (t.getArea() < 1e-9) continue
    const p = t.getPlane(new Plane())
    if (!h.some((q) => q.normal.dot(p.normal) > 0.9999 && Math.abs(q.constant - p.constant) < 1e-5)) h.push(p)
  }
  hulls.set(g, h)
  return h
}

export function pieces(root: Object3D) {
  root.updateMatrixWorld(true)
  const out: Piece[] = []
  const m = new Matrix4()
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh || !shown(o) || airborne(o)) return
    const g = mesh.geometry
    if (!g.boundingBox) g.computeBoundingBox()
    if (!g.boundingBox || g.boundingBox.isEmpty()) return
    if ((o as InstancedMesh).isInstancedMesh) {
      const im = o as InstancedMesh
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, m)
        out.push({ o, box: g.boundingBox.clone().applyMatrix4(m.premultiply(im.matrixWorld)) })
      }
      return
    }
    const p: Piece = { o, box: g.boundingBox.clone().applyMatrix4(mesh.matrixWorld) }
    if (g instanceof SphereGeometry && g.parameters.phiLength >= Math.PI * 2 - 1e-6 && g.parameters.thetaLength >= Math.PI - 1e-6) {
      const s = mesh.matrixWorld.getMaxScaleOnAxis()
      p.ball = new Sphere(new Vector3().setFromMatrixPosition(mesh.matrixWorld), g.parameters.radius * s)
    }
    if (CONVEX.test(g.type) && closed(g)) {
      p.hull = hullOf(g).map((q) => q.clone().applyMatrix4(mesh.matrixWorld))
      // A mirrored piece turns its faces inside out.
      if (mesh.matrixWorld.determinant() < 0) p.hull.forEach((q) => q.negate())
    } else if (g.getAttribute('position')) {
      p.tris = trisOf(g).map((t) => new Triangle(t.a.clone().applyMatrix4(mesh.matrixWorld), t.b.clone().applyMatrix4(mesh.matrixWorld), t.c.clone().applyMatrix4(mesh.matrixWorld)))
    }
    if (g.getAttribute('position')) p.pts = samplesOf(g).map((v) => v.clone().applyMatrix4(mesh.matrixWorld))
    out.push(p)
  })
  return out
}

// How far `x` is outside a convex hull (0 inside); never more than the true distance.
function outside(hull: Plane[], x: Vector3) {
  let d = 0
  for (const q of hull) d = Math.max(d, q.distanceToPoint(x))
  return d
}

const near = new Vector3()
// How far `x` is from a piece's solid (its surface, for an open shape).
function distance(p: Piece, x: Vector3) {
  if (p.hull) return outside(p.hull, x)
  let d = Infinity
  for (const t of p.tris!) d = Math.min(d, t.closestPointToPoint(x, near).distanceTo(x))
  return d
}

// How close counts as touching for the model being checked: TOUCH, grown with
// a merged block (a 4x4 block draws every gap four times as wide).
let touch = TOUCH
// Whether a point on `a` comes within touch of `b`'s solid.
function reaches(a: Piece, b: Piece) {
  const near = b.box.clone().expandByScalar(touch)
  for (const x of a.pts!) if (near.containsPoint(x) && distance(b, x) <= touch) return true
  return false
}

function touching(a: Piece, b: Piece, ea: Box3, eb: Box3) {
  if (!ea.intersectsBox(eb)) return false
  if (a.ball && b.ball) return a.ball.center.distanceTo(b.ball.center) <= a.ball.radius + b.ball.radius + (SNUG * touch) / TOUCH
  if (a.ball && b.hull) return outside(b.hull, a.ball.center) <= a.ball.radius + (SNUG * touch) / TOUCH
  if (b.ball && a.hull) return outside(a.hull, b.ball.center) <= b.ball.radius + (SNUG * touch) / TOUCH
  // Crowds (instanced) are only known by their boxes.
  if (!a.pts || !b.pts || (!a.hull && !a.tris) || (!b.hull && !b.tris)) return true
  return reaches(a, b) || reaches(b, a)
}

// Every clump of touching pieces that no chain of touching pieces links to the
// ground (y = 0), with how far it is from the nearest grounded piece. `k` is
// how much a merged block scales the model up (2 for a 2x2, 4 for a 4x4).
export function floating(root: Object3D, ground = TOUCH, k = 1) {
  touch = TOUCH * k
  const ps = pieces(root)
  const big = ps.map((p) => p.box.clone().expandByScalar(touch / 2))
  const held = ps.map((p) => p.box.min.y <= ground)
  const spread = (seed: number[], mark: boolean[], ok: (j: number) => boolean) => {
    const queue = [...seed]
    while (queue.length) {
      const i = queue.pop()!
      for (let j = 0; j < ps.length; j++) if (!mark[j] && ok(j) && touching(ps[i], ps[j], big[i], big[j])) {
        mark[j] = true
        queue.push(j)
      }
    }
  }
  spread(held.flatMap((h, i) => (h ? [i] : [])), held, () => true)
  const grounded = ps.filter((_, i) => held[i])
  const seen = [...held]
  const clumps: Clump[] = []
  for (let i = 0; i < ps.length; i++) {
    if (seen[i]) continue
    const mark = ps.map(() => false)
    mark[i] = seen[i] = true
    spread([i], mark, (j) => !held[j])
    const members = ps.filter((_, j) => mark[j])
    for (let j = 0; j < ps.length; j++) if (mark[j]) seen[j] = true
    const low = members.reduce((a, b) => (b.box.min.y < a.box.min.y ? b : a))
    const gap = Math.min(...members.flatMap((m) => grounded.map((q) => gapOf(m.box, q.box))))
    clumps.push({ ...low, n: members.length, gap, members })
  }
  return clumps
}

function gapOf(a: Box3, b: Box3) {
  const d = (lo1: number, hi1: number, lo2: number, hi2: number) => Math.max(0, lo2 - hi1, lo1 - hi2)
  return Math.hypot(d(a.min.x, a.max.x, b.min.x, b.max.x), d(a.min.y, a.max.y, b.min.y, b.max.y), d(a.min.z, a.max.z, b.min.z, b.max.z))
}

export function describe(p: Clump) {
  const path: string[] = []
  for (let o: Object3D | null = p.o; o && path.length < 3; o = o.parent) path.push(o.name || ((o as Mesh).geometry ? (o as Mesh).geometry.type.replace('Geometry', '') : o.type))
  const c = p.box.getCenter(new Vector3())
  // Colour and size, to find the piece in the model's code.
  const mesh = p.o as Mesh & { material: { color?: { getHexString(): string } } }
  const args = Object.values((mesh.geometry as unknown as { parameters?: Record<string, unknown> }).parameters ?? {}).filter((v) => typeof v === 'number').slice(0, 3).map((v) => +(v as number).toFixed(3))
  return `${p.n} piece${p.n > 1 ? 's' : ''} ${p.gap.toFixed(2)} off: ${path.join('<')} #${mesh.material?.color?.getHexString?.() ?? '?'} [${args.join(',')}] @${[c.x, c.y, c.z].map((v) => v.toFixed(2)).join(',')}`
}

// For a floating clump: the nearest other piece and how far its points are
// from that piece's solid (to tell a hairline gap from a real one).
export function nearest(root: Object3D, c: Clump) {
  const ps = pieces(root)
  const inC = new Set(c.members.map((m) => m.o))
  let best = { d: Infinity, o: null as Object3D | null }
  for (const m of c.members) {
    const mp = ps.find((p) => p.o === m.o && p.box.equals(m.box))
    if (!mp?.pts) continue
    for (const q of ps) {
      if (inC.has(q.o) || (!q.hull && !q.tris)) continue
      if (gapOf(mp.box, q.box) > 0.3) continue
      for (const x of mp.pts) {
        const d = distance(q, x)
        if (d < best.d) best = { d, o: q.o }
      }
    }
  }
  return best
}

// Low slabs that hover: a doorstep, a mat, a ramp or a planter's base just off
// the ground with daylight under it. The contact check above lets anything
// within TOUCH of the ground or a wall count as held, so a step 0.04 up next to
// a wall passes there; up close at street level the gap and its shadow show.
// A slab-like piece low down (its bottom between the lot paving and LOW, no
// taller than SLAB, at least FOOT across) must sit on the lot paving
// (LOT, see layers.ts) or on top of something under it, within REST, or be
// held at both ends (a shelf between two posts). A flat sheet (paint, a lily
// pad) has no side to show a gap, so it may sit up to SHEET above what's under it.
const LOT = 0.02
const LOW = 0.2
const SLAB = 0.12
const FOOT = 0.1
const SHEET = 0.02
export const REST = 0.006
const up = new Vector3()
export function hovering(root: Object3D) {
  const ps = pieces(root).filter((p) => !p.ball)
  const out: Piece[] = []
  const over = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0)
  for (const p of ps) {
    const b = p.box
    const lo = b.min.y
    const flat = b.max.y - lo < 0.002
    const rest = flat ? SHEET : REST
    if (lo <= LOT + REST || lo > LOW) continue
    if (b.max.y - lo > SLAB || Math.min(b.max.x - b.min.x, b.max.z - b.min.z) < FOOT) continue
    // Level slabs only: a tilted plank (a ramp, an arched bridge) leans on its neighbours.
    if (up.setFromMatrixColumn(p.o.matrixWorld, 1).normalize().y < 0.995 && !flat) continue
    const others = ps.filter((q) => q !== p && q.box.min.y < lo - 1e-4)
    const under = others.some((q) => q.box.max.y >= lo - rest && over(b.min.x, b.max.x, q.box.min.x, q.box.max.x) > 0.01 && over(b.min.z, b.max.z, q.box.min.z, q.box.max.z) > 0.01)
    if (under) continue
    // Held at both ends: something coming up from below touches each end (the
    // posts of a shelf, the next planks of an arched bridge).
    const end = (axis: 'x' | 'z', side: -1 | 1) => others.some((q) => {
      const cross = axis === 'x' ? 'z' : 'x'
      if (q.box.max.y < lo || over(b.min[cross], b.max[cross], q.box.min[cross], q.box.max[cross]) <= 0) return false
      const face = side < 0 ? b.min[axis] : b.max[axis]
      return q.box.min[axis] <= face + REST && q.box.max[axis] >= face - REST && (side < 0 ? q.box.min[axis] < face : q.box.max[axis] > face)
    })
    if ((end('x', -1) && end('x', 1)) || (end('z', -1) && end('z', 1))) continue
    out.push(p)
  }
  return out
}
