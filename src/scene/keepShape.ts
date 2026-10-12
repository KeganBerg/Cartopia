import { Box3, BoxGeometry, Matrix3, Matrix4, Object3D, PlaneGeometry, RepeatWrapping, Vector2, Vector3, type BufferAttribute, type BufferGeometry, type InstancedMesh, type Material, type Mesh, type Texture } from 'three'
import { TILE } from '../game/data'

// The maths behind merged blocks keeping their props in shape: see THE RULE
// in mergeScale.tsx.

export const uniform = ([x, y, z]: readonly number[]) => x === y && y === z

// Anything this wide or deeper (in the model's own units) is architecture.
// A car is ~0.7, a school bus ~1.4, a one-tile building ~1.9.
export function propLimit(w: number, d: number) {
  return Math.min(1.45, 0.42 * Math.min(w, d))
}
// A one-tile decoration (a tree, a lamp, a statue) is one prop as a whole:
// merged, it grows evenly to the pair's height instead of having its trunk and
// crown, or post and arm, kept apart. Runs meant to stretch (hedges, fences) don't.
const RUNS = new Set(['hedge', 'fence'])
export function limitFor(def: { id: string; kind: string; w: number; h: number }) {
  if ((def.kind === 'decor' || def.kind === 'obstacle') && def.w === 1 && def.h === 1 && !RUNS.has(def.id)) return Infinity
  return propLimit(def.w * TILE, def.h * TILE)
}
// Anything lower than this is a ground mark (paint, a pad, a pond) and may stretch.
export const FLAT = 0.03

const m4 = new Matrix4()
const inv = new Matrix4()
const p3 = new Matrix3()
const pInv = new Matrix3()
const c3 = new Matrix3()
const own = new Matrix3()

// `off` is how far the prop's origin sits from the point it rests on (the
// bottom of its box, and its inner side when it's off to one side), in the
// block's own unstretched units. Kept at that point, a prop stays on the roof,
// wall or ground it touches instead of drifting off it as the block stretches.
type Shape = { root: Object3D; scale: readonly number[]; k: number; off?: Vector3 }

// What's being kept, by object (not in userData: models share userData objects).
const kept = new WeakMap<Object3D, Shape>()
const rawSet = new WeakMap<InstancedMesh, InstancedMesh['setMatrixAt']>()
export const isKept = (o: Object3D) => kept.has(o)

// Stretched walls, roofs and awnings (see retile): their tiling textures (bricks, siding,
// window grids, stripes) repeat more across the longer face instead of
// stretching, so a pair shows twice the bricks, not bricks twice as wide.
const retiled = new WeakMap<Mesh, BufferGeometry>()


// The linear fix for something whose parent sits at `parent` inside the block:
// the stretch S is undone and a uniform k put back, in the parent's own axes,
// so it works under any turn: C = P^-1 (k S^-1) P.
function fixFor(parent: Object3D, s: Shape, out: Matrix3) {
  inv.copy(s.root.matrixWorld).invert()
  m4.multiplyMatrices(inv, parent.matrixWorld)
  p3.setFromMatrix4(m4)
  if (Math.abs(p3.determinant()) < 1e-9) return false
  pInv.copy(p3).invert()
  const [sx, sy, sz] = s.scale
  const e = out.copy(pInv).elements
  // out = P^-1 * D, D = diag(k/sx, k/sy, k/sz): scale P^-1's columns.
  for (let r = 0; r < 3; r++) {
    e[r] *= s.k / sx
    e[3 + r] *= s.k / sy
    e[6 + r] *= s.k / sz
  }
  out.multiply(p3)
  return true
}

const shift = new Vector3()
// Moves a kept prop back onto what it rests on (see Shape.off); call after fixFor.
function applyAnchor(target: Matrix4, s: Shape) {
  if (!s.off) return
  const [sx, sy, sz] = s.scale
  shift.set(s.off.x * (s.k / sx - 1), s.off.y * (s.k / sy - 1), s.off.z * (s.k / sz - 1)).applyMatrix3(pInv)
  target.elements[12] += shift.x
  target.elements[13] += shift.y
  target.elements[14] += shift.z
}

const zero = new Vector3()
// The anchor offset for a prop with box `b` and origin `o`, hung off a parent
// whose origin is at `p` (all root space, unstretched). A prop off to one side
// of its parent rests on the parent's side facing it: a window on a hall's
// wall, a sign on a booth, a lamp on the lot edge.
export function anchorOf(b: Box3, o: Vector3, p = zero) {
  const side = (lo: number, hi: number, at: number) => (lo > 0 ? at - lo : hi < 0 ? at - hi : 0)
  return new Vector3(side(b.min.x - p.x, b.max.x - p.x, o.x - p.x), o.y - b.min.y, side(b.min.z - p.z, b.max.z - p.z, o.z - p.z))
}

