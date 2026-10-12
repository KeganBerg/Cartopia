// Bakes an open-licensed 3D car model into a Cartopia hull: a low-poly loft of
// cross-sections, restyled into our toy proportions. Only the restyled loft ships
// (src/scene/scans/<id>.ts); the source model stays out of the repo.
//
//   node scripts/carscan/bake.mjs <recipe id> <source.glb>
//
// Recipes (scripts/carscan/recipes.mjs) say which source meshes are paint, glass,
// lights or trim, where the source's wheels sit, and how to restyle it.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { writeFileSync } from 'node:fs'
import { RECIPES } from './recipes.mjs'

const [, , id, src] = process.argv
const R = RECIPES[id]
if (!R || !src) throw new Error('usage: bake.mjs <recipe id> <source.glb>')

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(src)

// Target frame: the Cartopia body this hull stands in for.
const T = R.target
const wz = T.len * 0.33
const S = R.source
const wbS = S.frontAxle - S.rearAxle

// Source z -> target z. The wheels land on the target's axles; between them a power
// curve slides the cabin back (a longer hood) and the overhangs take the set lengths.
function mapZ(z) {
  if (z >= S.frontAxle) return wz + ((z - S.frontAxle) / (S.front - S.frontAxle)) * (T.front - wz)
  if (z <= S.rearAxle) return -wz - ((S.rearAxle - z) / (S.rearAxle - S.rear)) * (T.rear - wz)
  const t = (z - S.rearAxle) / wbS
  return -wz + Math.pow(t, R.style.hoodStretch) * 2 * wz
}
// Source y -> target y: sill to beltline fills the target's body, beltline to roof its
// greenhouse, so the cabin can come out taller (toy-like) than the source's.
function mapY(y) {
  const base = T.lift + 0.03
  if (y <= S.belt) return base + ((Math.max(y, S.sill) - S.sill) / (S.belt - S.sill)) * (T.belt - base)
  return T.belt + ((y - S.belt) / (S.roof - S.belt)) * (T.roof - T.belt)
}
// The hood falls away toward the nose, ahead of style.hoodFrom (target z).
function drop(x, y, z) {
  const st = R.style
  if (z <= st.hoodFrom) return [x, y, z]
  const t = (z - st.hoodFrom) / (T.front - st.hoodFrom)
  const base = T.lift + 0.03
  return [x, base + (y - base) * (1 - st.noseDrop * t * t), z]
}
const mapX = (x, y) => x * (T.wid / 2 / S.half) * (y > S.belt ? R.style.cabinWidth : 1)

// Classify every source triangle and sample points over it.
const pts = [] // x, y, z, part index
const PARTS = ['paint', 'glass', 'dark', 'black', 'lamp', 'tail']
function partOf(node, mat) {
  for (const [part, rule] of Object.entries(R.parts)) if (rule.some((r) => r.test(`${node}|${mat}`))) return part
  return null
}
const v = [0, 0, 0]
let tris = 0
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh()
  if (!mesh) continue
  const m = node.getWorldMatrix()
  for (const prim of mesh.listPrimitives()) {
    const part = partOf(node.getName(), prim.getMaterial()?.getName() ?? '')
    if (!part) continue
    const pi = PARTS.indexOf(part)
    const pos = prim.getAttribute('POSITION')
    const idx = prim.getIndices()
    const n = idx ? idx.getCount() : pos.getCount()
    const P = (i) => {
      pos.getElement(idx ? idx.getScalar(i) : i, v)
      const x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12]
      const y = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13]
      const z = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]
      return drop(Math.abs(mapX(x, y)), mapY(y), mapZ(z))
    }
    for (let i = 0; i + 2 < n; i += 3) {
      const a = P(i), b = P(i + 1), c = P(i + 2)
      tris++
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
      const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]
      const area = Math.hypot(...cr) / 2
      const k = Math.max(1, Math.round(area * 4e5))
      for (let j = 0; j < k; j++) {
        let r1 = Math.random(), r2 = Math.random()
        if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2 }
        pts.push(a[0] + ab[0] * r1 + ac[0] * r2, a[1] + ab[1] * r1 + ac[1] * r2, a[2] + ab[2] * r1 + ac[2] * r2, pi)
      }
    }
  }
}
const N = pts.length / 4
console.log(`${tris} source triangles, ${N} samples`)

