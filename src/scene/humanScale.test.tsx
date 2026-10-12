// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Box3, Matrix4, type InstancedMesh, type Mesh, type Object3D } from 'three'
import { BUILDINGS } from '../game/data'
import { mergeable } from '../game/merge'
import { BuildingModel } from './BuildingModel'
import { KeepShapes, MergeScale } from './mergeScale'
import { GROUND, HUMAN, limitFor, moving } from './keepShape'

// People don't grow when buildings merge. A 2x2 or 4x4 block draws the
// building 2x or 4x, but a pump, a parked car, a bench or a townsperson
// standing free on the lot must stay the size it is next to a person, not
// turn into an 80-foot pump. For every building that can merge, at each
// growth form, this measures every free-standing person-sized piece and every
// crowd alone and in a 2x2 and a 4x4, and fails anything that grew or left
// what it stands on.

const LEVELS = [1, 4, 7, 10]
const BLOCKS = [2, 4]
// How much taller than alone a piece may draw (rounding, a bob of the dance).
const GREW = 1.35

type Piece = { path: string; box: Box3; what: string; part: number }

// Index path from the root, so the same piece is found in another render.
const pathOf = (o: Object3D, root: Object3D) => {
  const p: number[] = []
  for (let c = o; c !== root && c.parent; c = c.parent) p.push(c.parent.children.indexOf(c))
  return p.reverse().join('.')
}

// Free-standing person-sized pieces in a render at true size: on the lot,
// no taller than HUMAN, and touched by nothing higher than their middle.
function people(root: Object3D, limit: number) {
  root.updateMatrixWorld(true)
  const boxes: [Object3D, Box3][] = []
  root.traverse((o) => {
    if ((o as Mesh).isMesh && !(o as InstancedMesh).isInstancedMesh && !moving(o)) boxes.push([o, new Box3().setFromObject(o)])
  })
  const within = (o: Object3D, c: Object3D) => {
    for (let p: Object3D | null = o; p; p = p.parent) if (p === c) return true
    return false
  }
  const out: Piece[] = []
  const visit = (o: Object3D) => {
    for (const c of o.children) {
      if ((c as InstancedMesh).isInstancedMesh) continue
      const b = new Box3().setFromObject(c)
      if (b.isEmpty()) continue
      const h = b.max.y - b.min.y
      const g = b.clone().expandByScalar(0.02)
      const alone = moving(c) || boxes.every(([m, mb]) => mb.isEmpty() || !mb.intersectsBox(g) || mb.max.y <= (b.min.y + b.max.y) / 2 || within(m, c))
      if (b.min.y <= GROUND && h >= 0.03 && h <= HUMAN && Math.max(b.max.x - b.min.x, b.max.z - b.min.z) <= limit && alone) out.push({ path: pathOf(c, root), box: b, what: kind(c), part: tallest(c) })
      // An Upright is one piece (a crane, a pylon): it grows or not as a whole.
      else if (!c.userData.upright) visit(c)
    }
  }
  visit(root)
  // Things marked people-sized (cars, buses, parasols), wherever they stand.
  const seen = new Set(out.map((p) => p.path))
  root.traverse((c) => {
    if (!c.userData.human) return
    for (let p = c.parent; p; p = p.parent) if (p.userData.human) return
    const b = new Box3().setFromObject(c)
    const path = pathOf(c, root)
    if (!b.isEmpty() && ![...seen].some((s) => path.startsWith(s))) out.push({ path, box: b, what: kind(c), part: tallest(c) })
  })
  return out
}

// The tallest instance of each crowd part, by path.
function crowds(root: Object3D) {
  root.updateMatrixWorld(true)
  const out = new Map<string, number>()
  const m = new Matrix4()
  root.traverse((o) => {
    const im = o as InstancedMesh
    if (!im.isInstancedMesh || !im.count) return
    if (!im.geometry.boundingBox) im.geometry.computeBoundingBox()
    let top = 0
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m)
      const b = im.geometry.boundingBox!.clone().applyMatrix4(m.premultiply(im.matrixWorld))
      top = Math.max(top, b.max.y - b.min.y)
    }
    out.set(pathOf(o, root), top)
  })
  return out
}

