import { extend } from '@react-three/fiber'
import {
  BoxGeometry, CapsuleGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, IcosahedronGeometry,
  OctahedronGeometry, PlaneGeometry, RingGeometry, SphereGeometry, TetrahedronGeometry, TorusGeometry, type BufferGeometry,
} from 'three'

// A big town is ~30,000 tiny meshes, and Batch draws it from its own merged copy, so
// each building's own pieces stay only for taps. ~28,000 of their geometries were
// copies of ~1,100 shapes. Each <Canvas> puts three's own shapes back when it
// mounts, so each one starts with <SharedShapes /> to bring these in again.
// <boxGeometry args={[1, 2, 3]} /> and the other simple shapes: the same numbers give
// the same geometry object. Each user counts; R3F disposes a geometry when its mesh
// goes, and the shape is only really freed when its last user has gone.
type Arg = number | boolean | undefined
type Shape = new (...args: Arg[]) => BufferGeometry
const pool = new Map<string, { geo: BufferGeometry; users: number }>()
export const sharedShapes = () => pool.size

function sharing(Base: Shape, name: string): Shape {
  return class extends Base {
    declare shareKey?: string
    constructor(...args: Arg[]) {
      // Only plain numbers (and flags) are shared. A clone (no args) gets its own copy to fill in.
      const k = args.length && args.every((a) => a === undefined || typeof a === 'number' || typeof a === 'boolean') ? `${name}:${args.join()}` : ''
      const hit = k ? pool.get(k) : undefined
      if (hit) {
        hit.users++
        return hit.geo as this
      }
      super(...args)
      if (k) {
        this.shareKey = k
        pool.set(k, { geo: this, users: 1 })
      }
    }
    dispose() {
      const e = this.shareKey ? pool.get(this.shareKey) : undefined
      if (e?.geo === this) {
        if (--e.users > 0) return
        pool.delete(this.shareKey!)
      }
      super.dispose()
    }
  }
}

const SHAPES = {
  BoxGeometry, CapsuleGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, IcosahedronGeometry,
  OctahedronGeometry, PlaneGeometry, RingGeometry, SphereGeometry, TetrahedronGeometry, TorusGeometry,
}
export const SHARED = Object.fromEntries(Object.entries(SHAPES).map(([n, C]) => [n, sharing(C as unknown as Shape, n)])) as unknown as typeof SHAPES

export function SharedShapes() {
  extend(SHARED)
  return null
}
