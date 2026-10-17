// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import type { BufferGeometry } from 'three'
import { CARS, isBike } from '../game/data'
import { Kit, carFrame, freshGeo, type Part } from './CarModel'

// Flat things laid on a car's skin (wheel wells, lamp slits, vents, badges, stripes) lie on the
// skin all over: no corner of one hangs off past the edge of the panel it's on, where it shows as a
// black flap sticking up over a fender or a strip floating in the air at close range.

const FLAT = 0.0008
// How far a flat piece may overhang the edge of what it lies on.
const EDGE = 0.015
const UP = [0, 1, 0]
// How far in from a well's face to look up from: a well standing a few millimetres proud of a
// side that curves away is fine.
const IN = 0.008

type Piece = { look: Part; at: string; pos: ArrayLike<number> }
function source() {
  const lines = (new Error().stack ?? '').split('\n').slice(1)
  const l = lines.find((s) => /(CarModel|carTrim|exoticCars|oddballCars|restoCars|packCars\/\w+)\.tsx?:\d+/.test(s) && !/Kit\.add|at Surface\./.test(s)) ?? ''
  const m = l.match(/(CarModel|carTrim|exoticCars|oddballCars|restoCars|packCars\/\w+)\.tsx?:(\d+)/)
  return m ? `${m[1]}:${m[2]}` : '?'
}
let pieces: Piece[] = []
const add = Kit.prototype.add
Kit.prototype.add = function (this: Kit, part: Part, geo: BufferGeometry, ...rest: Parameters<Kit['add']> extends [Part, BufferGeometry, ...infer R] ? R : never) {
  add.call(this, part, geo, ...rest)
  const list = this.parts.get(part)!
  pieces.push({ look: part, at: source(), pos: list[list.length - 1].getAttribute('position').array })
}

const sub = (x: number[], y: number[]) => [x[0] - y[0], x[1] - y[1], x[2] - y[2]]
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const vtx = (pos: ArrayLike<number>, i: number) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]

// Whether every corner lies in one plane (a decal, not a solid).
function flat(pos: ArrayLike<number>) {
  const n = pos.length / 3
  if (n < 3) return false
  for (let t = 0; t + 2 < n; t += 3) {
    const a = vtx(pos, t), b = vtx(pos, t + 1), c = vtx(pos, t + 2)
    const nn = cross(sub(b, a), sub(c, a))
    const l = Math.hypot(...nn)
    if (l < 1e-9) continue
    const u = nn.map((v) => v / l)
    for (let i = 0; i < n; i++) if (Math.abs(dot(sub(vtx(pos, i), a), u)) > FLAT) return false
    return true
  }
  return false
}

// Distance along dir from q to the nearest triangle of pos, or Infinity.
function hit(q: number[], dir: number[], pos: ArrayLike<number>) {
  let best = Infinity
  for (let t = 0; t + 8 < pos.length; t += 9) {
    // Skip triangles wholly to one side of the ray's line across the axes it doesn't run along.
    let skip = false
    for (let c = 0; c < 3 && !skip; c++) {
      if (dir[c] !== 0) continue
      const a = pos[t + c], b = pos[t + 3 + c], e = pos[t + 6 + c]
      skip = Math.min(a, b, e) > q[c] + 1e-6 || Math.max(a, b, e) < q[c] - 1e-6
    }
    if (skip) continue
    const e1 = [pos[t + 3] - pos[t], pos[t + 4] - pos[t + 1], pos[t + 5] - pos[t + 2]]
    const e2 = [pos[t + 6] - pos[t], pos[t + 7] - pos[t + 1], pos[t + 8] - pos[t + 2]]
    const h = cross(dir, e2)
    const a = dot(e1, h)
    if (Math.abs(a) < 1e-12) continue
    const sv = [q[0] - pos[t], q[1] - pos[t + 1], q[2] - pos[t + 2]]
    const u = dot(sv, h) / a
    if (u < -1e-6 || u > 1 + 1e-6) continue
    const qq = cross(sv, e1)
    const w = dot(dir, qq) / a
    if (w < -1e-6 || u + w > 1 + 1e-6) continue
    const d = dot(e2, qq) / a
    if (d > -1e-6 && d < best) best = d
  }
  return best
}
function normal(pos: ArrayLike<number>) {
  for (let t = 0; t + 2 < pos.length / 3; t += 3) {
    const a = vtx(pos, t), b = vtx(pos, t + 1), c = vtx(pos, t + 2)
    const nn = cross(sub(b, a), sub(c, a))
    const l = Math.hypot(...nn)
    if (l > 1e-9) return nn.map((v) => v / l)
  }
  return [0, 1, 0]
}