// The height of its tallest single part.
function tallest(o: Object3D) {
  let h = 0
  o.traverse((m) => {
    if (!(m as Mesh).isMesh) return
    const b = new Box3().setFromObject(m)
    h = Math.max(h, b.max.y - b.min.y)
  })
  return h
}

// What a piece is made of, to know it's the same piece in another render.
function kind(o: Object3D) {
  const parts: string[] = []
  o.traverse((m) => {
    const mesh = m as Mesh & { material: { color?: { getHexString(): string } } }
    if (mesh.isMesh) parts.push(`${mesh.geometry.type}${mesh.material.color?.getHexString() ?? ''}`)
  })
  return parts.join()
}

// What a piece is, to find it in the model's code: its shapes and colours.
function label(o: Object3D) {
  const parts: string[] = []
  o.traverse((m) => {
    const mesh = m as Mesh & { material: { color?: { getHexString(): string } } }
    if (mesh.isMesh && parts.length < 3) parts.push(`${mesh.geometry.type.replace('Geometry', '')} #${mesh.material.color?.getHexString() ?? '?'}`)
  })
  const c = new Box3().setFromObject(o).getCenter(o.position.clone())
  return `${parts.join(' + ')} @${[c.x, c.y, c.z].map((v) => v.toFixed(2)).join(',')}`
}

async function draw(def: (typeof BUILDINGS)[number], level: number, k: number) {
  const s: [number, number, number] = [k, k, k]
  const r = await ReactThreeTestRenderer.create(
    <group scale={s}>
      <MergeScale.Provider value={s}>
        <KeepShapes limit={limitFor(def)}>
          <BuildingModel def={def} level={level} />
        </KeepShapes>
      </MergeScale.Provider>
    </group>,
  )
  await ReactThreeTestRenderer.act(async () => r.advanceFrames(2, 1 / 60))
  return r
}

describe('people stay people-sized in merged blocks', () => {
  for (const def of BUILDINGS.filter((d) => !d.parked && mergeable(d.id))) {
    it(def.id, async () => {
      const bad = new Set<string>()
      const limit = Math.min(limitFor(def), 1.2)
      for (const level of LEVELS) {
        const one = await draw(def, level, 1)
        const root1 = one.scene.instance as Object3D
        const props = people(root1.children[0], limit)
        const crowd = crowds(root1.children[0])
        await one.unmount()
        for (const k of BLOCKS) {
          const r = await draw(def, level, k)
          const root = (r.scene.instance as Object3D).children[0]
          root.updateMatrixWorld(true)
          for (const p of props) {
            const o = p.path.split('.').reduce<Object3D | undefined>((a, i) => a?.children[Number(i)], root)
            // A merged block may lay its lot out differently (more pumps, more rows).
            if (!o || kind(o) !== p.what) continue
            const b = new Box3().setFromObject(o)
            // Something moving (a swimming fish, a learner car) is measured by
            // its biggest part: it's in another pose in another render.
            const live = moving(o)
            const was = live ? p.part : p.box.max.y - p.box.min.y
            const now = live ? tallest(o) : b.max.y - b.min.y
            // Still standing on what it stood on, now k times as high.
            if (!live && Math.abs(b.min.y - p.box.min.y * k) > 0.02 * k) bad.add(`L${level} ${k}x${k}: ${label(o)} left its stand: bottom ${b.min.y.toFixed(2)}, should be ${(p.box.min.y * k).toFixed(2)}`)
            if (now > was * GREW) bad.add(`L${level} ${k}x${k}: ${label(o)} ${was.toFixed(2)} tall grew to ${now.toFixed(2)}`)
          }
          for (const [path, was] of crowd) {
            const now = crowds(root).get(path)
            if (now != null && now > was * GREW) bad.add(`L${level} ${k}x${k}: crowd ${path} ${was.toFixed(2)} tall grew to ${now.toFixed(2)}`)
          }
          await r.unmount()
        }
      }
      expect([...bad]).toEqual([])
    })
  }
})
