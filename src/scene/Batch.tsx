import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { BufferAttribute, BufferGeometry, Color, Group, Matrix4, Mesh, Texture, Vector3, type Material, type Object3D } from 'three'
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

// Edit modes keep the town merged too: drawn piece by piece, a big town is
// thousands of draws a frame, enough to stall a PC. Only road and bulldoze,
// which change the town every tile they paint, draw it live. In Move the picked
// building is marked noBatch so it can be dragged and turned (see World).
export const batchOff = (mode: string) => mode === 'road' || mode === 'bulldoze'

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

export function Batch({ version, off, cell, children }: { version: unknown; off?: boolean; cell?: number; children: ReactNode }) {
  const root = useRef<Group>(null)
  const merged = useRef<Group>(null)
  // What the last rebuild made, by bucket, and the originals it hid. A rebuild
  // keeps every merged mesh whose parts haven't changed: placing or upgrading
  // one building re-merges its own cell, not the whole town (that took seconds).
  const made = useRef(new Map<string, Merged>())
  const hidden = useRef(new Set<Mesh>())
  const prepared = useRef(new WeakMap<Mesh, { id: string; part: BufferGeometry }>()).current
  const placed = useRef(new WeakMap<Mesh, { at: Matrix4; gid: number; id: string; where: string }>()).current

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
    if (off) return drop(new Map(), new Set())
    r.updateMatrixWorld(true)
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
      if (!mesh.isMesh || (mesh as { isInstancedMesh?: boolean }).isInstancedMesh) return
      if (Array.isArray(mesh.material) || mesh.morphTargetInfluences) return
      const g = mesh.geometry
      names.length = 0
      for (const n of ATTRS) if (g.getAttribute(n)) names.push(n)
      if (!names.includes('position')) return
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
      if (o !== r && ((!o.visible && !o.userData.batched) || o.userData.noBatch)) return
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
        if (!geo) continue
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
  }, [version, off, cell])

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
    },
    [],
  )

  return (
    <>
      <group ref={root}>{children}</group>
      <group ref={merged} />
    </>
  )
}
