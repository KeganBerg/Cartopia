import { BoxGeometry, BufferAttribute, BufferGeometry, ConeGeometry, CylinderGeometry, Euler, IcosahedronGeometry, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { glowMats } from './dayNight'

// Building blocks for detailed street furniture. A prop is dozens of small
// parts; drawn as separate meshes each would be its own scene object every
// frame. PropKit merges a prop's parts into one mesh per look (colour, finish,
// shadow), built once per kind and shared by every copy, and the materials are
// plain so Batch still bakes them into the town's static mesh at no extra draw.

// glow: a lamp lens, drawn with the town's night-lit bulb material.
export type Look = { c: string; r?: number; m?: number; e?: string; cast?: boolean; glow?: boolean }
type V3 = [number, number, number]

const q = new Quaternion()
const eu = new Euler()
const mx = new Matrix4()
const v = new Vector3()
const sv = new Vector3()

// Shared primitive shapes, unit-sized where they can be.
const shapes = new Map<string, BufferGeometry>()
const shape = (k: string, make: () => BufferGeometry) => {
  let g = shapes.get(k)
  if (!g) shapes.set(k, (g = make()))
  return g
}

const mats = new Map<string, MeshStandardMaterial>()
// One material per look, shared everywhere, so Batch's look cache hits.
export function propMat(l: Look) {
  if (l.glow) return glowMats.bulb
  const k = `${l.c}|${l.r ?? 0.8}|${l.m ?? 0}|${l.e ?? ''}`
  let m = mats.get(k)
  if (!m) mats.set(k, (m = new MeshStandardMaterial({ color: l.c, roughness: l.r ?? 0.8, metalness: l.m ?? 0, ...(l.e ? { emissive: l.e } : {}) })))
  return m
}

export class PropKit {
  private parts = new Map<string, { look: Look; geos: BufferGeometry[] }>()

  private set(look: Look) {
    const k = look.glow ? 'glow' : `${look.c}|${look.r ?? 0.8}|${look.m ?? 0}|${look.e ?? ''}|${look.cast ? 1 : 0}`
    let set = this.parts.get(k)
    if (!set) this.parts.set(k, (set = { look, geos: [] }))
    return set
  }

  add(look: Look, geo: BufferGeometry, p: V3, r: V3 = [0, 0, 0], s: V3 = [1, 1, 1]) {
    const set = this.set(look)
    const g = geo.index ? geo.clone() : geo.clone().setIndex(new BufferAttribute(Uint32Array.from({ length: geo.getAttribute('position').count }, (_, i) => i), 1))
    q.setFromEuler(eu.set(r[0], r[1], r[2], 'YXZ'))
    g.applyMatrix4(mx.compose(v.set(...p), q, sv.set(...s)))
    set.geos.push(g)
    return this
  }

  // Box of size s at p.
  box(look: Look, s: V3, p: V3, r?: V3) {
    return this.add(look, shape('box', () => new BoxGeometry(1, 1, 1)), p, r, s)
  }

  // Upright cylinder (radius top/bottom, height) with n sides.
  cyl(look: Look, rt: number, rb: number, h: number, p: V3, r?: V3, n = 10) {
    return this.add(look, shape(`cyl${rt / rb}|${n}`, () => new CylinderGeometry(rt / rb, 1, 1, n)), p, r, [rb, h, rb])
  }

  // A round rod from a to b.
  rod(look: Look, a: V3, b: V3, rad: number, n = 6) {
    const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const len = d.length()
    // Open-ended: the caps of a thin rod are never seen.
    const g = shape(`rod${n}`, () => new CylinderGeometry(1, 1, 1, n, 1, true))
    const set = this.set(look)
    q.setFromUnitVectors(new Vector3(0, 1, 0), d.normalize())
    set.geos.push(g.clone().applyMatrix4(mx.compose(v.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, sv.set(rad, len, rad))))
    return this
  }

  sphere(look: Look, rad: number, p: V3, s: V3 = [1, 1, 1], w = 10, h = 6, cap = Math.PI) {
    return this.add(look, shape(`sph${w}|${h}|${cap}`, () => new SphereGeometry(1, w, h, 0, Math.PI * 2, 0, cap)), p, undefined, [rad * s[0], rad * s[1], rad * s[2]])
  }

  ico(look: Look, rad: number, p: V3, s: V3 = [1, 1, 1], detail = 1) {
    return this.add(look, shape(`ico${detail}`, () => {
      // Faceted, like the town's other foliage.
      const g = new IcosahedronGeometry(1, detail)
      g.computeVertexNormals()
      return g
    }), p, undefined, [rad * s[0], rad * s[1], rad * s[2]])
  }

  cone(look: Look, rad: number, h: number, p: V3, r?: V3, n = 10) {
    return this.add(look, shape(`cone${n}`, () => new ConeGeometry(1, 1, n)), p, r, [rad, h, rad])
  }

  // Torus (ring radius R, tube radius t), arc `arc`, lying in its local XY plane.
  torus(look: Look, R: number, t: number, p: V3, r?: V3, arc = Math.PI * 2, seg = 16, tube = 5) {
    return this.add(look, shape(`tor${R}|${t}|${arc}|${seg}|${tube}`, () => new TorusGeometry(R, t, tube, seg, arc)), p, r)
  }

  build() {
    return [...this.parts.values()].map(({ look, geos }) => {
      const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos)!
      geos.forEach((g) => g !== geo && g.dispose())
      geo.computeBoundingSphere()
      return { geo, mat: propMat(look), cast: !!look.cast }
    })
  }
}

export type Built = ReturnType<PropKit['build']>

// Builds a prop once and keeps it.
const built = new Map<string, Built>()
export function prop(key: string, make: (k: PropKit) => void): Built {
  let b = built.get(key)
  if (!b) {
    const k = new PropKit()
    make(k)
    built.set(key, (b = k.build()))
  }
  return b
}

export function PropMesh({ parts }: { parts: Built }) {
  return (
    <>
      {parts.map((p, i) => (
        <mesh key={i} geometry={p.geo} material={p.mat} castShadow={p.cast} dispose={null} />
      ))}
    </>
  )
}
