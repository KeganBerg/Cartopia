import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { BufferAttribute, BufferGeometry, Color, Group, Matrix4, Mesh, Object3D, Texture, Vector3, type Material } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { glowMats } from './dayNight'
import { addHours } from './closingTime'
import { bake, bakeable, bakedMapMaterial, bakedMaterial, finishOf, textureKey, type Finish } from './bake'

// Every road tile, lawn and building is dozens of tiny meshes, and phones choke
// on the per-object cost of drawing ~1000 of them each frame. Batch merges every
// static mesh below it that looks the same (same material settings and shadow
// flags) into one mesh, so the town costs a few dozen draws instead.
// The originals stay in the scene, hidden, so taps still hit them; rebuilding
// happens whenever `version` changes, and `off` restores the originals (for
// modes where pieces move, like dragging a building).
// Meshes whose material is plain (at most a colour map, not see-through: see
// bake.ts) go further: whatever their colour, they are baked into one mesh per
// shadow setup and texture image, so dozens of colours, and every tiling of one
// image, cost one draw.
// With `cell` set (the town), baked meshes are also split into square cells that
// many world units wide, so the camera skips the parts of a big town that are off
// screen instead of pushing every triangle in town through the GPU each frame.

// Every mode keeps the town merged: drawn piece by piece, a big town is thousands
// of draws a frame, enough to stall a PC (Edit, then Road and Bulldoze, used to
// draw it live). Rebuilds only re-merge what changed, so painting road re-merges
// the road's own patch. In Move the picked building is marked noBatch so it can
// be dragged and turned (see World).

// Materials that change over time (night glow) must be kept by identity.
const live = new Set<Material>(Object.values(glowMats))
const ATTRS = ['position', 'normal', 'uv'] as const
const SKIP = new Set(['uuid', 'id', 'name', 'version', 'userData', 'type'])
const baked = bakedMaterial()

function look(m: Material) {
  if (live.has(m) || m.userData.live) return m.uuid
  const parts = [m.type]
  for (const [k, v] of Object.entries(m)) {
    if (SKIP.has(k) || k.startsWith('_')) continue
    if (v instanceof Color) parts.push(`${k}:${v.getHexString()}`)
    else if (v instanceof Texture) parts.push(`${k}:${v.uuid}`)
    else if (v === null || typeof v !== 'object') parts.push(`${k}:${String(v)}`)
  }
  return parts.join('|')
}

function prepare(g: BufferGeometry, m: Matrix4, names: readonly string[]) {
  const out = new BufferGeometry()
  for (const n of names) out.setAttribute(n, g.getAttribute(n).clone())
  if (g.index) out.setIndex(g.index.clone())
  else out.setIndex(new BufferAttribute(Uint32Array.from({ length: g.getAttribute('position').count }, (_, i) => i), 1))
  out.applyMatrix4(m)
  return out
}

// Which cell a part's centre falls in; parts bigger than a cell (ground planes) share one.
const centre = new Vector3()
function cellOf(g: BufferGeometry, at: Matrix4, size: number) {
  if (!g.boundingSphere) g.computeBoundingSphere()
  const s = g.boundingSphere!
  if (s.radius * at.getMaxScaleOnAxis() > size) return 'wide'
  centre.copy(s.center).applyMatrix4(at)
  return `${Math.floor(centre.x / size)},${Math.floor(centre.z / size)}`
}

// Freezing (the town): three works out every object's matrix every frame, and a
// big town is ~40,000 objects, nearly all of them hidden originals of merged
// meshes that never move. A frozen Batch updates them all only when it rebuilds;
// between rebuilds, each frame updates only the lots (buildings) with something
// live in them (noBatch parts, particles, instanced or unmerged meshes), plus any
// lot something was just added to.
type Frozen = { on: boolean; live: Set<Object3D>; pending: Set<Object3D> }
const fullUpdate = Object3D.prototype.updateMatrixWorld
const spotWorld = new Matrix4()
// New objects mounted between rebuilds (R3F and three both announce them with
// 'childadded') get their lot updated on the next frame, so nothing shows up at
// the origin.
// Groups a pruning Batch hid (kept here, not in userData, which React may replace).
const prunedSet = new WeakSet<Object3D>()
const dispatch = Object3D.prototype.dispatchEvent
Object3D.prototype.dispatchEvent = function (this: Object3D, e: Parameters<typeof dispatch>[0]) {
  if (e.type === 'childadded') {
    // Something new inside a group a pruning Batch hid: show the group again.
    for (let p: Object3D | null = this; p; p = p.parent) if (prunedSet.has(p)) { p.visible = true; prunedSet.delete(p) }
    let lot: Object3D | null = null
    for (let p: Object3D | null = (e as { child?: Object3D }).child ?? this; p; p = p.parent) {
      const f = p.userData.frozen as Frozen | undefined
      if (f) {
        if (f.on && lot) f.pending.add(lot)
        break
      }
      if (!lot && (p.userData.hours || p.parent?.userData.frozen)) lot = p
    }
  }
  return dispatch.call(this, e)
} as typeof dispatch