// Stations along the car, closer together at the nose and tail where the shape turns fastest.
const ST = R.stations
const zs = []
for (let i = 0; i < ST; i++) {
  const t = i / (ST - 1)
  const u = 0.5 - 0.5 * Math.cos(Math.PI * t)
  const w = 0.55 * u + 0.45 * t
  zs.push(-T.rear + w * (T.front + T.rear))
}
const H = R.ring // points round the right half, bottom centre to top centre
const floor = T.lift + 0.03
const rings = []
const cells = []
const bins = Array.from({ length: ST }, () => [])
for (let i = 0; i < N; i++) {
  const z = pts[i * 4 + 2]
  // nearest station within its slice
  let lo = 0, hi = ST - 1
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (zs[mid] <= z) lo = mid; else hi = mid }
  const s = z - zs[lo] < zs[hi] - z ? lo : hi
  const half = (s === 0 ? zs[1] - zs[0] : s === ST - 1 ? zs[s] - zs[s - 1] : (zs[s + 1] - zs[s - 1]) / 2) * 0.6
  if (Math.abs(z - zs[s]) <= half) bins[s].push(i)
}
for (let s = 0; s < ST; s++) {
  const ids = bins[s]
  let y0 = Infinity, y1 = -Infinity
  for (const i of ids) { y0 = Math.min(y0, pts[i * 4 + 1]); y1 = Math.max(y1, pts[i * 4 + 1]) }
  y0 = Math.max(y0, floor)
  const yc = ids.length ? (y0 + y1) / 2 : floor + 0.05
  const rad = new Array(H).fill(0)
  const mat = new Array(H).fill(-1)
  for (const i of ids) {
    const x = pts[i * 4], y = Math.max(floor, pts[i * 4 + 1])
    const th = Math.atan2(x, -(y - yc)) // 0 straight down, PI straight up
    const b = Math.min(H - 1, Math.max(0, Math.round((th / Math.PI) * (H - 1))))
    const r = Math.hypot(x, y - yc)
    if (r > rad[b]) { rad[b] = r; mat[b] = pts[i * 4 + 3] }
  }
  // Fill empty bins from their neighbours.
  for (let b = 0; b < H; b++) if (!rad[b]) {
    let l = b - 1, r = b + 1
    while (l >= 0 && !rad[l]) l--
    while (r < H && !rad[r]) r++
    const lv = l >= 0 ? rad[l] : r < H ? rad[r] : 0.01
    const rv = r < H ? rad[r] : lv
    rad[b] = l >= 0 && r < H ? lv + ((rv - lv) * (b - l)) / (r - l) : lv
    mat[b] = mat[l >= 0 ? l : r] ?? 0
  }
  rings.push({ yc, rad, mat })
}
// Smooth radii round each ring and along the car, a little.
// The nose and tail (the last style.endStations each end) get style.endSmooth more passes:
// their faces carry the source's lamp housings and lips, which come out as dents.
const endN = R.style.endStations ?? 0
for (let pass = 0; pass < R.smooth + (R.style.endSmooth ?? 0); pass++) {
  const old = rings.map((r) => r.rad.slice())
  for (let s = 0; s < ST; s++) for (let b = 0; b < H; b++) {
    if (pass >= R.smooth && s >= endN && s < ST - endN) continue
    const n = [old[s][b] * 4]
    let w = 4
    if (b > 0) { n.push(old[s][b - 1]); w++ }
    if (b < H - 1) { n.push(old[s][b + 1]); w++ }
    if (s > 0 && s < ST - 1) { n.push(old[s - 1][b], old[s + 1][b]); w += 2 }
    rings[s].rad[b] = n.reduce((a, c) => a + c, 0) / w
  }
}
// Ring points (x >= 0), each clamped to the floor and inside the target width.
const out = []
for (let s = 0; s < ST; s++) {
  const { yc, rad } = rings[s]
  const row = []
  for (let b = 0; b < H; b++) {
    const th = (b / (H - 1)) * Math.PI
    let x = Math.sin(th) * rad[b]
    let y = yc - Math.cos(th) * rad[b]
    y = Math.max(floor, y)
    x = Math.min(T.wid / 2, x)
    if (b === 0 || b === H - 1) x = 0
    row.push(+x.toFixed(4), +y.toFixed(4))
  }
  out.push(row)
}
// Stations through a wheel arch catch no lower body (the source's arch is open there),
// so their rings hang off the arch top. Cartopia wheels sit in a full body side with a
// dark well, so those rings are blended from the nearest whole rings either side.
const xAt = (r, y) => {
  let best = 0
  for (let i = 0; i + 3 < r.length; i += 2) if ((r[i + 1] - y) * (r[i + 3] - y) <= 0 && r[i + 1] !== r[i + 3]) best = Math.max(best, r[i] + ((r[i + 2] - r[i]) * (y - r[i + 1])) / (r[i + 3] - r[i + 1]))
  return best
}
const lowY = floor + 0.05
const whole = out.map((r, s) => Math.abs(zs[s]) > wz + 0.3 || Math.abs(Math.abs(zs[s]) - wz) > 0.2 || xAt(r, lowY) > T.wid * 0.45)
for (let s = 0; s < ST; s++) if (!whole[s]) {
  let a = s - 1, b = s + 1
  while (a >= 0 && !whole[a]) a--
  while (b < ST && !whole[b]) b++
  if (a < 0 || b >= ST) continue
  const t = (zs[s] - zs[a]) / (zs[b] - zs[a])
  out[s] = out[a].map((v, i) => +(v + (out[b][i] - v) * t).toFixed(4))
  rings[s].mat = (t < 0.5 ? rings[a] : rings[b]).mat.slice()
}

