// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Box3, Matrix4, Vector3, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'
import { BUILDINGS } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { KeepShapes, MergeScale } from './mergeScale'
import { limitFor } from './keepShape'

// The Driving Academy's learner cars lap their circuit without touching each
// other, the island and its cones, the stop sign or the parking bay's cones,
// and every one of them comes to a full stop at the stop line. Driven frame by
// frame for a good few laps, on its own lot and merged.

const academy = BUILDINGS.find((d) => d.id === 'academy')!
const SCALES: [number, number, number][] = [[1, 1, 1], [2, 1, 1], [1, 1, 2], [2, 2, 2]]
const DT = 1 / 20
const SECONDS = 70

// A footprint on the ground: middle, half sizes and heading (local +z).
type Rect = { x: number; z: number; hx: number; hz: number; yaw: number }

function overlaps(a: Rect, b: Rect) {
  // Separating axis test on two turned rectangles.
  const axes = [a.yaw, a.yaw + Math.PI / 2, b.yaw, b.yaw + Math.PI / 2]
  const reach = (r: Rect, ax: number, ay: number) => {
    const ux = Math.sin(r.yaw), uz = Math.cos(r.yaw)
    return r.hz * Math.abs(ux * ax + uz * ay) + r.hx * Math.abs(uz * ax - ux * ay)
  }
  for (const t of axes) {
    const ax = Math.sin(t), ay = Math.cos(t)
    const gap = Math.abs((b.x - a.x) * ax + (b.z - a.z) * ay)
    if (gap > reach(a, ax, ay) + reach(b, ax, ay)) return false
  }
  return true
}

const color = (m: Mesh) => (m.material as MeshStandardMaterial | undefined)?.color?.getHexString()

describe('academy learner cars drive clean laps', () => {
  for (const level of [1, 7]) for (const scale of SCALES) {
    it(`level ${level}, block ${scale.join('x')}`, async () => {
      const r = await ReactThreeTestRenderer.create(
        <group scale={scale}>
          <MergeScale.Provider value={scale}>
            <KeepShapes limit={limitFor(academy)}>
              <BuildingModel def={academy} level={level} />
            </KeepShapes>
          </MergeScale.Provider>
        </group>,
      )
      await ReactThreeTestRenderer.act(async () => r.advanceFrames(2, DT))
      const scene = r.scene.instance as Object3D
      scene.updateMatrixWorld(true)
      // The driving cars: whole learner cars inside the moving (noBatch) group.
      const cars: Object3D[] = []
      scene.traverse((o) => {
        if (!o.userData.whole || o.parent?.userData.upright !== true) return
        for (let p = o.parent; p; p = p.parent) if (p.userData.noBatch) return void cars.push(o)
      })
      expect(cars.length).toBe(level >= 7 ? 3 : 2)
      // Each car's footprint in its own frame, measured once.
      const size = cars.map((c) => {
        const inv = new Matrix4().copy(c.matrixWorld).invert()
        const box = new Box3()
        c.traverse((o) => {
          const m = o as Mesh
          // Not the headlight beams (see-through light reaching ahead of the car).
          if (!m.isMesh || !m.geometry || (m.material as MeshStandardMaterial).transparent) return
          m.geometry.computeBoundingBox()
          box.union(m.geometry.boundingBox!.clone().applyMatrix4(new Matrix4().multiplyMatrices(inv, m.matrixWorld)))
        })
        const s = new Vector3().setFromMatrixScale(c.matrixWorld)
        expect(box.max.z - box.min.z).toBeLessThan(1.4)
        return { hx: ((box.max.x - box.min.x) / 2) * s.x, hz: ((box.max.z - box.min.z) / 2) * s.z }
      })
      // Things on the ground they must keep off: cones, the stop sign's pole and the island.
      const fixed: Rect[] = []
      scene.traverse((o) => {
        const m = o as Mesh
        if (!m.isMesh) return
        const type = m.geometry.type
        const p = m.getWorldPosition(new Vector3())
        const s = new Vector3().setFromMatrixScale(m.matrixWorld)
        if (type === 'ConeGeometry') fixed.push({ x: p.x, z: p.z, hx: 0.05 * s.x, hz: 0.05 * s.z, yaw: 0 })
        if (type === 'CylinderGeometry' && color(m) === '9e9e9e') fixed.push({ x: p.x, z: p.z, hx: 0.015 * s.x, hz: 0.015 * s.z, yaw: 0 })
        if (type === 'BoxGeometry' && color(m) === 'fdd835') {
          const { width, height, depth } = (m.geometry as unknown as { parameters: { width: number; height: number; depth: number } }).parameters
          if (Math.abs(height - 0.03) < 1e-6) fixed.push({ x: p.x, z: p.z, hx: (width / 2) * s.x, hz: (depth / 2) * s.z, yaw: 0 })
        }
      })
      expect(fixed.length).toBeGreaterThan(8)
      const hits = new Set<string>()
      const still = cars.map(() => 0)
      const stopped = cars.map(() => false)
      const last = cars.map(() => new Vector3())
      const q = new Vector3(), f = new Vector3()
      for (let t = 0; t < SECONDS / DT; t++) {
        await ReactThreeTestRenderer.act(async () => r.advanceFrames(1, DT))
        scene.updateMatrixWorld(true)
        const now: Rect[] = cars.map((c, i) => {
          c.getWorldPosition(q)
          f.set(0, 0, 1).transformDirection(c.matrixWorld)
          // Stood still for a second: a full stop.
          still[i] = q.distanceTo(last[i]) < 1e-4 ? still[i] + 1 : 0
          if (still[i] * DT >= 1) stopped[i] = true
          last[i].copy(q)
          return { x: q.x, z: q.z, ...size[i], yaw: Math.atan2(f.x, f.z) }
        })
        for (let i = 0; i < now.length; i++) {
          for (let j = i + 1; j < now.length; j++) if (overlaps(now[i], now[j])) hits.add(`cars ${i} and ${j} touch at ${(t * DT).toFixed(1)}s`)
          for (const o of fixed) if (overlaps(now[i], o)) hits.add(`car ${i} hits something at ${o.x.toFixed(2)},${o.z.toFixed(2)}`)
        }
      }
      await r.unmount()
      expect([...hits].slice(0, 10)).toEqual([])
      expect(stopped).toEqual(cars.map(() => true))
    }, 120_000)
  }
})
