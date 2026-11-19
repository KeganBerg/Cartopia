import { useLayoutEffect, useMemo, useRef } from 'react'
import { BatchedMesh, Matrix4, type BufferGeometry, type Group, type Material, type Mesh } from 'three'
import { TILE, buildingDef } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { Batch } from './Batch'
import { ROAD, WALK } from './RaceVenues'
import { paverTex } from './textures'
import { LAYER } from './layers'

// The shops (and the trees between them) lining Main Street in a race.
// A mile race lines the road with hundreds of them. Built one by one, each copy
// was its own building, merged again on top: a mile on Main Street took over
// half a gigabyte, and phones closed the tab at the start line. Now each kind of
// shop is built once, merged (Batch), and that merged mesh is drawn at every
// spot it stands, so the street costs the same however long the race is.

export type Slot ={ z: number; side: -1 | 1; def: string }
type Piece = { key: string; def: string; shop: boolean; at: Matrix4[] }

// Where every copy of each piece stands: a shop facing the road on its paving,
// and a tree or palm in the gap after it.
export function streetPieces(slots: Slot[]): Piece[] {
  const pieces = new Map<string, Piece>()
  const add = (key: string, def: string, shop: boolean, at: Matrix4) => {
    let p = pieces.get(key)
    if (!p) pieces.set(key, (p = { key, def, shop, at: [] }))
    p.at.push(at)
  }
  slots.forEach((sl, i) => {
    const d = buildingDef(sl.def)
    const depth = d.h * TILE
    const shop = new Matrix4().makeRotationY(sl.side < 0 ? Math.PI / 2 : -Math.PI / 2)
    shop.setPosition(sl.side * (ROAD + WALK + depth / 2 + 0.1), 0, sl.z)
    add(`shop:${sl.def}`, sl.def, true, shop)
    const tree = i % 3 ? 'tree' : 'palm'
    add(`tree:${tree}`, tree, false, new Matrix4().makeTranslation(sl.side * (ROAD + WALK + 0.9), 0, sl.z + d.w + 0.7))
  })
  return [...pieces.values()]
}

function Shop({ def }: { def: string }) {
  const d = buildingDef(def)
  const depth = d.h * TILE
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={LAYER.lot}>
        <planeGeometry args={[d.w * TILE - 0.1, depth - 0.1]} />
        <meshStandardMaterial map={paverTex(d.w, d.h)} />
      </mesh>
      <BuildingModel def={d} />
    </>
  )
}

export function StreetShops({ slots }: { slots: Slot[] }) {
  const pieces = useMemo(() => streetPieces(slots), [slots])
  const models = useRef<Group>(null)
  const shown = useRef<Group>(null)
  // Runs after each piece's Batch has merged it (children's layout effects run first).
  useLayoutEffect(() => {
    const box = models.current
    const out = shown.current
    if (!box || !out) return
    const made: BatchedMesh[] = []
    const where = new Map(pieces.map((p) => [p.key, p.at]))
    // Every copy of every part that draws alike (same material, shadows and layout of its data)
    // goes into one BatchedMesh: one draw for all of them, each copy still skipped when it's off
    // screen. One instanced mesh per part per stretch was over a thousand draws down a race.
    const looks = new Map<string, { like: Mesh; parts: { geometry: BufferGeometry; at: Matrix4[] }[] }>()
    box.children.forEach((holder) => {
      const at = where.get(holder.name)
      // Batch draws its merged meshes in the second of its two groups.
      if (!at) return
      for (const part of holder.children[1]?.children ?? []) {
        const mesh = part as Mesh
        if (!mesh.isMesh || Array.isArray(mesh.material)) continue
        const g = mesh.geometry
        const data = Object.entries(g.attributes).map(([k, a]) => `${k}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`).sort().join()
        const key = `${mesh.material.uuid}|${mesh.castShadow}|${mesh.receiveShadow}|${mesh.renderOrder}|${!!g.index}|${data}`
        let look = looks.get(key)
        if (!look) looks.set(key, (look = { like: mesh, parts: [] }))
        look.parts.push({ geometry: g, at })
      }
    })
    for (const { like, parts } of looks.values()) {
      let copies = 0, verts = 0, indices = 0
      for (const p of parts) {
        copies += p.at.length
        verts += p.geometry.attributes.position.count
        indices += p.geometry.index?.count ?? 0
      }
      const many = new BatchedMesh(copies, verts, indices, like.material as Material)
      for (const p of parts) {
        const id = many.addGeometry(p.geometry)
        for (const m of p.at) many.setMatrixAt(many.addInstance(id), m)
      }
      many.castShadow = like.castShadow
      many.receiveShadow = like.receiveShadow
      many.renderOrder = like.renderOrder
      // Solid parts don't need putting in order every frame; see-through ones do.
      many.sortObjects = (like.material as Material).transparent
      many.raycast = () => {}
      made.push(many)
      out.add(many)
    }
    // The models themselves are only the pattern: not drawn, and not placed again every frame
    // (thousands of hidden parts, the most matrix work in a Main Street race).
    box.visible = false
    box.matrixWorldAutoUpdate = false
    return () => {
      for (const m of made) {
        out.remove(m)
        m.dispose()
      }
      box.visible = true
      box.matrixWorldAutoUpdate = true
    }
  }, [pieces])
  return (
    <>
      <group ref={models}>
        {pieces.map((p) => (
          <group key={p.key} name={p.key}>
            <Batch version={p.key}>{p.shop ? <Shop def={p.def} /> : <BuildingModel def={buildingDef(p.def)} />}</Batch>
          </group>
        ))}
      </group>
      <group ref={shown} />
    </>
  )
}