// Cell parts: the source's lower trim (below style.darkBelow) stays dark; the rest is paint.
// Windows, lights and trim are drawn over the hull by scanGeo (CarModel.tsx), so their
// shapes are our own and smooth rather than following this grid.
const code = 'pgdblt'
for (let s = 0; s < ST - 1; s++) {
  let line = ''
  for (let b = 0; b < H - 1; b++) {
    const y = (out[s][b * 2 + 1] + out[s][b * 2 + 3] + out[s + 1][b * 2 + 1] + out[s + 1][b * 2 + 3]) / 4
    const dark = rings[s].mat[b] === PARTS.indexOf('dark') || rings[s + 1].mat[b] === PARTS.indexOf('dark')
    line += code[dark && y < R.style.darkBelow ? 2 : 0]
  }
  cells.push(line)
}

const file = `// Generated by scripts/carscan/bake.mjs from recipe '${id}'. Do not edit by hand.
// Source: ${R.credit}
// A loft of ${ST} cross-sections, ${H} points round the right half (bottom centre to top
// centre, [x, y] pairs); the left half mirrors it. cells: one letter per quad, per station
// gap: p paint, g glass, d dark trim, b black, l lamp, t tail light.
import type { Hull } from './hull'

export const hull: Hull = {
  z: ${JSON.stringify(zs.map((z) => +z.toFixed(4)))},
  rings: [
${out.map((r) => '    ' + JSON.stringify(r)).join(',\n')},
  ],
  cells: [
${cells.map((c) => `    '${c}'`).join(',\n')},
  ],
}
`
writeFileSync(new URL(`../../src/scene/scans/${id}.ts`, import.meta.url), file)
console.log('wrote', id, ST, 'x', H)