// One merged mesh and the parts it was built from. `sig` lists those parts (and
// where and how they sit), so a rebuild can tell which merged meshes still match.
type Merged = { sig: string; mesh: Mesh }
type Bucket = { sig: string[]; build: () => BufferGeometry | null; mat: Material; cast: boolean; receive: boolean; order: number; members: Mesh[] }

// Enough of a part's place to notice it moved, turned or grew, as one number.
const PLACE = [0, 1, 2, 5, 8, 10, 12, 13, 14]
const placeOf = (m: Matrix4) => {
  const e = m.elements
  let h = 0
  for (const i of PLACE) h = Math.imul(h ^ Math.round(e[i] * 1e4), 0x5bd1e995) >>> 0
  return h
}
// Plain looks are baked into vertices, so a colour changed in place counts as a change too.
const finishSig = (m: Material) => {
  const x = m as Material & { color?: Color; emissive?: Color; emissiveIntensity?: number; roughness?: number; metalness?: number; map?: Texture | null }
  return `${x.color?.getHex()}|${x.emissive?.getHex()}|${x.emissiveIntensity}|${x.roughness}|${x.metalness}|${m.side}|${x.map?.uuid}|${x.map?.matrix.elements.join()}`
}

// `prune` (with `freeze`): groups left holding nothing but merged parts are hidden too, so the
// renderer stops walking thousands of empty groups every frame (most of a kart race's scene).
// `release` (the town): a merged mesh's vertices leave the page's memory once they're
// on the GPU. Nothing reads them back (merged meshes aren't tapped, and a rebuild
// merges afresh), and the town reloads if the GPU drops its context. In a big town
// that's the largest thing the page holds: ~180 MB a phone was keeping twice.
function releaseOnUpload(g: BufferGeometry) {
  if (!g.boundingSphere) g.computeBoundingSphere()
  for (const a of [...Object.values(g.attributes), g.index]) if (a instanceof BufferAttribute) a.onUpload(dropArray)
}
function dropArray(this: { array: unknown }) {
  this.array = null
}

