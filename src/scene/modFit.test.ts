// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import type { BufferGeometry } from 'three'
import { CARS, MODS, isBike, modFits, type Body, type ModSlot } from '../game/data'
import { Kit, freshGeo, type Part } from './CarModel'
import { modFrame, modParts } from './CarMods'

// Every mod sits on every car it fits: each piece is fixed to the car (or to another piece of
// the same mod), and with a full set on, no two mods run into each other.

// Pieces closer than this are touching.
const TOUCH = 0.006
// How far one mod may sink into another before it reads as a clash.
const CLASH = 0.012

const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (x: number[], y: number[]) => [x[0] - y[0], x[1] - y[1], x[2] - y[2]]
// pts: the corners plus points along every edge, so a bar passing through another piece is caught.
type Piece = { name: string; pos: Float32Array | number[]; pts: number[][]; lo: number[]; hi: number[] }
function edgePoints(pos: ArrayLike<number>) {
  const out: number[][] = []
  const seen = new Set<string>()
  for (let t = 0; t + 8 < pos.length; t += 9) for (let e = 0; e < 3; e++) {
    const a = [pos[t + e * 3], pos[t + e * 3 + 1], pos[t + e * 3 + 2]]
    const f = (e + 1) % 3
    const b = [pos[t + f * 3], pos[t + f * 3 + 1], pos[t + f * 3 + 2]]
    const n = Math.min(12, Math.ceil(Math.hypot(...sub(b, a)) / 0.01))
    for (let i = 0; i < n; i++) {
      const p = [0, 1, 2].map((c) => a[c] + ((b[c] - a[c]) * i) / n)
      const k = p.map((v) => v.toFixed(4)).join()
      if (!seen.has(k)) { seen.add(k); out.push(p) }
    }
  }
  return out
}
const bounds = (pos: ArrayLike<number>) => {
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i + 2 < pos.length; i += 3) for (let c = 0; c < 3; c++) {
    lo[c] = Math.min(lo[c], pos[i + c])
    hi[c] = Math.max(hi[c], pos[i + c])
  }
  return { lo, hi }
}
const piece = (name: string, pos: ArrayLike<number>): Piece => ({ name, pos: Array.from(pos), pts: edgePoints(pos), ...bounds(pos) })
const near = (a: Piece, b: Piece, pad: number) => [0, 1, 2].every((c) => a.lo[c] <= b.hi[c] + pad && b.lo[c] <= a.hi[c] + pad)

let carPieces: Piece[] = []
const add = Kit.prototype.add
Kit.prototype.add = function (this: Kit, part: Part, geo: BufferGeometry, ...rest: Parameters<Kit['add']> extends [Part, BufferGeometry, ...infer R] ? R : never) {
  add.call(this, part, geo, ...rest)
  const list = this.parts.get(part)!
  carPieces.push(piece(`car ${part}`, list[list.length - 1].getAttribute('position').array))
}

// Distance from p to the triangle at pos[t..t+8].
function toTri(p: number[], pos: ArrayLike<number>, t: number) {
  const a = [pos[t], pos[t + 1], pos[t + 2]], b = [pos[t + 3], pos[t + 4], pos[t + 5]], c = [pos[t + 6], pos[t + 7], pos[t + 8]]
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a)
  const at = (u: number, v: number) => Math.hypot(...sub(p, [a[0] + ab[0] * u + ac[0] * v, a[1] + ab[1] * u + ac[1] * v, a[2] + ab[2] * u + ac[2] * v]))
  const d1 = dot(ab, ap), d2 = dot(ac, ap)
  if (d1 <= 0 && d2 <= 0) return at(0, 0)
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp)
  if (d3 >= 0 && d4 <= d3) return at(1, 0)
  const vc = d1 * d4 - d3 * d2
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return at(d1 / (d1 - d3), 0)
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp)
  if (d6 >= 0 && d5 <= d6) return at(0, 1)
  const vb = d5 * d2 - d1 * d6
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return at(0, d2 / (d2 - d6))
  const va = d3 * d6 - d5 * d4
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); return at(1 - w, w) }
  const den = 1 / (va + vb + vc)
  return at(vb * den, vc * den)
}
const RAY = [0.1234, 1, 0.0371].map((c, _, v) => c / Math.hypot(v[0], v[1], v[2]))
function inside(q: number[], pos: ArrayLike<number>) {
  let hits = 0
  for (let t = 0; t + 8 < pos.length; t += 9) {
    const e1 = [pos[t + 3] - pos[t], pos[t + 4] - pos[t + 1], pos[t + 5] - pos[t + 2]]
    const e2 = [pos[t + 6] - pos[t], pos[t + 7] - pos[t + 1], pos[t + 8] - pos[t + 2]]
    const h = [RAY[1] * e2[2] - RAY[2] * e2[1], RAY[2] * e2[0] - RAY[0] * e2[2], RAY[0] * e2[1] - RAY[1] * e2[0]]
    const a = dot(e1, h)
    if (Math.abs(a) < 1e-12) continue
    const s = [q[0] - pos[t], q[1] - pos[t + 1], q[2] - pos[t + 2]]
    const u = dot(s, h) / a
    if (u < 0 || u > 1) continue
    const qq = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]]
    const w = dot(RAY, qq) / a
    if (w < 0 || u + w > 1) continue
    if (dot(e2, qq) / a > 1e-9) hits++
  }
  return hits % 2 === 1
}
function dist(p: number[], b: Piece) {
  let d = Infinity
  for (let t = 0; t + 8 < b.pos.length; t += 9) d = Math.min(d, toTri(p, b.pos, t))
  return d
}
// Whether a and b touch: a corner of either lies on or in the other.
function touch(a: Piece, b: Piece) {
  if (!near(a, b, TOUCH)) return false
  for (const [x, y] of [[a, b], [b, a]]) for (const p of x.pts) {
    if (p.some((v, c) => v < y.lo[c] - TOUCH || v > y.hi[c] + TOUCH)) continue
    if (dist(p, y) <= TOUCH || inside(p, y.pos)) return true
  }
  return false
}
// How deep the deepest corner of a sits inside b.
function sunk(a: Piece, b: Piece) {
  if (!near(a, b, 0)) return 0
  let worst = 0
  for (const p of a.pts) {
    if (p.some((v, c) => v < b.lo[c] || v > b.hi[c])) continue
    if (inside(p, b.pos)) worst = Math.max(worst, dist(p, b))
  }
  return worst
}