function applyLinear(target: Matrix4, fix: Matrix3) {
  own.setFromMatrix4(target)
  own.premultiply(fix)
  const t = target.elements
  const o = own.elements
  t[0] = o[0]; t[1] = o[1]; t[2] = o[2]
  t[4] = o[3]; t[5] = o[4]; t[6] = o[5]
  t[8] = o[6]; t[9] = o[7]; t[10] = o[8]
}

// Something already kept upright higher up is in true shape; don't fix it twice.
function underKept(o: Object3D, root: Object3D) {
  for (let p = o.parent; p && p !== root; p = p.parent) if (kept.has(p)) return true
  return false
}

// Nothing to fix: a block grown evenly to exactly the size wanted.
const same = (s: Shape) => uniform(s.scale) && s.k === s.scale[0]

// Keeps `o` in true shape every frame, wherever it moves or turns.
export function keepShape(o: Object3D, root: Object3D, scale: readonly number[], k = Math.min(scale[0], scale[2]), off?: Vector3) {
  const shape: Shape = { root, scale, k, off }
  const had = kept.get(o)
  if (had) return void Object.assign(had, shape)
  kept.set(o, shape)
  o.updateMatrix = function () {
    Object3D.prototype.updateMatrix.call(this)
    const s = kept.get(this)
    if (!s || !this.parent || same(s) || underKept(this, s.root)) return
    if (!fixFor(this.parent, s, c3)) return
    applyLinear(this.matrix, c3)
    applyAnchor(this.matrix, s)
  }
  o.matrixAutoUpdate = true
  o.updateMatrix()
}

export function releaseShape(o: Object3D) {
  const raw = retiled.get(o as Mesh)
  if (raw) {
    retiled.delete(o as Mesh)
    ;(o as Mesh).geometry.dispose()
    ;(o as Mesh).geometry = raw
  }
  if (!kept.delete(o)) return
  if ((o as InstancedMesh).isInstancedMesh) return
  delete (o as { updateMatrix?: unknown }).updateMatrix
  o.updateMatrix()
}

// Crowds are instanced: each person part is fixed as it's placed.
export function keepInstances(mesh: InstancedMesh, root: Object3D, scale: readonly number[], k = Math.min(scale[0], scale[2])) {
  const shape: Shape = { root, scale, k }
  const had = kept.get(mesh)
  if (had) return void Object.assign(had, shape)
  kept.set(mesh, shape)
  // Kept across re-scans so a fix is never wrapped round another one.
  const set: InstancedMesh['setMatrixAt'] = rawSet.get(mesh) ?? mesh.setMatrixAt.bind(mesh)
  rawSet.set(mesh, set)
  const tmp = new Matrix4()
  const fix = new Matrix3()
  const fixed = (i: number, m: Matrix4) => {
    const s = kept.get(mesh)
    if (!s || same(s) || underKept(mesh, s.root)) return set(i, m)
    if (!fixFor(mesh, s, fix)) return set(i, m)
    tmp.copy(m)
    applyLinear(tmp, fix)
    // People (userData.feet) keep their true shape round the spot they stand
    // on, so heads and arms stay on bodies instead of drifting with the
    // stretch. `feet(i)` gives that spot for instance i, in the mesh's own
    // units (a mesh squared up with the block).
    const feet = mesh.userData.feet as ((i: number) => readonly number[]) | undefined
    if (feet) {
      const at = feet(i)
      for (let a = 0; a < 3; a++) tmp.elements[12 + a] = at[a] + (tmp.elements[12 + a] - at[a]) * (s.k / s.scale[a])
    }
    return set(i, tmp)
  }
  mesh.setMatrixAt = fixed
  // Fix what's already placed (crowds that only place people once).
  const m = new Matrix4()
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m)
    fixed(i, m)
  }
  mesh.instanceMatrix.needsUpdate = true
}

const box = new Box3()
const at = new Vector3()
const from = new Vector3()

const lettered = (mat: Material | Material[]) => [mat].flat().some((m) => !!(m as { map?: Texture | null }).map?.userData?.text)
const tiles = (mat: Material | Material[]) => [mat].flat().some((m) => (m as { map?: Texture | null }).map?.wrapS === RepeatWrapping)

