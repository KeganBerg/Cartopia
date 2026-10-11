import { BufferAttribute, BufferGeometry, Color, Euler, Matrix3, Matrix4, Quaternion, Vector3, type ColorRepresentation } from 'three'
import { bakedMaterial } from './bake'

// A fast way to build lots of small static scenery (grass, rocks, fences,
// whole forests) as ONE baked mesh: each piece is a shared low-poly shape plus
// a colour and a placement, written straight into the vertex arrays that
// bakedMaterial reads (bake.ts). Thousands of pieces cost one draw, and they
// pick up rain sheen and settled snow like the rest of the town.

type Src = { pos: ArrayLike<number>; nor: ArrayLike<number>; idx: ArrayLike<number> }
const srcs = new WeakMap<BufferGeometry, Src>()
function srcOf(g: BufferGeometry): Src {
  let s = srcs.get(g)
  if (!s) {
    const pos = g.getAttribute('position').array
    const nor = g.getAttribute('normal').array
    const idx = g.index ? g.index.array : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i)
    srcs.set(g, (s = { pos, nor, idx }))
  }
  return s
}

const tc = new Color()
const m4 = new Matrix4()
const n3 = new Matrix3()
const q = new Quaternion()
const e = new Euler()
const v = new Vector3()
const sc = new Vector3()

type Piece = { s: Src; m: Matrix4; r: number; g: number; b: number; rough: number; glow: number }

export class Kit {
  private pieces: Piece[] = []
  private verts = 0
  private tris = 0

  // Place `geo` at (x, y, z), turned `ry` (and optionally tipped `rx`/`rz`), scaled by s.
  add(geo: BufferGeometry, color: ColorRepresentation, x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0, rough = 1) {
    q.setFromEuler(e.set(rx, ry, rz, 'YXZ'))
    return this.addMatrix(geo, color, m4.compose(v.set(x, y, z), q, sc.set(sx, sy, sz)), rough)
  }

  addMatrix(geo: BufferGeometry, color: ColorRepresentation, m: Matrix4, rough = 1, glow = 0) {
    const s = srcOf(geo)
    tc.set(color)
    this.pieces.push({ s, m: m.clone(), r: tc.r, g: tc.g, b: tc.b, rough, glow })
    this.verts += s.pos.length / 3
    this.tris += s.idx.length
    return this
  }

  get size() {
    return this.pieces.length
  }

  geometry() {
    if (!this.pieces.length) return null
    const pos = new Float32Array(this.verts * 3)
    const nor = new Float32Array(this.verts * 3)
    const col = new Float32Array(this.verts * 3)
    const emi = new Float32Array(this.verts * 3)
    const look = new Float32Array(this.verts * 4)
    const idx = new Uint32Array(this.tris)
    let o = 0
    let t = 0
    for (const p of this.pieces) {
      const e = p.m.elements
      n3.getNormalMatrix(p.m)
      const ne = n3.elements
      const { pos: sp, nor: sn, idx: si } = p.s
      const n = sp.length / 3
      for (let i = 0; i < n; i++) {
        const x = sp[i * 3], y = sp[i * 3 + 1], z = sp[i * 3 + 2]
        const k = (o + i) * 3
        pos[k] = e[0] * x + e[4] * y + e[8] * z + e[12]
        pos[k + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]
        pos[k + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]
        const a = sn[i * 3], b = sn[i * 3 + 1], c = sn[i * 3 + 2]
        let nx = ne[0] * a + ne[3] * b + ne[6] * c
        let ny = ne[1] * a + ne[4] * b + ne[7] * c
        let nz = ne[2] * a + ne[5] * b + ne[8] * c
        const l = Math.hypot(nx, ny, nz) || 1
        nx /= l; ny /= l; nz /= l
        nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz
        col[k] = p.r; col[k + 1] = p.g; col[k + 2] = p.b
        if (p.glow) { emi[k] = p.r * p.glow; emi[k + 1] = p.g * p.glow; emi[k + 2] = p.b * p.glow }
        look[(o + i) * 4 + 1] = p.rough
      }
      for (let i = 0; i < si.length; i++) idx[t + i] = si[i] + o
      o += n
      t += si.length
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('normal', new BufferAttribute(nor, 3))
    g.setAttribute('color', new BufferAttribute(col, 3))
    g.setAttribute('emissive', new BufferAttribute(emi, 3))
    g.setAttribute('look', new BufferAttribute(look, 4))
    g.setIndex(new BufferAttribute(idx, 1))
    g.computeBoundingSphere()
    return g
  }
}

// One shared material for everything a Kit builds.
export const kitMat = bakedMaterial()