function modPieces(body: Body, id: string, all = [id]) {
  const own = modParts(modFrame(body, all), id)
  const out: Piece[] = []
  for (const [kind, list] of Object.entries(own)) {
    if (kind === 'flame' || kind === 'glass') continue
    for (const g of list) out.push(piece(`${id} ${kind}#${out.length}`, (g.index ? g.toNonIndexed() : g).getAttribute('position').array))
  }
  return out
}

// Each mod's pieces that hang in the air: not joined to the car, even through the mod's other pieces.
function floating(body: Body, id: string, car: Piece[]) {
  const ps = modPieces(body, id)
  const held = new Set<number>()
  ps.forEach((p, i) => { if (car.some((c) => touch(p, c))) held.add(i) })
  for (let grew = true; grew;) {
    grew = false
    ps.forEach((p, i) => {
      if (held.has(i)) return
      if ([...held].some((j) => touch(p, ps[j]))) { held.add(i); grew = true }
    })
  }
  // How far each loose piece hangs off the car.
  const gap = (p: Piece) => {
    let d = Infinity
    for (const c of car) {
      if (!near(p, c, 0.1)) continue
      for (let i = 0; i + 2 < p.pos.length; i += 3) d = Math.min(d, dist([p.pos[i], p.pos[i + 1], p.pos[i + 2]], c))
    }
    return d
  }
  return ps.filter((_, i) => !held.has(i)).map((p) => `${p.name} by ${gap(p).toFixed(3)}`)
}

const SLOTS: ModSlot[] = ['spoiler', 'exhaust', 'kit', 'hood', 'lights']
const fitting = (body: Body) => MODS.filter((m) => SLOTS.includes(m.slot) && modFits(m, body))

describe('mods sit on every car they fit', () => {
  const bodies = [...new Set(CARS.map((c) => c.body))].filter((b) => !isBike(b))
  for (const body of bodies) {
    const model = CARS.find((c) => c.body === body)!.id
    it(`${body} (${model})`, () => {
      const bad: string[] = []
      for (const m of fitting(body)) {
        carPieces = []
        freshGeo(body, { [m.slot]: m.id }, model)
        const car = carPieces
        for (const f of floating(body, m.id, car)) bad.push(`${m.id}: ${f} floats`)
      }
      // Full sets: every slot's n-th mod together; no two run into each other.
      const ms = fitting(body)
      for (let n = 0; n < 6; n++) {
        const set = SLOTS.map((s) => ms.filter((m) => m.slot === s)).filter((l) => l.length).map((l) => l[n % l.length].id)
        const ps = set.map((id) => modPieces(body, id, set))
        for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) for (const a of ps[i]) for (const b of ps[j]) {
          const d = Math.max(sunk(a, b), sunk(b, a))
          if (d > CLASH) bad.push(`${a.name} runs ${d.toFixed(3)} into ${b.name}`)
        }
      }
      if (process.env.FIT_DUMP) for (const b of new Set(bad)) console.log(`FIT ${body}: ${b}`)
      expect([...new Set(bad)]).toEqual([])
    }, 300_000)
  }
})
