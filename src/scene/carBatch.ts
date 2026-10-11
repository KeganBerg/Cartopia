import { CylinderGeometry, InstancedMesh, Matrix4, type Material, type Object3D } from 'three'
import { bakedMaterial } from './bake'

// Town traffic shows up to thirty cars at once. Drawn part by part, each costs a
// dozen or more draw calls (one per look, plus four wheels), and phones pay for
// every one. So for town cars:
// - a car's body is baked (see bake.ts) into two meshes, the parts that cast a
//   shadow and the rest, and every car shares one material (carBody);
// - every wheel in town is an instance of one shared mesh per rim finish (wheelPool).

export const carBody = { plain: bakedMaterial(), picked: bakedMaterial(true) }

// Every town wheel is an instance of a unit wheel (radius 1, width 1), scaled to size per instance.
const CAP = 200
const unitWheel = (() => {
  const g = new CylinderGeometry(1, 1, 1, 18, 1)
  const uv = g.getAttribute('uv')
  const side = (18 + 1) * 2
  for (let i = 0; i < uv.count; i++) uv.setX(i, i < side ? 0.5 + uv.getX(i) * 0.5 : uv.getX(i) * 0.5)
  g.rotateZ(Math.PI / 2)
  return g
})()
const hidden = new Matrix4().makeScale(0, 0, 0)

export type WheelSlot = { mesh: InstancedMesh; slot: number; size: Matrix4 }

class WheelPool {
  meshes = new Map<Material, { mesh: InstancedMesh; free: number[] }>()
  // Inverse of the pool meshes' parent transform, refreshed each frame.
  parentInv = new Matrix4()
  private m = new Matrix4()

  // A slot for one wheel of `radius` and `width`, or null when the pool is full.
  take(mat: Material, radius: number, width: number): WheelSlot | null {
    let e = this.meshes.get(mat)
    if (!e) {
      const mesh = new InstancedMesh(unitWheel, mat, CAP)
      mesh.frustumCulled = false
      for (let i = 0; i < CAP; i++) mesh.setMatrixAt(i, hidden)
      e = { mesh, free: Array.from({ length: CAP }, (_, i) => CAP - 1 - i) }
      this.meshes.set(mat, e)
      this.changed?.()
    }
    const slot = e.free.pop()
    if (slot === undefined) return null
    e.mesh.visible = true
    return { mesh: e.mesh, slot, size: new Matrix4().makeScale(width, radius, radius) }
  }

  give(w: WheelSlot) {
    const e = [...this.meshes.values()].find((x) => x.mesh === w.mesh)
    if (!e) return
    w.mesh.setMatrixAt(w.slot, hidden)
    w.mesh.instanceMatrix.needsUpdate = true
    e.free.push(w.slot)
    if (e.free.length === CAP) w.mesh.visible = false
  }

  // Put a wheel where its (mesh-less) group is, or hide it.
  place(w: WheelSlot, at: Object3D | null) {
    if (!at) w.mesh.setMatrixAt(w.slot, hidden)
    else {
      at.updateWorldMatrix(true, false)
      w.mesh.setMatrixAt(w.slot, this.m.multiplyMatrices(this.parentInv, at.matrixWorld).multiply(w.size))
    }
    w.mesh.instanceMatrix.needsUpdate = true
  }

  changed?: () => void
}

export const wheelPool = new WheelPool()