// Stretched walls, roofs and awnings: see retile below.
const pa = new Vector3(), pb = new Vector3(), pc = new Vector3()
const ua = new Vector2(), ub = new Vector2(), uc = new Vector2()
const du = new Vector3(), dv = new Vector3(), e1 = new Vector3(), e2 = new Vector3()
function retile(mesh: Mesh, back: Matrix4, scale: readonly number[]) {
  if (retiled.has(mesh)) return
  const g0 = mesh.geometry
  if (!(g0 instanceof BoxGeometry || g0 instanceof PlaneGeometry) || !tiles(mesh.material) || !g0.getAttribute('uv')) return
  // The mesh in the model's own frame, and as the block draws it, stretched.
  const model = new Matrix3().setFromMatrix4(m4.multiplyMatrices(back, mesh.matrixWorld))
  const S = new Matrix3().set(scale[0], 0, 0, 0, scale[1], 0, 0, 0, scale[2])
  const lin = new Matrix3().multiplyMatrices(S, model)
  const g = g0.clone()
  const pos = g.getAttribute('position') as BufferAttribute
  const uv = g.getAttribute('uv') as BufferAttribute
  const idx = g.index
  const done = new Uint8Array(uv.count)
  const tri = idx ? idx.count / 3 : pos.count / 3
  const grow = (v: Vector3) => {
    const before = v.clone().applyMatrix3(model).length()
    const after = v.applyMatrix3(lin).length()
    return before > 1e-9 ? after / before : 1
  }
  for (let t = 0; t < tri; t++) {
    const [a, b, c] = [0, 1, 2].map((k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k))
    if (done[a] && done[b] && done[c]) continue
    pa.fromBufferAttribute(pos, a); pb.fromBufferAttribute(pos, b); pc.fromBufferAttribute(pos, c)
    ua.fromBufferAttribute(uv, a); ub.fromBufferAttribute(uv, b); uc.fromBufferAttribute(uv, c)
    // Which way u and v run across this face, in the mesh's own space.
    e1.subVectors(pb, pa); e2.subVectors(pc, pa)
    const s1 = ub.x - ua.x, t1 = ub.y - ua.y, s2 = uc.x - ua.x, t2 = uc.y - ua.y
    const det = s1 * t2 - s2 * t1
    if (Math.abs(det) < 1e-12) continue
    du.copy(e1).multiplyScalar(t2).addScaledVector(e2, -t1).divideScalar(det)
    dv.copy(e2).multiplyScalar(s1).addScaledVector(e1, -s2).divideScalar(det)
    const fu = grow(du), fv = grow(dv)
    for (const i of [a, b, c]) {
      if (done[i]) continue
      done[i] = 1
      uv.setXY(i, uv.getX(i) * fu, uv.getY(i) * fv)
    }
  }
  uv.needsUpdate = true
  retiled.set(mesh, g0)
  mesh.geometry = g
}

// Square blocks (2x2, 4x4) grow the building evenly, but people don't grow
// with it: anything person-sized standing free on the lot (a pump, a parked
// car, a bench, a bin, a townsperson) keeps its true size at its place in the
// bigger block. Model units: a townsperson is about 0.6 tall.
export const HUMAN = 0.9
// Marks something people-sized wherever it stands (a car on a lift, a bus at
// the kerb, a parasol on a patio): kept true size even when it isn't free-standing.
export const PEOPLE_SIZED = { human: true }
// Standing on the lot: on the ground, a kerb, an island or a low deck.
export const GROUND = 0.25

// Animated every frame (models mark these noBatch so Batch leaves them be).
export function moving(o: Object3D) {
  for (let p: Object3D | null = o; p; p = p.parent) if (p.userData.noBatch) return true
  return false
}

