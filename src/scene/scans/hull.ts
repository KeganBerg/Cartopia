import { BufferAttribute, BufferGeometry } from 'three'

// A restyled car body baked from an open-licensed model (scripts/carscan/bake.mjs):
// cross-sections along the car, each a half ring of [x, y] pairs from the bottom centre
// round the right side to the top centre. The left side mirrors the right.
export type Hull = { z: number[]; rings: number[][]; cells: string[] }
export type HullPart = 'paint' | 'glass' | 'dark' | 'black' | 'lamp' | 'tail'
const CODE: Record<string, HullPart> = { p: 'paint', g: 'glass', d: 'dark', b: 'black', l: 'lamp', t: 'tail' }

// The hull as one smooth-shaded mesh per part, with the nose and tail closed off.
export function hullGeo(h: Hull) {
  const S = h.z.length
  const H = h.rings[0].length / 2
  const R = 2 * (H - 1) // points round a full ring
  const pos = new Float32Array((S * R + 2) * 3)
  // Point j of the full ring: 0..H-1 down the right side's list, then the left side back up.
  const at = (s: number, j: number): [number, number] => {
    const r = h.rings[s]
    if (j < H) return [r[j * 2], r[j * 2 + 1]]
    const m = R - j
    return [-r[m * 2], r[m * 2 + 1]]
  }
  for (let s = 0; s < S; s++) for (let j = 0; j < R; j++) {
    const [x, y] = at(s, j)
    pos.set([x, y, h.z[s]], (s * R + j) * 3)
  }
  // Cap centres: the middle of the end rings.
  const mid = (s: number) => {
    let y = 0
    for (let j = 0; j < R; j++) y += at(s, j)[1]
    return y / R
  }
  const tailC = S * R
  const noseC = S * R + 1
  pos.set([0, mid(0), h.z[0]], tailC * 3)
  pos.set([0, mid(S - 1), h.z[S - 1]], noseC * 3)
  const lists = new Map<HullPart, number[]>()
  const push = (p: HullPart, ...ids: number[]) => {
    const l = lists.get(p) ?? []
    l.push(...ids)
    lists.set(p, l)
  }
  for (let s = 0; s < S - 1; s++) for (let j = 0; j < R; j++) {
    const j2 = (j + 1) % R
    // Cells hold the right half; the left half reads them mirrored.
    const b = j < H - 1 ? j : R - 1 - j
    const part = CODE[h.cells[s][b]] ?? 'paint'
    const a = s * R + j, c = s * R + j2, d = (s + 1) * R + j, e = (s + 1) * R + j2
    push(part, a, c, d, c, e, d)
  }
  // Tail and nose caps take the part of the ring cell next to them.
  for (let j = 0; j < R; j++) {
    const j2 = (j + 1) % R
    const b = j < H - 1 ? j : R - 1 - j
    push(CODE[h.cells[0][b]] ?? 'paint', tailC, j2, j)
    push(CODE[h.cells[S - 2][b]] ?? 'paint', noseC, (S - 1) * R + j, (S - 1) * R + j2)
  }
  const all = new BufferGeometry()
  all.setAttribute('position', new BufferAttribute(pos, 3))
  all.setIndex([...lists.values()].flat())
  all.computeVertexNormals()
  // Blank uvs, so the hull merges with the car's other parts (which have them).
  const uv = new BufferAttribute(new Float32Array((S * R + 2) * 2), 2)
  const out: Partial<Record<HullPart, BufferGeometry>> = {}
  for (const [p, ids] of lists) {
    const g = new BufferGeometry()
    g.setAttribute('position', all.getAttribute('position'))
    g.setAttribute('normal', all.getAttribute('normal'))
    g.setAttribute('uv', uv)
    g.setIndex(ids)
    out[p] = g
  }
  return out
}

// Where z falls between stations: the station before it and how far on (0..1).
function span(h: Hull, z: number): [number, number] {
  const S = h.z.length
  let s = 0
  while (s < S - 2 && h.z[s + 1] < z) s++
  return [s, Math.max(0, Math.min(1, (z - h.z[s]) / (h.z[s + 1] - h.z[s])))]
}
const lerpRing = (h: Hull, z: number, f: (r: number[]) => number) => {
  const [s, t] = span(h, z)
  return f(h.rings[s]) * (1 - t) + f(h.rings[s + 1]) * t
}

