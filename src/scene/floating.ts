import { Box3, InstancedMesh, Matrix4, Mesh, Plane, Sphere, SphereGeometry, Triangle, Vector3, type BufferGeometry, type Object3D } from 'three'

// Finds pieces of a model that hang in the air: anything not resting on the
// ground or touching something that does. Pieces touch when their world
// bounding boxes meet; a ball (a bulb, a lamp globe) must also really reach the
// solid shape of what it sits against, since a box round a round plinth or a
// turned beam reaches well past it. That's the case that matters most: strings
// of bulbs hanging off nothing. Mark something meant to fly (a bird, a drone, a
// glow halo) with userData.air on it or a parent group.
// src/scene/floating.test.tsx runs this over every building.
export const TOUCH = 0.05
// Balls must really sit on or against something, within this.
const SNUG = 0.015

type Piece = { o: Object3D; box: Box3; ball?: Sphere; hull?: Plane[] }
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
    if (CONVEX.test(g.type)) {
      p.hull = hullOf(g).map((q) => q.clone().applyMatrix4(mesh.matrixWorld))
      // A mirrored piece turns its faces inside out.
      if (mesh.matrixWorld.determinant() < 0) p.hull.forEach((q) => q.negate())
    }
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

function touching(a: Piece, b: Piece, ea: Box3, eb: Box3) {
  if (!ea.intersectsBox(eb)) return false
  if (a.ball && b.ball) return a.ball.center.distanceTo(b.ball.center) <= a.ball.radius + b.ball.radius + SNUG
  if (a.ball && b.hull) return outside(b.hull, a.ball.center) <= a.ball.radius + SNUG
  if (b.ball && a.hull) return outside(a.hull, b.ball.center) <= b.ball.radius + SNUG
  return true
}

// Every clump of touching pieces that no chain of touching pieces links to the
// ground (y = 0), with how far it is from the nearest grounded piece.
export function floating(root: Object3D, ground = TOUCH) {
  const ps = pieces(root)
  const big = ps.map((p) => p.box.clone().expandByScalar(TOUCH / 2))
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