export function Batch({ version, off, cell, freeze, prune, release, children }: { version: unknown; off?: boolean; cell?: number; freeze?: boolean; prune?: boolean; release?: boolean; children: ReactNode }) {
  const root = useRef<Group>(null)
  const merged = useRef<Group>(null)
  // What the last rebuild made, by bucket, and the originals it hid. A rebuild
  // keeps every merged mesh whose parts haven't changed: placing or upgrading
  // one building re-merges its own cell, not the whole town (that took seconds).
  const made = useRef(new Map<string, Merged>())
  const hidden = useRef(new Set<Mesh>())
  const pruned = useRef<Object3D[]>([])
  const unprune = () => {
    for (const g of pruned.current) if (prunedSet.has(g)) { g.visible = true; prunedSet.delete(g) }
    pruned.current = []
  }
  const prepared = useRef(new WeakMap<Mesh, { id: string; part: BufferGeometry }>()).current
  const placed = useRef(new WeakMap<Mesh, { at: Matrix4; gid: number; id: string; where: string }>()).current
  const frozen = useRef<Frozen | null>(null)
  // With `freeze`, everything merged stops having its matrices worked out every frame (see Frozen).
  const setRoot = (g: Group | null) => {
    root.current = g
    if (!g || !freeze || frozen.current) return
    const f: Frozen = (frozen.current = { on: false, live: new Set(), pending: new Set() })
    g.userData.frozen = f
    g.updateMatrixWorld = (force?: boolean) => {
      if (!f.on) return fullUpdate.call(g, force)
      if (g.matrixAutoUpdate) g.updateMatrix()
      if (g.matrixWorldNeedsUpdate || force) {
        if (g.parent) spotWorld.multiplyMatrices(g.parent.matrixWorld, g.matrix)
        else spotWorld.copy(g.matrix)
        // The whole batch moved: everything under it moved with it.
        if (!spotWorld.equals(g.matrixWorld)) return fullUpdate.call(g, true)
        g.matrixWorldNeedsUpdate = false
      }
      for (const o of f.live) o.updateMatrixWorld(true)
      for (const o of f.pending) if (o.parent) o.updateMatrixWorld(true)
      f.pending.clear()
    }
  }

  useLayoutEffect(() => {
    const r = root.current
    const out = merged.current
    if (!r || !out) return
    const drop = (keep: Map<string, Merged>, nowHidden: Set<Mesh>) => {
      for (const [k, m] of made.current) {
        if (keep.get(k) === m) continue
        out.remove(m.mesh)
        m.mesh.geometry.dispose()
      }
      for (const mesh of hidden.current) {
        if (nowHidden.has(mesh)) continue
        mesh.visible = true
        delete mesh.userData.batched
      }
      made.current = keep
      hidden.current = nowHidden
    }
    unprune()
    const f = frozen.current
    if (f) {
      f.on = false
      f.live.clear()
      f.pending.clear()
    }
    if (off) return drop(new Map(), new Set())
    fullUpdate.call(r, true)
    // The lot (building) or top-level piece something live sits in: what to keep updating.
    const lotOf = (o: Object3D) => {
      let top = o
      for (let p: Object3D | null = o; p && p !== r; p = p.parent) {
        if (p.userData.hours) return p
        top = p
      }
      return top
    }
    const alive = (o: Object3D) => f?.live.add(lotOf(o))
    const inv = new Matrix4().copy(r.matrixWorld).invert()
    const spot = new Matrix4()
    const buckets = new Map<string, Bucket>()
    const bakes = new Map<Bucket, { uvs: boolean; parts: [BufferGeometry, Finish, Matrix4][] }>()
    const sets = new Map<Bucket, [Mesh, Matrix4, string][]>()
    // Per material, worked out once per rebuild (a big town has tens of thousands of parts but few materials).
    type Look = { kind: ReturnType<typeof bakeable>; finish?: Finish; sig?: string; tex?: string; look?: string }
    const looks = new Map<Material, Look>()
    const lookOf = (mat: Material) => {
      let l = looks.get(mat)
      if (!l) {
        l = { kind: !live.has(mat) && !mat.userData.live && bakeable(mat) }
        if (l.kind) {
          l.finish = finishOf(mat as Parameters<typeof finishOf>[0])
          l.sig = finishSig(mat)
          const map = (mat as { map?: Texture | null }).map
          if (l.kind === 'map' && map) l.tex = textureKey(map)
        }
        looks.set(mat, l)
      }
      return l
    }
    const names: string[] = []
    const take = (mesh: Mesh) => {
      const o = mesh as Object3D & { isPoints?: boolean; isLine?: boolean; isSprite?: boolean; isLight?: boolean; isInstancedMesh?: boolean }
      // Anything drawn that stays out of the merge keeps its matrices updated.
      if (!mesh.isMesh) return void ((o.isPoints || o.isLine || o.isSprite || o.isLight) && alive(o))
      if (o.isInstancedMesh || Array.isArray(mesh.material) || mesh.morphTargetInfluences) return void alive(o)
      const g = mesh.geometry
      names.length = 0
      for (const n of ATTRS) if (g.getAttribute(n)) names.push(n)
      if (!names.includes('position')) return void alive(o)
      const mat = mesh.material
      // Where it sits in the town, worked out again only when it moved.
      spot.multiplyMatrices(inv, mesh.matrixWorld)
      let p = placed.get(mesh)
      if (!p || p.gid !== g.id || !p.at.equals(spot)) {
        const at = spot.clone()
        placed.set(mesh, (p = { at, gid: g.id, id: `${mesh.id}:${g.id}:${placeOf(at)}`, where: cell ? cellOf(g, at, cell) : '' }))
      }
      const { at, id } = p
      const l = lookOf(mat)
      const kind = names.includes('normal') && l.kind
      const map = (mat as { map?: Texture | null }).map
      if (kind === 'plain' || (kind === 'map' && map && names.includes('uv'))) {
        const tex = kind === 'map' ? map! : null
        const where = tex ? '' : p.where
        const key = `${tex ? l.tex : ''}#${mesh.castShadow}${mesh.receiveShadow}${mesh.renderOrder}#${where}`
        let b = buckets.get(key)
        if (!b) {
          const parts: [BufferGeometry, Finish, Matrix4][] = []
          const uvs = !!tex
          buckets.set(key, (b = { sig: [], build: () => bake(parts, uvs), mat: tex ? bakedMapMaterial(tex) : baked, cast: mesh.castShadow, receive: mesh.receiveShadow, order: mesh.renderOrder, members: [] }))
          bakes.set(b, { uvs, parts })
        }
        bakes.get(b)!.parts.push([g, l.finish!, at])
        b.sig.push(`${id}:${l.sig}`)
        b.members.push(mesh)
        return
      }
      l.look ??= look(mat)
      const key = `${l.look}#${mesh.castShadow}${mesh.receiveShadow}${mesh.renderOrder}#${names.join()}`
      let b = buckets.get(key)
      if (!b) {
        const parts: [Mesh, Matrix4, string][] = []
        const own = [...names]
        buckets.set(
          key,
          (b = {
            sig: [],
            build: () => {
              // Each part is moved into place once and kept, so re-merging a set
              // after one building changes is only a copy.
              const geos = parts.map(([m, at, id]) => {
                const had = prepared.get(m)
                if (had?.id === id) return had.part
                had?.part.dispose()
                const part = prepare(m.geometry, at, own)
                addHours(part, m, r, m.material as Material)
                prepared.set(m, { id, part })
                return part
              })
              return geos.length === 1 ? geos[0].clone() : mergeGeometries(geos)
            },
            mat,
            cast: mesh.castShadow,
            receive: mesh.receiveShadow,
            order: mesh.renderOrder,
            members: [],
          }),
        )
        sets.set(b, parts)
      }
      sets.get(b)!.push([mesh, at, id])
      b.sig.push(id)
      b.members.push(mesh)
    }
    // Walks the tree, skipping whatever is hidden (by its owner, not by this Batch)
    // or marked noBatch (a building mid-bounce), with everything under it.
    const visit = (o: Object3D) => {
      if (o !== r && ((!o.visible && !o.userData.batched) || o.userData.noBatch)) return void alive(o)
      take(o as Mesh)
      for (const c of o.children) visit(c)
    }
    visit(r)
    const keep = new Map<string, Merged>()
    const nowHidden = new Set<Mesh>()
    for (const [key, b] of buckets) {
      const sig = b.sig.join(';')
      const old = made.current.get(key)
      let m: Merged | null = old && old.sig === sig ? old : null
      if (!m) {
        const geo = b.build()
        if (!geo) {
          b.members.forEach(alive)
          continue
        }
        if (release) releaseOnUpload(geo)
        const mesh = new Mesh(geo, b.mat)
        mesh.castShadow = b.cast
        mesh.receiveShadow = b.receive
        mesh.renderOrder = b.order
        mesh.raycast = () => {}
        out.add(mesh)
        m = { sig, mesh }
      }
      keep.set(key, m)
      for (const mesh of b.members) {
        mesh.visible = false
        mesh.userData.batched = true
        nowHidden.add(mesh)
      }
    }
    drop(keep, nowHidden)
    if (f && prune) {
      // Bottom up: a group whose every child is merged away (or itself pruned) draws nothing.
      const empty = (o: Object3D): boolean => {
        let all = o.children.length > 0
        for (const c of o.children) if (!empty(c)) all = false
        if (o === r) return false
        if (o.userData.batched) return true
        if (!all || !o.visible || (o as Mesh).isMesh || o.userData.noBatch) return false
        o.visible = false
        prunedSet.add(o)
        pruned.current.push(o)
        return true
      }
      empty(r)
    }
    if (f) f.on = true
  }, [version, off, cell, prune, release])

  // Gone from the scene: put the originals back and free the merged meshes.
  useLayoutEffect(
    () => () => {
      for (const m of made.current.values()) {
        merged.current?.remove(m.mesh)
        m.mesh.geometry.dispose()
      }
      for (const mesh of hidden.current) {
        mesh.visible = true
        delete mesh.userData.batched
      }
      made.current = new Map()
      hidden.current = new Set()
      unprune()
    },
    [],
  )

  return (
    <>
      <group ref={setRoot}>{children}</group>
      <group ref={merged} />
    </>
  )
}
