import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { BufferAttribute, BufferGeometry, Color, Group, Matrix4, Mesh, Texture, type Material } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { glowMats } from './dayNight'
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

function prepare(g: BufferGeometry, m: Matrix4, names: string[]) {
  const out = new BufferGeometry()
  for (const n of names) out.setAttribute(n, g.getAttribute(n).clone())
  if (g.index) out.setIndex(g.index.clone())
  else out.setIndex(new BufferAttribute(Uint32Array.from({ length: g.getAttribute('position').count }, (_, i) => i), 1))
  out.applyMatrix4(m)
  return out
}

export function Batch({ version, off, children }: { version: unknown; off?: boolean; children: ReactNode }) {
  const root = useRef<Group>(null)
  const merged = useRef<Group>(null)

  useLayoutEffect(() => {
    const r = root.current
    const out = merged.current
    if (!r || !out || off) return
    r.updateMatrixWorld(true)
    const inv = new Matrix4().copy(r.matrixWorld).invert()
    const sets = new Map<string, { mat: Material; cast: boolean; receive: boolean; order: number; names: string[]; parts: BufferGeometry[] }>()
    const bakes = new Map<string, { mat: Material; uvs: boolean; cast: boolean; receive: boolean; order: number; parts: [BufferGeometry, Finish, Matrix4][] }>()
    const hidden: Mesh[] = []
    r.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh || (mesh as { isInstancedMesh?: boolean }).isInstancedMesh || !mesh.visible || mesh.userData.noBatch) return
      if (Array.isArray(mesh.material) || mesh.morphTargetInfluences) return
      // Something hidden higher up isn't drawn, so it mustn't be drawn merged either;
      // a group marked noBatch (a building mid-bounce) keeps everything under it live.
      for (let p = mesh.parent; p && p !== r; p = p.parent) if (!p.visible || p.userData.noBatch) return
      const g = mesh.geometry
      const names = ATTRS.filter((n) => g.getAttribute(n))
      if (!names.includes('position')) return
      const mat = mesh.material
      const kind = !live.has(mat) && !mat.userData.live && names.includes('normal') && bakeable(mat)
      const map = (mat as { map?: Texture | null }).map
      if (kind === 'plain' || (kind === 'map' && map && names.includes('uv'))) {
        const tex = kind === 'map' ? map! : null
        const key = `${tex ? textureKey(tex) : ''}#${mesh.castShadow}${mesh.receiveShadow}${mesh.renderOrder}`
        let set = bakes.get(key)
        if (!set) bakes.set(key, (set = { mat: tex ? bakedMapMaterial(tex) : baked, uvs: !!tex, cast: mesh.castShadow, receive: mesh.receiveShadow, order: mesh.renderOrder, parts: [] }))
        set.parts.push([g, finishOf(mat as Parameters<typeof finishOf>[0]), new Matrix4().multiplyMatrices(inv, mesh.matrixWorld)])
        hidden.push(mesh)
        return
      }
      const key = `${look(mesh.material)}#${mesh.castShadow}${mesh.receiveShadow}${mesh.renderOrder}#${names.join()}`
      let set = sets.get(key)
      if (!set) sets.set(key, (set = { mat: mesh.material, cast: mesh.castShadow, receive: mesh.receiveShadow, order: mesh.renderOrder, names, parts: [] }))
      set.parts.push(prepare(g, new Matrix4().multiplyMatrices(inv, mesh.matrixWorld), names))
      hidden.push(mesh)
    })
    const made: Mesh[] = []
    for (const set of bakes.values()) {
      const m = new Mesh(bake(set.parts, set.uvs), set.mat)
      m.castShadow = set.cast
      m.receiveShadow = set.receive
      m.renderOrder = set.order
      m.raycast = () => {}
      out.add(m)
      made.push(m)
    }
    for (const set of sets.values()) {
      const geo = set.parts.length === 1 ? set.parts[0] : mergeGeometries(set.parts)
      if (set.parts.length > 1) set.parts.forEach((p) => p.dispose())
      if (!geo) continue
      const m = new Mesh(geo, set.mat)
      m.castShadow = set.cast
      m.receiveShadow = set.receive
      m.renderOrder = set.order
      m.raycast = () => {}
      out.add(m)
      made.push(m)
    }
    for (const mesh of hidden) mesh.visible = false
    return () => {
      for (const m of made) {
        out.remove(m)
        m.geometry.dispose()
      }
      for (const mesh of hidden) mesh.visible = true
    }
  }, [version, off])

  return (
    <>
      <group ref={root}>{children}</group>
      <group ref={merged} />
    </>
  )
}