// The wheel wells: flat black half discs on the sides round each tyre. The ring of each well
// outside the tyre lies on the car's side all round (nothing hangs in the air over a curving
// fender top) and nothing on the car covers it (it never runs up through a wing or a pod).
export function badWells(model: string) {
  const def = CARS.find((c) => c.id === model)!
  pieces = []
  freshGeo(def.body, {}, model)
  const f = carFrame(def.body, model)
  const all = pieces.filter((p) => p.look !== 'glass')
  const bad: string[] = []
  for (const p of pieces) {
    if (p.look !== 'black' || !flat(p.pos)) continue
    const n = normal(p.pos)
    if (Math.abs(n[0]) < 0.9) continue
    const nv = p.pos.length / 3
    let lo = Infinity, hi = -Infinity, z0 = 0, x0 = 0
    for (let i = 0; i < nv; i++) { lo = Math.min(lo, p.pos[i * 3 + 1]); hi = Math.max(hi, p.pos[i * 3 + 1]); z0 += p.pos[i * 3 + 2] / nv; x0 += p.pos[i * 3] / nv }
    const axle = [f.wz, -f.wz].find((z) => Math.abs(z - z0) < f.wheel * 0.5)
    if (axle === undefined || hi - lo < f.wheel * 0.8) continue
    const sd = Math.sign(x0)
    const out = [sd, 0, 0]
    // Sample the ring between the tyre and the well's edge.
    let worst = ''
    for (let a = 0.3; a < Math.PI - 0.29 && !worst; a += Math.PI / 24) for (const k of [0.25, 0.6]) {
      // The well's radius along this direction.
      let R = 0
      for (let i = 0; i < nv; i++) {
        const dz = p.pos[i * 3 + 2] - axle, dy = p.pos[i * 3 + 1] - f.wheel
        if (Math.abs(Math.atan2(dy, -dz * sd) - a) < 0.2 || Math.abs(Math.atan2(dy, dz * sd) - a) < 0.2) R = Math.max(R, Math.hypot(dz, dy))
      }
      const r = f.wheel * 1.04 + (R - f.wheel * 1.04 - EDGE) * k
      if (r <= f.wheel * 1.04) continue
      const q = [x0, f.wheel + Math.sin(a) * r, axle + Math.cos(a) * r]
      if (!inside2d(q, p.pos)) continue
      let above = Infinity, front = Infinity
      for (const s of all) {
        if (s === p) continue
        above = Math.min(above, hit([q[0] - sd * IN, q[1], q[2]], UP, s.pos))
        if (s.look === 'paint') front = Math.min(front, hit(q, out, s.pos))
      }
      if (front < 0.05) worst = `runs into the body at ${q.map((v) => v.toFixed(2)).join(',')}`
      else if (above === Infinity) worst = `shows over the body at ${q.map((v) => v.toFixed(2)).join(',')}`
    }
    if (worst) bad.push(`well at ${p.at} ${worst}`)
  }
  return [...new Set(bad)]
}
// Whether q (on the piece's plane) lies on one of its triangles, seen along x.
function inside2d(q: number[], pos: ArrayLike<number>) {
  for (let t = 0; t + 8 < pos.length; t += 9) {
    const [ay, az, by, bz, cy, cz] = [pos[t + 1], pos[t + 2], pos[t + 4], pos[t + 5], pos[t + 7], pos[t + 8]]
    const d = (by - ay) * (cz - az) - (bz - az) * (cy - ay)
    if (Math.abs(d) < 1e-12) continue
    const u = ((q[1] - ay) * (cz - az) - (q[2] - az) * (cy - ay)) / d
    const v = ((by - ay) * (q[2] - az) - (bz - az) * (q[1] - ay)) / d
    if (u >= 0 && v >= 0 && u + v <= 1) return true
  }
  return false
}

describe('wheel wells sit on the car', () => {
  for (const def of CARS.filter((c) => !isBike(c.body) && c.body !== 'formula')) {
    it(def.id, () => {
      const bad = badWells(def.id)
      if (process.env.FIT_DUMP) for (const b of bad) console.log(`WELL ${def.id}: ${b}`)
      expect(bad).toEqual([])
    }, 120_000)
  }
})
