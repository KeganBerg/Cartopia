import type { BufferGeometry } from 'three'

// Outline masks of a car seen from the side, the front and above, on one fixed grid, so two cars
// can be scored for how alike they read at a glance (carLookalike.test.ts). Every triangle of the
// car is filled into each view; the wheels go in as discs (side) and blocks (front, top).

export const CELL = 0.0125
const SPAN = { x: [-0.7, 0.7], y: [0, 1.0], z: [-1.0, 1.0] } as const
type Axis = keyof typeof SPAN
const cells = (a: Axis) => Math.round((SPAN[a][1] - SPAN[a][0]) / CELL)
const VIEWS = { side: ['z', 'y'], front: ['x', 'y'], top: ['x', 'z'] } as const
export type View = keyof typeof VIEWS
export type Silhouette = Record<View, Uint8Array>
const IDX: Record<Axis, number> = { x: 0, y: 1, z: 2 }

function fill(mask: Uint8Array, w: number, h: number, a: number[], b: number[], c: number[]) {
  const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])))
  const x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0])))
  const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])))
  const y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])))
  const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
  if (Math.abs(d) < 1e-9) return
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    const px = i + 0.5, py = j + 0.5
    const l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / d
    const l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / d
    if (l1 >= 0 && l2 >= 0 && l1 + l2 <= 1) mask[j * w + i] = 1
  }
}

export type Wheels = { radius: number; width: number; wx: number; wz: number }

// k: the scale the car is drawn at, so cars are compared at one length (as the showroom shows them).
export function silhouette(geos: (BufferGeometry | undefined)[], wheels: Wheels, k = 1): Silhouette {
  const out = {} as Silhouette
  for (const v of Object.keys(VIEWS) as View[]) {
    const [u, w] = VIEWS[v]
    const W = cells(u), H = cells(w)
    const mask = new Uint8Array(W * H)
    const at = (p: number[]) => [(p[IDX[u]] * k - SPAN[u][0]) / CELL, (p[IDX[w]] * k - SPAN[w][0]) / CELL]
    for (const g of geos) {
      const pos = g?.getAttribute('position')
      if (!pos) continue
      const idx = g!.index
      const n = idx ? idx.count : pos.count
      const P = (k: number) => { const q = idx ? idx.getX(k) : k; return [pos.getX(q), pos.getY(q), pos.getZ(q)] }
      for (let t = 0; t + 2 < n; t += 3) fill(mask, W, H, at(P(t)), at(P(t + 1)), at(P(t + 2)))
    }
    // Wheels.
    const { radius: r, width: tw, wx, wz } = wheels
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = sx * wx, cz = sz * wz
      if (v === 'side') {
        for (let k = 0; k < 24; k++) {
          const a0 = (k / 24) * Math.PI * 2, a1 = ((k + 1) / 24) * Math.PI * 2
          fill(mask, W, H, at([0, r, cz]), at([0, r + Math.sin(a0) * r, cz + Math.cos(a0) * r]), at([0, r + Math.sin(a1) * r, cz + Math.cos(a1) * r]))
        }
      } else {
        const box = v === 'front' ? [[cx - tw / 2, 0], [cx + tw / 2, 2 * r]] : [[cx - tw / 2, cz - r], [cx + tw / 2, cz + r]]
        const q = (p: number[]) => (v === 'front' ? at([p[0], p[1], 0]) : at([p[0], 0, p[1]]))
        const [lo, hi] = box
        fill(mask, W, H, q(lo), q([hi[0], lo[1]]), q(hi))
        fill(mask, W, H, q(lo), q(hi), q([lo[0], hi[1]]))
      }
    }
    out[v] = mask
  }
  return out
}

// How alike two outlines are: overlap over union, per view, then the mean of the three.
export function likeness(a: Silhouette, b: Silhouette) {
  const per = {} as Record<View, number>
  for (const v of Object.keys(VIEWS) as View[]) {
    let both = 0, either = 0
    const x = a[v], y = b[v]
    for (let i = 0; i < x.length; i++) { both += x[i] & y[i]; either += x[i] | y[i] }
    per[v] = either ? both / either : 1
  }
  return { ...per, mean: (per.side + per.front + per.top) / 3 }
}

// The outline's edge, column by column: the roof line seen from the side, the shoulder line seen
// from the front, the plan's width along the car. Missing columns count as 0.
const EDGE: Record<View, 'top' | 'wide'> = { side: 'top', front: 'top', top: 'wide' }
export function edges(s: Silhouette) {
  const out = {} as Record<View, Float32Array>
  for (const v of Object.keys(VIEWS) as View[]) {
    const [u, w] = VIEWS[v]
    const W = cells(u), H = cells(w)
    const m = s[v]
    if (EDGE[v] === 'top') {
      const e = new Float32Array(W)
      for (let i = 0; i < W; i++) for (let j = H - 1; j >= 0; j--) if (m[j * W + i]) { e[i] = j + 1; break }
      out[v] = e
    } else {
      // Plan view: width across the car (u = x) at each step along it (w = z).
      const e = new Float32Array(H)
      for (let j = 0; j < H; j++) { let n = 0; for (let i = 0; i < W; i++) n += m[j * W + i]; e[j] = n }
      out[v] = e
    }
  }
  return out
}
// Mean gap between two cars' edges, in cells, per view; columns where neither car has anything are skipped.
export function edgeGap(a: Record<View, Float32Array>, b: Record<View, Float32Array>) {
  const per = {} as Record<View, number>
  for (const v of Object.keys(a) as View[]) {
    let s = 0, n = 0
    for (let i = 0; i < a[v].length; i++) if (a[v][i] || b[v][i]) { s += Math.abs(a[v][i] - b[v][i]); n++ }
    per[v] = n ? s / n : 0
  }
  return per
}
