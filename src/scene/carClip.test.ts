// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import type { BufferGeometry } from 'three'
import { CARS, MODS, modFits, type Body, type ModSlot } from '../game/data'
import { Kit, freshGeo, type Part } from './CarModel'
import { modGeo, modIds } from './CarMods'

// Nothing that belongs outside a car ends up sunk inside its windows: a wiper or an aerial
// lost in the cabin behind the glass, a roof part sunk through the windshield. Every piece
// that isn't part of the cabin's inside (seats, dash, wheel) has to stay out of the glass
// greenhouse, bar the little it takes to sit on it, for every car, stock and with each mod.

// How far a piece may sink into the glass: enough for a pillar or a rail to sit in its edge.
const DEPTH = 0.012
// Corners closer than this to the glass are touching it, not in it.
const TOUCH = 0.003
// A piece with more of its corners than this inside the glass is inside the car.
const SHARE = 0.5
// What's meant to be inside the glass.
const INSIDE = new Set<string>(['seat', 'dash', 'cabin', 'display', 'glass', 'screen'])

type Piece = { look: string; at: string; geo: string; pos: ArrayLike<number> }
function source() {
  const lines = (new Error().stack ?? '').split('\n').slice(1)
  const l = lines.find((s) => /(CarModel|carTrim|exoticCars|oddballCars|restoCars)\.tsx?:\d+/.test(s) && !/Kit\.add|at bar |at Surface\./.test(s)) ?? ''
  const m = l.match(/(CarModel|carTrim|exoticCars|oddballCars|restoCars)\.tsx?:(\d+)/)
  return m ? `${m[1]}:${m[2]}` : '?'
}
const pieces: Piece[] = []
const add = Kit.prototype.add
Kit.prototype.add = function (this: Kit, part: Part, geo: BufferGeometry, ...rest: Parameters<Kit['add']> extends [Part, BufferGeometry, ...infer R] ? R : never) {
  const type = geo.type
  add.call(this, part, geo, ...rest)
  const list = this.parts.get(part)!
  pieces.push({ look: part, at: source(), geo: type, pos: list[list.length - 1].getAttribute('position').array })
}

const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const RAY = [0.1234, 1, 0.0371].map((c, _, v) => c / Math.hypot(v[0], v[1], v[2]))
function hit(q: number[], dir: number[], pos: ArrayLike<number>, t: number) {
  const e1 = [pos[t + 3] - pos[t], pos[t + 4] - pos[t + 1], pos[t + 5] - pos[t + 2]]
  const e2 = [pos[t + 6] - pos[t], pos[t + 7] - pos[t + 1], pos[t + 8] - pos[t + 2]]
  const h = [dir[1] * e2[2] - dir[2] * e2[1], dir[2] * e2[0] - dir[0] * e2[2], dir[0] * e2[1] - dir[1] * e2[0]]
  const a = dot(e1, h)
  if (Math.abs(a) < 1e-12) return -Infinity
  const s = [q[0] - pos[t], q[1] - pos[t + 1], q[2] - pos[t + 2]]
  const u = dot(s, h) / a
  if (u < 0 || u > 1) return -Infinity
  const qq = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]]
  const w = dot(dir, qq) / a
  if (w < 0 || u + w > 1) return -Infinity
  return dot(e2, qq) / a
}
function inside(q: number[], pos: ArrayLike<number>) {
  let hits = 0
  for (let t = 0; t + 8 < pos.length; t += 9) if (hit(q, RAY, pos, t) > 1e-9) hits++
  return hits % 2 === 1
}
// Distance from p to the nearest point of the triangle at pos[t..t+8].
function toTri(p: number[], pos: ArrayLike<number>, t: number) {
  const a = [pos[t], pos[t + 1], pos[t + 2]], b = [pos[t + 3], pos[t + 4], pos[t + 5]], c = [pos[t + 6], pos[t + 7], pos[t + 8]]
  const sub = (x: number[], y: number[]) => [x[0] - y[0], x[1] - y[1], x[2] - y[2]]
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a)
  const d1 = dot(ab, ap), d2 = dot(ac, ap)
  const at = (u: number, v: number) => Math.hypot(...sub(p, [a[0] + ab[0] * u + ac[0] * v, a[1] + ab[1] * u + ac[1] * v, a[2] + ab[2] * u + ac[2] * v]))
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
function depth(p: number[], pos: ArrayLike<number>) {
  let d = Infinity
  for (let t = 0; t + 8 < pos.length; t += 9) d = Math.min(d, toTri(p, pos, t))
  return d
}

// How deep the deepest corner of a piece sits inside the glass (0 when it's all outside), and
// how much of it is inside: a thin piece lost wholly inside (a wiper) never gets very deep.
function sunk(pos: ArrayLike<number>, glass: ArrayLike<number>) {
  let worst = 0
  let n = 0
  let k = 0
  for (let i = 0; i + 2 < pos.length; i += 3) {
    const p = [pos[i], pos[i + 1], pos[i + 2]]
    n++
    if (!inside(p, glass)) continue
    const d = depth(p, glass)
    if (d > TOUCH) k++
    worst = Math.max(worst, d)
  }
  return { worst, share: n ? k / n : 0 }
}

function fits(body: Body) {
  const ok = MODS.filter((m) => modFits(m, body) && m.slot !== 'rims' && m.slot !== 'tires' && m.slot !== 'stance')
  return [{}, ...ok.map((m) => ({ [m.slot]: m.id }))] as Partial<Record<ModSlot, string>>[]
}

function check(model: string, body: Body, fit: Partial<Record<ModSlot, string>>) {
  pieces.length = 0
  freshGeo(body, fit, model)
  const list = [...pieces]
  // The greenhouse: the glass shell extruded from the cabin's side profile.
  const shells = list.filter((p) => p.look === 'glass' && p.geo === 'ExtrudeGeometry')
  const ids = modIds(fit)
  if (ids.length) for (const [kind, geo] of Object.entries(modGeo(body, ids, ids, model))) if (geo && kind !== 'glass') list.push({ look: `mod ${kind}`, at: `mod ${ids.join('+')}`, geo: '', pos: geo.getAttribute('position').array })
  const bad: string[] = []
  for (const g of shells) for (const p of list) {
    if (INSIDE.has(p.look) || p.look === 'mod flame') continue
    // The body's own panels (haunches, hood bulges) blend into the glass's foot by design.
    if (p.look === 'paint' && p.at.startsWith('CarModel')) continue
    const { worst, share } = sunk(p.pos, g.pos)
    if (worst > DEPTH || share > SHARE) bad.push(`${model}: ${p.look} from ${p.at} sunk ${worst.toFixed(3)} into the glass`)
  }
  return bad
}

describe('nothing outside a car sinks into its glass', () => {
  for (const car of CARS) {
    it(`${car.id} (${car.body})`, () => {
      const bad = new Set<string>()
      for (const fit of fits(car.body)) for (const b of check(car.id, car.body, fit)) bad.add(b)
      if (process.env.CLIP_DUMP) for (const b of bad) console.log(`CLIP ${b}`)
      expect([...bad]).toEqual([])
    }, 120_000)
  }
})
