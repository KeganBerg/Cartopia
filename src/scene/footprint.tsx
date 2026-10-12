import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Box3, Matrix4, type Group, type Material, type Mesh, type Object3D } from 'three'
import type { Footprint } from '../game/collide'
import { carFrame } from './CarModel'
import type { Body } from '../game/data'

// A model's footprint on the ground as drawn, in the root's own (unscaled) frame: the
// bounds of every solid mesh, wheels, mirrors and bolt-on mods included. Headlight
// beams, glows and shadows are see-through decals and don't count.
export function footprint(root: Object3D): Footprint | null {
  root.updateWorldMatrix(true, true)
  const inv = new Matrix4().copy(root.matrixWorld).invert()
  const m = new Matrix4()
  const all = new Box3()
  const one = new Box3()
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    for (let p: Object3D | null = mesh; p && p !== root; p = p.parent) if (!p.visible) return
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[]
    if (mats.every((mt) => mt.transparent && !mt.depthWrite)) return
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    one.copy(mesh.geometry.boundingBox!).applyMatrix4(m.multiplyMatrices(inv, mesh.matrixWorld))
    all.union(one)
  })
  if (all.isEmpty()) return null
  return { w: all.max.x - all.min.x, l: all.max.z - all.min.z, cz: (all.max.z + all.min.z) / 2 }
}

// A body's footprint before its model has been measured: the frame's size.
export const frameFootprint = (body: Body): Footprint => {
  const f = carFrame(body)
  return { w: Math.max(f.wid, f.side * 2), l: f.len, cz: 0 }
}

export const scaled = (f: Footprint, s: number): Footprint => ({ w: f.w * s, l: f.l * s, cz: f.cz * s })

// Wraps a car model and reports its footprint once it's drawn. With fit=[len, wid] the
// model is scaled evenly to fit inside that size (so the footprint is never bigger);
// otherwise it's drawn at scale. id says when the model changed and needs measuring again.
export function Footprinted({ id, scale = 1, fit, onFoot, children }: {
  id: string; scale?: number; fit?: [number, number]; onFoot: (f: Footprint) => void; children: ReactNode
}) {
  const g = useRef<Group>(null)
  const [len, wid] = fit ?? [0, 0]
  useLayoutEffect(() => {
    if (!g.current) return
    const f = footprint(g.current)
    if (!f) return
    const s = fit ? Math.min(len / f.l, wid / f.w) : scale
    g.current.scale.setScalar(s)
    onFoot(scaled(f, s))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, scale, len, wid])
  return <group ref={g}>{children}</group>
}
