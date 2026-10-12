// @vitest-environment jsdom
import '../testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Box3, type Mesh, type Object3D } from 'three'
import { carDef } from '../../game/data'
import { CarModel, carFrame } from '../CarModel'
import { SCANS } from '.'
import { hullGeo, hullX } from './hull'

// Restyled scans stand in for a body's procedural shape, so they have to fit that body:
// same footprint (town traffic spaces cars by it), wheels where carFrame puts them (mods
// and the wheel rig use it), and no more cost to draw than a procedural car.

async function draw(model: string, scan: boolean) {
  const keep = SCANS[model]
  if (!scan) delete SCANS[model]
  const def = carDef(model)
  const r = await ReactThreeTestRenderer.create(<CarModel body={def.body} model={model} color="#e53935" />)
  SCANS[model] = keep
  const scene = r.scene.instance as Object3D
  scene.updateMatrixWorld(true)
  let meshes = 0
  let tris = 0
  scene.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh) return
    meshes++
    const g = m.geometry
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3
  })
  const box = new Box3().setFromObject(scene)
  await r.unmount()
  return { meshes, tris, box }
}

describe('scanned car bodies', () => {
  for (const [model, scan] of Object.entries(SCANS)) {
    it(`${model}: the hull is sound and spans the body's footprint`, () => {
      const f = carFrame(carDef(model).body)
      const parts = hullGeo(scan.hull)
      for (const g of Object.values(parts)) {
        const p = g!.attributes.position.array
        for (let i = 0; i < p.length; i++) expect(Number.isFinite(p[i])).toBe(true)
      }
      const z = scan.hull.z
      expect(z[z.length - 1] - z[0]).toBeCloseTo(f.len, 1)
      // Wide enough to hold the wheels in, never wider than the body.
      expect(hullX(scan.hull, 0, f.lift + 0.15)).toBeGreaterThan(f.bodyW / 2 - 0.03)
      for (const zz of [-f.wz, 0, f.wz]) expect(hullX(scan.hull, zz, f.lift + 0.15)).toBeLessThanOrEqual(f.bodyW / 2 + 0.001)
    })

    it(`${model}: draws in no more meshes than the procedural body, and about as many triangles`, async () => {
      const a = await draw(model, true)
      const b = await draw(model, false)
      expect(a.meshes).toBeLessThanOrEqual(b.meshes)
      // A smooth hull costs more triangles than bevelled boxes; keep it within a third more.
      expect(a.tris).toBeLessThan(b.tris * 1.33)
      // Same size on the road: within 10% of the procedural car's length and width.
      const sa = a.box.getSize(a.box.min.clone())
      const sb = b.box.getSize(b.box.min.clone())
      expect(Math.abs(sa.z - sb.z) / sb.z).toBeLessThan(0.1)
      expect(Math.abs(sa.x - sb.x) / sb.x).toBeLessThan(0.1)
    })
  }
})