// A ring's outer half width at height y (0 above or below it).
function ringX(r: number[], y: number) {
  let best = 0
  for (let i = 0; i + 3 < r.length; i += 2) {
    const [x0, y0, x1, y1] = [r[i], r[i + 1], r[i + 2], r[i + 3]]
    if ((y0 - y) * (y1 - y) <= 0 && y0 !== y1) best = Math.max(best, x0 + ((x1 - x0) * (y - y0)) / (y1 - y0))
  }
  return best
}
// A ring's upper surface height at half width x.
function ringY(r: number[], x: number) {
  let best = -Infinity
  for (let i = 0; i + 3 < r.length; i += 2) {
    const [x0, y0, x1, y1] = [r[i], r[i + 1], r[i + 2], r[i + 3]]
    if ((x0 - x) * (x1 - x) <= 0 && x0 !== x1) best = Math.max(best, y0 + ((y1 - y0) * (x - x0)) / (x1 - x0))
  }
  return best === -Infinity ? r[1] : best
}
// Where a ring's side turns into its top: the highest point still on a steep (side) segment.
function ringEdge(r: number[]): [number, number] {
  for (let i = r.length - 4; i >= 0; i -= 2) {
    const [x0, y0, x1, y1] = [r[i], r[i + 1], r[i + 2], r[i + 3]]
    if (Math.abs(y1 - y0) > Math.abs(x1 - x0)) return [x1, y1]
  }
  return [r[0], r[1]]
}

// The outer surface's half width at height y, at a point along the car (0 above or below the hull).
export const hullX = (h: Hull, z: number, y: number) => lerpRing(h, z, (r) => ringX(r, y))
// The hull's upper surface height at half width x.
export const hullY = (h: Hull, z: number, x: number) => lerpRing(h, z, (r) => ringY(r, Math.abs(x)))
// The hull's top (the roofline, hood and deck) along the centre line.
export const hullTop = (h: Hull, z: number) => lerpRing(h, z, (r) => r[r.length - 1])
// Where the side meets the top: [half width, height].
export const hullEdge = (h: Hull, z: number): [number, number] => [lerpRing(h, z, (r) => ringEdge(r)[0]), lerpRing(h, z, (r) => ringEdge(r)[1])]

// The nose (or tail, dir -1) surface's z at (x, y): the furthest station out that still reaches it.
export function hullEnd(h: Hull, x: number, y: number, dir: 1 | -1) {
  const S = h.z.length
  const ax = Math.abs(x)
  const order = dir > 0 ? [...Array(S).keys()].reverse() : [...Array(S).keys()]
  let prev = -1
  for (const s of order) {
    const w = ringX(h.rings[s], y)
    if (w >= ax) {
      if (prev < 0) return h.z[s]
      const wp = ringX(h.rings[prev], y)
      const t = (ax - wp) / Math.max(1e-6, w - wp)
      return h.z[prev] + (h.z[s] - h.z[prev]) * t
    }
    prev = s
  }
  return 0
}

// A patch laid over the hull: at(u, v) gives a surface point for u, v in 0..1, and the
// patch is lifted `off` along its normal, facing away from `centre`. mirror: also the left side.
export function patch(at: (u: number, v: number) => [number, number, number], nu: number, nv: number, off: number, mirror = false, centre: [number, number, number] = [0, 0.25, 0]) {
  const pos: number[] = []
  const idx: number[] = []
  const P = (u: number, v: number) => at(Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v)))
  for (const side of mirror ? [1, -1] : [1]) {
    const base = pos.length / 3
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv
      const p = P(u, v)
      const e = 0.01
      const a = P(u + e, v), b = P(u - e, v), c = P(u, v + e), d = P(u, v - e)
      const du = [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
      const dv = [c[0] - d[0], c[1] - d[1], c[2] - d[2]]
      let n = [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]]
      const l = Math.hypot(n[0], n[1], n[2]) || 1
      n = n.map((k) => k / l)
      const out = (p[0] - centre[0]) * n[0] + (p[1] - centre[1]) * n[1] + (p[2] - centre[2]) * n[2]
      if (out < 0) n = n.map((k) => -k)
      pos.push(side * (p[0] + n[0] * off), p[1] + n[1] * off, p[2] + n[2] * off)
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1
      // Wind each quad to face outward (checked against the lifted normal's side).
      const pa = pos.slice(a * 3, a * 3 + 3), pb = pos.slice(b * 3, b * 3 + 3), pc = pos.slice(c * 3, c * 3 + 3)
      const ab = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], ac = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]]
      const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]
      const o = (pa[0] - centre[0]) * n[0] + (pa[1] - centre[1]) * n[1] + (pa[2] - centre[2]) * n[2]
      if (o >= 0) idx.push(a, b, c, b, d, c)
      else idx.push(a, c, b, b, c, d)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute('uv', new BufferAttribute(new Float32Array((pos.length / 3) * 2), 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}