function keepPeople(root: Object3D, scale: readonly number[], limit: number) {
  root.updateWorldMatrix(true, true)
  const back = new Matrix4().copy(root.matrixWorld).invert()
  // Moving things (learner cars, fish) aren't structure: what they brush
  // against changes by the frame.
  const boxes: [Object3D, Box3][] = []
  root.traverse((o) => {
    if ((o as Mesh).isMesh && !(o as InstancedMesh).isInstancedMesh && !moving(o)) boxes.push([o, new Box3().setFromObject(o).applyMatrix4(back)])
  })
  const inside = (o: Object3D, c: Object3D) => {
    for (let p: Object3D | null = o; p; p = p.parent) if (p === c) return true
    return false
  }
  // Free-standing: nothing touches it higher than its middle (what it stands
  // on, a kerb or a wheel stop is fine). A fence post with rails through it,
  // a door on a wall or a pillar under a roof is part of something bigger and
  // grows with it.
  const grow = new Box3()
  const free = (c: Object3D, b: Box3) => {
    if (moving(c)) return true
    grow.copy(b).expandByScalar(0.02)
    for (const [o, ob] of boxes) {
      if (ob.isEmpty() || !ob.intersectsBox(grow) || ob.max.y <= (b.min.y + b.max.y) / 2 || inside(o, c)) continue
      return false
    }
    return true
  }
  const marked = (o: Object3D) => {
    o.traverse((c) => {
      if (c === o || !c.userData.human || kept.has(c) || underKept(c, root)) return
      box.setFromObject(c).applyMatrix4(back)
      if (!box.isEmpty()) keepShape(c, root, scale, 1, new Vector3(0, at.setFromMatrixPosition(c.matrixWorld).applyMatrix4(back).y - box.min.y, 0))
    })
  }
  const visit = (o: Object3D) => {
    for (const c of o.children) {
      if (kept.has(c)) continue
      if ((c as InstancedMesh).isInstancedMesh) {
        keepInstances(c as InstancedMesh, root, scale, 1)
        continue
      }
      // An Upright with a size draws at that size itself.
      if (c.userData.upright && c.userData.size != null) continue
      box.setFromObject(c).applyMatrix4(back)
      if (c.userData.human && !box.isEmpty()) {
        keepShape(c, root, scale, 1, new Vector3(0, at.setFromMatrixPosition(c.matrixWorld).applyMatrix4(back).y - box.min.y, 0))
        continue
      }
      if (box.isEmpty() || c.userData.stretch) {
        visit(c)
        continue
      }
      const h = box.max.y - box.min.y
      const person = box.min.y <= GROUND && h >= FLAT && h <= HUMAN && Math.max(box.max.x - box.min.x, box.max.z - box.min.z) <= limit && free(c, box)
      // Kept standing where it stood: its bottom stays on what it stands on.
      if (person) keepShape(c, root, scale, 1, new Vector3(0, at.setFromMatrixPosition(c.matrixWorld).applyMatrix4(back).y - box.min.y, 0))
      // Inside a whole-piece Upright only marked people-sized things are looked for.
      else if (!c.userData.upright) visit(c)
      else marked(c)
    }
  }
  visit(root)
}

// Finds the props under `root` (see THE RULE above) and keeps them upright.
export function keepProps(root: Object3D, scale: readonly number[], limit: number) {
  if (uniform(scale)) return keepPeople(root, scale, Math.min(limit, 1.2))
  root.updateWorldMatrix(true, true)
  const back = new Matrix4().copy(root.matrixWorld).invert()
  const visit = (o: Object3D) => {
    for (const c of o.children) {
      if (kept.has(c)) continue
      if ((c as InstancedMesh).isInstancedMesh) {
        keepInstances(c as InstancedMesh, root, scale)
        continue
      }
      const leaf = (c as Mesh).isMesh && c.children.length === 0
      // Lettering never stretches, however big the sign.
      if (leaf && lettered((c as Mesh).material)) {
        keepShape(c, root, scale)
        continue
      }
      if (c.userData.stretch) {
        if (leaf) retile(c as Mesh, back, scale)
        visit(c)
        continue
      }
      box.setFromObject(c).applyMatrix4(back)
      if (c.userData.upright && !box.isEmpty()) {
        keepShape(c, root, scale, c.userData.tall ? scale[1] : c.userData.size, anchorOf(box, at.setFromMatrixPosition(c.matrixWorld).applyMatrix4(back), from.setFromMatrixPosition(o.matrixWorld).applyMatrix4(back)))
        continue
      }
      if (box.isEmpty()) {
        visit(c)
        continue
      }
      // A whole car (CarModel) is one prop whatever its box, headlight beams and
      // all: kept piece by piece, its wheels would ride out on the stretch while
      // each stayed round, and stick out from the body like outriggers.
      const small = c.userData.whole || (Math.max(box.max.x - box.min.x, box.max.z - box.min.z) <= limit && box.max.y - box.min.y >= FLAT)
      if (small) keepShape(c, root, scale, undefined, anchorOf(box, at.setFromMatrixPosition(c.matrixWorld).applyMatrix4(back), from.setFromMatrixPosition(o.matrixWorld).applyMatrix4(back)))
      else if (leaf) retile(c as Mesh, back, scale)
      else visit(c)
    }
  }
  visit(root)
}
