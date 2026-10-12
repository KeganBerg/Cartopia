// @vitest-environment jsdom
import './testCanvas'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Box3, BoxGeometry, InstancedMesh, Matrix3, Matrix4, Mesh, Object3D, PlaneGeometry, Vector3, type Material, type Texture } from 'three'
import { BUILDINGS, TILE } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { KeepShapes, MergeScale } from './mergeScale'
import { FLAT, isKept, limitFor, propLimit } from './keepShape'

// THE RULE (see mergeScale.tsx): in a stretched 1x2 pair, props keep their
// shape. This draws every building, at a few levels, as a pair both ways and
// compares it with the same building unmerged. Anything round (wheels, heads,
// cones, trees, bulbs, posts), anything lettered (signs), and every crowd
// member must come out the same shape, only moved and maybe turned. If this
// fails for a new model, group the prop (a group that size keeps its shape on
// its own), or wrap it in <Upright>; if a small piece really must stretch with
// the walls, wrap it in <Stretch>.

const PAIRS: [number, number, number][] = [[2, 1, 1], [1, 1, 2]]
const LEVELS = [1, 4, 7, 10]
const ROUND = /Cylinder|Cone|Sphere|Circle|Torus|Capsule|Lathe|Ring|hedron|Tube/

async function draw(def: (typeof BUILDINGS)[number], level: number, scale: [number, number, number]) {
  const r = await ReactThreeTestRenderer.create(
    <group scale={scale}>
      <MergeScale.Provider value={scale}>
        <KeepShapes limit={limitFor(def)}>
          <BuildingModel def={def} level={level} />
        </KeepShapes>
      </MergeScale.Provider>
    </group>,
  )
  await ReactThreeTestRenderer.act(async () => r.advanceFrames(2, 1 / 60))
  const scene = r.scene.instance as Object3D
  scene.updateMatrixWorld(true)
  return { r, scene }
}

const lin = (m: Matrix4) => new Matrix3().setFromMatrix4(m)

// True when `x` is a turn times an even size: columns the same length, at right angles.
function conformal(x: Matrix3) {
  const e = x.elements
  const c = [0, 3, 6].map((i) => [e[i], e[i + 1], e[i + 2]])
  const len = c.map((v) => Math.hypot(...v))
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const tol = 0.03 * Math.max(...len)
  return Math.max(...len) - Math.min(...len) < tol && Math.abs(dot(c[0], c[1])) < tol * len[0] && Math.abs(dot(c[0], c[2])) < tol * len[0] && Math.abs(dot(c[1], c[2])) < tol * len[1]
}

function stretched(o: Object3D) {
  for (let p: Object3D | null = o; p; p = p.parent) if (p.userData.stretch) return true
  return false
}

const lettered = (mat: Material | Material[]) => [mat].flat().some((m) => !!((m as { map?: Texture | null }).map?.userData?.text))

function why(o: Object3D) {
  const path: string[] = []
  for (let p: Object3D | null = o; p && path.length < 4; p = p.parent) path.push(p.type + ((p as Mesh).geometry ? `(${(p as Mesh).geometry.type})` : '') + (isKept(p) ? '*' : ''))
  const at = o.getWorldPosition(new Vector3())
  return `${path.join(' < ')} at ${[at.x, at.y, at.z].map((v) => v.toFixed(2)).join(',')}`
}

// Where something would sit with no merge and no fixes: its own position,
// turn and scale, and its parents', up to the block's scale group.
function intended(o: Object3D) {
  const m = new Matrix4()
  for (let p: Object3D | null = o; p && p.parent && p.parent.parent; p = p.parent) m.premultiply(new Matrix4().compose(p.position, p.quaternion, p.scale))
  return m
}

describe('merged pairs keep props in shape', () => {
  // The club's dancers move to the music's clock: hold it still so the merged
  // and unmerged draws catch them in the same pose.
  beforeAll(() => void vi.spyOn(performance, 'now').mockReturnValue(1000))
  afterAll(() => void vi.restoreAllMocks())

  for (const def of BUILDINGS.filter((d) => !d.parked)) {
    it(def.id, async () => {
      const bad = new Set<string>()
      const limit = propLimit(def.w * TILE, def.h * TILE)
      for (const level of LEVELS) {
        // Crowds are compared person by person with the same building unmerged.
        const ref = await draw(def, level, [1, 1, 1])
        const crowdRef: InstancedMesh[] = []
        ref.scene.traverse((o) => void ((o as InstancedMesh).isInstancedMesh && crowdRef.push(o as InstancedMesh)))
        for (const scale of PAIRS) {
          const got = await draw(def, level, scale)
          const crowds: InstancedMesh[] = []
          got.scene.traverse((o) => {
            if (!(o as Mesh).isMesh || stretched(o)) return
            if ((o as InstancedMesh).isInstancedMesh) return void crowds.push(o as InstancedMesh)
            const mesh = o as Mesh
            const g = mesh.geometry
            const text = lettered(mesh.material) && (g instanceof PlaneGeometry || g instanceof BoxGeometry)
            if (!ROUND.test(g.type) && !text) return
            const want = intended(o)
            // Its own size unmerged: ground marks and big round architecture may stretch.
            if (!g.boundingBox) g.computeBoundingBox()
            const b = new Box3().copy(g.boundingBox!).applyMatrix4(want)
            if (b.max.y - b.min.y < FLAT || Math.max(b.max.x - b.min.x, b.max.z - b.min.z) > limit) return
            const w = lin(want)
            if (Math.abs(w.determinant()) < 1e-12) return
            if (!conformal(lin(o.matrixWorld).multiply(w.invert()))) bad.add(`L${level} ${scale}: ${why(o)}`)
          })
          if (crowds.length !== crowdRef.length) bad.add(`L${level} ${scale}: crowds drew differently`)
          crowds.forEach((o, i) => {
            const r = crowdRef[i]
            if (!r) return
            for (let k = 0; k < Math.min(o.count, r.count, 12); k++) {
              const a = new Matrix4(), c = new Matrix4()
              o.getMatrixAt(k, a)
              r.getMatrixAt(k, c)
              const rc = lin(c.premultiply(r.matrixWorld))
              if (Math.abs(rc.determinant()) < 1e-12) continue
              if (!conformal(lin(a.premultiply(o.matrixWorld)).multiply(rc.invert()))) bad.add(`L${level} ${scale}: crowd ${why(o)}`)
            }
          })
          await got.r.unmount()
        }
        await ref.r.unmount()
      }
      expect([...bad]).toEqual([])
    })
  }
})
