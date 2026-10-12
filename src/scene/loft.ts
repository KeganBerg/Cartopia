import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'

// A hard-surface body lofted through cross-sections, for cars whose shape the
// extruded side profiles can't make (a wedge that narrows to its nose, a fender
// standing above the hood). Each key section is half a ring, x >= 0, from the
// bottom centre round the side to the top centre; the left half is its mirror.
// Points marked hard make a crease that runs the length of the car; everything
// else is smooth, and the surface is smooth from section to section, so panels
// read as clean planes with crisp edges instead of a lumpy scan.

export type Pt = [number, number, hard?: boolean]
export type Section = { z: number; pts: Pt[] }

// Catmull-Rom between key sections (uniform in key index); z runs front to back.
const cr = (a: number, b: number, c: number, d: number, t: number) =>
  0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)

export class Loft {
  constructor(readonly keys: Section[], readonly steps = 5) {}

  // The section at key index t (fractional).
  at(t: number): Section {
    const k = this.keys
    const n = k.length - 1
    const i = Math.min(n - 1, Math.max(0, Math.floor(t)))
    const f = Math.min(1, Math.max(0, t - i))
    const [a, b, c, d] = [k[Math.max(0, i - 1)], k[i], k[i + 1], k[Math.min(n, i + 2)]]
    const pts = b.pts.map((p, j): Pt => [cr(a.pts[j][0], p[0], c.pts[j][0], d.pts[j][0], f), cr(a.pts[j][1], p[1], c.pts[j][1], d.pts[j][1], f), p[2]])
    return { z: b.z + (c.z - b.z) * f, pts }
  }

  // The section at a position along the car (z between the end keys).
  near(z: number): Section {
    let lo = 0
    let hi = this.keys.length - 1
    const zs = this.keys
    const dir = zs[0].z > zs[hi].z ? -1 : 1
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2
      if ((this.at(m).z - z) * dir < 0) lo = m
      else hi = m
    }
    return this.at((lo + hi) / 2)
  }

  // Height of the top surface at (x, z): walks the half ring from its top
  // centre outward over points `from` and after.
  top(x: number, z: number, from: number) {
    const p = this.near(z).pts
    const ax = Math.abs(x)
    for (let j = p.length - 1; j > from; j--) {
      const [x1, y1] = p[j]
      const [x0, y0] = p[j - 1]
      if (ax >= Math.min(x0, x1) && ax <= Math.max(x0, x1)) return x0 === x1 ? Math.max(y0, y1) : y1 + ((y0 - y1) * (ax - x1)) / (x0 - x1)
    }
    return p[from][1]
  }

  geometry(opts: { capFront?: boolean; capBack?: boolean } = {}) {
    const rings: Section[] = []
    const n = this.keys.length - 1
    for (let i = 0; i < n; i++) for (let s = 0; s < this.steps; s++) rings.push(this.at(i + s / this.steps))
    rings.push(this.at(n))
    const h = rings[0].pts.length
    // Full ring: right half bottom to top, then the left half back down (centre points shared).
    const full = (r: Section) => {
      const out: [number, number, number, boolean][] = r.pts.map(([x, y, hd]) => [x, y, r.z, !!hd])
      for (let j = h - 2; j > 0; j--) out.push([-r.pts[j][0], r.pts[j][1], r.z, !!r.pts[j][2]])
      return out
    }
    const R = rings.map(full)
    const m = R[0].length
    const V = (i: number, j: number) => new Vector3(R[i][j % m][0], R[i][j % m][1], R[i][j % m][2])
    // Face normal of the quad between rings i, i+1 and points j, j+1.
    const fn = (i: number, j: number) => {
      const a = V(i, j), b = V(i, j + 1), c = V(i + 1, j + 1), d = V(i + 1, j)
      const n1 = new Vector3().subVectors(c, a).cross(new Vector3().subVectors(b, d))
      return n1.lengthSq() > 1e-14 ? n1.normalize() : n1
    }
    const F = R.slice(0, -1).map((_, i) => Array.from({ length: m }, (_, j) => fn(i, j)))
    // Normal at ring i, point j, as seen from segment `seg` (j-1 or j): smooth along
    // the car; across the ring only where the point is soft.
    const nrm = (i: number, j: number, seg: number) => {
      const segs = R[i][j % m][3] ? [seg] : [(j - 1 + m) % m, j % m]
      const v = new Vector3()
      for (const s of segs) for (const ii of [i - 1, i]) if (ii >= 0 && ii < F.length) v.add(F[ii][(s + m) % m])
      return v.lengthSq() > 1e-14 ? v.normalize() : new Vector3(0, 1, 0)
    }
    const pos: number[] = []
    const nor: number[] = []
    const uv: number[] = []
    const z0 = R[0][0][2]
    const zl = R[R.length - 1][0][2] - z0 || 1
    const push = (i: number, j: number, seg: number) => {
      const p = R[i][j % m]
      pos.push(p[0], p[1], p[2])
      const q = nrm(i, j, seg)
      nor.push(q.x, q.y, q.z)
      uv.push((p[2] - z0) / zl, (j % m) / m)
    }
    for (let i = 0; i < R.length - 1; i++) {
      for (let j = 0; j < m; j++) {
        // Two triangles per quad; normals taken as seen from this segment.
        push(i, j, j); push(i + 1, j, j); push(i + 1, j + 1, j)
        push(i, j, j); push(i + 1, j + 1, j); push(i, j + 1, j)
      }
    }
    // Flat end caps, fanned from the middle.
    const cap = (i: number, dir: number) => {
      const r = R[i]
      const c = r.reduce((s, p) => [s[0] + p[0] / m, s[1] + p[1] / m, s[2]], [0, 0, r[0][2]])
      for (let j = 0; j < m; j++) {
        const a = r[j]
        const b = r[(j + 1) % m]
        const tri = dir > 0 ? [c, a, b] : [c, b, a]
        for (const p of tri) {
          pos.push(p[0], p[1], p[2])
          nor.push(0, 0, dir)
          uv.push(0.5 + p[0], p[1])
        }
      }
    }
    const front = R[0][0][2] > R[R.length - 1][0][2] ? 1 : -1
    if (opts.capFront) cap(0, front)
    if (opts.capBack) cap(R.length - 1, -front)
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    return g
  }
}
