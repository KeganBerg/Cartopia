// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import type { BufferGeometry } from 'three'
import { CARS, MODS, modFits, type Body, type ModSlot } from '../game/data'
import { Kit, freshGeo, type Part } from './CarModel'
import { modGeo, modIds } from './CarMods'

// No flicker (Z-fighting) on cars: two flat faces that face the same way, overlap
// and sit (almost) in the same plane fight over the same pixels, which shows as a
// patch of one colour flickering through another (a racing disc half sunk in the
// door, a vent flush with the hood). Cars are merged one mesh per look, so this
// watches every piece go into the Kit, plus the bolt-on mod parts, for every car
// in the catalog, stock, with each mod that fits and with a full set.
//
// THE RULE: two faces that look different and face the same way are GAP or more
// apart. Fix one by lifting the top piece clear, or by sinking it fully under.

// 0.002 of a car (a car is about 1.4 long) is a few millimetres: well over a depth
// step at the closest garage and race cameras.
const GAP = 0.002
// Overlaps smaller than this (square units) are seams along an edge, not a visible patch.
const AREA = 0.0001

type Piece = { look: string; open: boolean; flat: boolean; solid?: boolean; at: string; pos: ArrayLike<number> }
// Where in the car code a piece was added: the first frame outside the Kit and this file.
function source() {
  const lines = (new Error().stack ?? '').split('\n').slice(1)
  const l = lines.find((s) => /(CarModel|carTrim|exoticCars|oddballCars|restoCars|packCars\/\w+)\.tsx?:\d+/.test(s) && !/Kit\.add|at bar |at Surface\./.test(s)) ?? ''
  const m = l.match(/(CarModel|carTrim|exoticCars|oddballCars|restoCars|packCars\/\w+)\.tsx?:(\d+)/)
  return m ? `${m[1]}:${m[2]}` : '?'
}
const pieces: Piece[] = []
const add = Kit.prototype.add
Kit.prototype.add = function (this: Kit, part: Part, geo: BufferGeometry, ...rest: Parameters<Kit['add']> extends [Part, BufferGeometry, ...infer R] ? R : never) {
  const type = geo.type
  add.call(this, part, geo, ...rest)
  const list = this.parts.get(part)!
  // Flat one-sided pieces in the double-sided black show from behind too.
  const flat = type === 'PlaneGeometry' || type === 'CircleGeometry'
  pieces.push({ look: part, open: part === 'black' && flat, flat, solid: type === 'ExtrudeGeometry' && part === 'paint', at: source(), pos: list[list.length - 1].getAttribute('position').array })
}

// Looks that draw the same colour can't be told apart, so they can't flicker:
// mod paint is the body paint.
const MOD_LOOK: Record<string, string> = { paint: 'paint', carbon: 'carbon', chrome: 'modchrome', glass: 'modglass', ti: 'modti', lamp: 'modlamp', neon: 'modneon' }

type Tri = { piece: number; look: string; flat: boolean; n: [number, number, number]; d: number; p: number[] }

function tris(list: Piece[]) {
  const out: Tri[] = []
  list.forEach((pc, i) => {
    const a = pc.pos
    for (let t = 0; t + 8 < a.length; t += 9) {
      const p = Array.from({ length: 9 }, (_, k) => a[t + k])
      const ux = p[3] - p[0], uy = p[4] - p[1], uz = p[5] - p[2]
      const vx = p[6] - p[0], vy = p[7] - p[1], vz = p[8] - p[2]
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
      const l = Math.hypot(nx, ny, nz)
      if (l < 1e-9) continue
      nx /= l; ny /= l; nz /= l
      out.push({ piece: i, look: pc.look, flat: pc.flat, n: [nx, ny, nz], d: nx * p[0] + ny * p[1] + nz * p[2], p })
      if (pc.open) out.push({ piece: i, look: pc.look, flat: pc.flat, n: [-nx, -ny, -nz], d: -(nx * p[0] + ny * p[1] + nz * p[2]), p: [p[0], p[1], p[2], p[6], p[7], p[8], p[3], p[4], p[5]] })
    }
  })
  return out
}

const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

// How much of triangle a has triangle b within GAP of it (in front or behind),
// looking along a's normal. Coplanar faces share their whole overlap; a face
// crossing a decal at a shallow angle shares the thin band where they meet.
function clip(a: Tri, b: Tri) {
  const n = a.n
  const ax = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
  let u = [n[1] * ax[2] - n[2] * ax[1], n[2] * ax[0] - n[0] * ax[2], n[0] * ax[1] - n[1] * ax[0]]
  const ul = Math.hypot(u[0], u[1], u[2])
  u = u.map((c) => c / ul)
  const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]]
  const flat = (p: number[]) => [0, 3, 6].map((k) => [p[k] * u[0] + p[k + 1] * u[1] + p[k + 2] * u[2], p[k] * v[0] + p[k + 1] * v[1] + p[k + 2] * v[2]])
  const ccw = (q: number[][]) => ((q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]) < 0 ? [q[0], q[2], q[1]] : q)
  const A = ccw(flat(a.p))
  let poly = ccw(flat(b.p))
  for (let i = 0; i < 3 && poly.length; i++) {
    const [p, q] = [A[i], A[(i + 1) % 3]]
    const side = (r: number[]) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    const next: number[][] = []
    for (let j = 0; j < poly.length; j++) {
      const c = poly[j], d = poly[(j + 1) % poly.length]
      const sc = side(c), sd = side(d)
      if (sc >= 0) next.push(c)
      if (sc >= 0 !== sd >= 0) {
        const t = sc / (sc - sd)
        next.push([c[0] + (d[0] - c[0]) * t, c[1] + (d[1] - c[1]) * t])
      }
    }
    poly = next
  }
  let s = 0
  for (let j = 0; j < poly.length; j++) {
    const c = poly[j], d = poly[(j + 1) % poly.length]
    s += c[0] * d[1] - d[0] * c[1]
  }
  const area = Math.abs(s) / 2
  // How far b's plane sits off a's (along a's normal) at each corner of the shared patch.
  const nb = dot(b.n, n)
  const off = poly.map(([x, y]) => {
    const q = [x * u[0] + y * v[0] + a.d * n[0], x * u[1] + y * v[1] + a.d * n[1], x * u[2] + y * v[2] + a.d * n[2]]
    return (b.d - dot(b.n, q)) / nb
  })
  return { area, lo: Math.min(...off), hi: Math.max(...off) }
}

const triArea = (t: Tri) => {
  const p = t.p
  const ux = p[3] - p[0], uy = p[4] - p[1], uz = p[5] - p[2]
  const vx = p[6] - p[0], vy = p[7] - p[1], vz = p[8] - p[2]
  return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2
}

function fight(a: Tri, b: Tri) {
  const { area, lo, hi } = clip(a, b)
  if (area < 1e-7) return 0
  const g = GAP - 1e-6
  if (hi - lo < 1e-9) return Math.abs(lo) < g ? area : 0
  return (area * Math.max(0, Math.min(hi, g) - Math.max(lo, -g))) / (hi - lo)
}

// A face with another face turned back against it, close in front, can't be seen
// (the underside of a stripe on the hood, the back of a badge on the body).
const PRESSED = 0.01

// Whether a point is inside a closed solid (the extruded body, cabin and roof shells),
// by counting how many of its faces a ray from the point crosses.
const RAY = (() => {
  const v = [0.1234, 1, 0.0371]
  const l = Math.hypot(v[0], v[1], v[2])
  return v.map((c) => c / l)
})()
// Distance along dir from q to the triangle at pos[t..t+8], or -Infinity on a miss (Moller-Trumbore).
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
// Looks you can see through: they don't hide what's behind them.
const CLEAR = new Set(['glass', 'screen', 'modglass'])

// Faces this close to parallel are checked for a crossing band; steeper crossings
// are ordinary joints and their band is too thin to see.
const SHALLOW = Math.cos((15 * Math.PI) / 180)
const CELL = 0.05

function fights(list: Piece[]) {
  const all = tris(list)
  const shared = new Map<string, { area: number; at: number[] }>()
  const note = (a: Tri, b: Tri, w: number) => {
    const [x, y] = a.piece < b.piece ? [a, b] : [b, a]
    const k = `${list[x.piece].at} ${x.look} ~ ${list[y.piece].at} ${y.look}`
    const e = shared.get(k) ?? { area: 0, at: [(a.p[0] + a.p[3] + a.p[6]) / 3, (a.p[1] + a.p[4] + a.p[7]) / 3, (a.p[2] + a.p[5] + a.p[8]) / 3] }
    e.area += w
    shared.set(k, e)
  }
  const differ = (a: Tri, b: Tri) => a.piece !== b.piece && a.look !== b.look
  const cells = new Map<string, number[]>()
  const span = (t: Tri, pad: number, f: (k: string) => void) => {
    const lo = [0, 1, 2].map((c) => Math.floor((Math.min(t.p[c], t.p[c + 3], t.p[c + 6]) - pad) / CELL))
    const hi = [0, 1, 2].map((c) => Math.floor((Math.max(t.p[c], t.p[c + 3], t.p[c + 6]) + pad) / CELL))
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) f(`${x}|${y}|${z}`)
  }
  all.forEach((t, i) => span(t, 0, (k) => {
    const g = cells.get(k)
    if (g) g.push(i)
    else cells.set(k, [i])
  }))
  // Same plane: bucket by normal and distance.
  const key = (t: Tri, dd = 0) => `${Math.round(t.n[0] * 40)}|${Math.round(t.n[1] * 40)}|${Math.round(t.n[2] * 40)}|${Math.floor(t.d / GAP) + dd}`
  const planes = new Map<string, number[]>()
  all.forEach((t, i) => {
    const k = key(t)
    const g = planes.get(k)
    if (g) g.push(i)
    else planes.set(k, [i])
  })
  const hidden = all.map((a) => {
    const lo = Math.floor(-(a.d + PRESSED) / GAP) - 1, hi = Math.floor(-(a.d - GAP) / GAP) + 1
    const nk = `${Math.round(-a.n[0] * 40)}|${Math.round(-a.n[1] * 40)}|${Math.round(-a.n[2] * 40)}`
    let cover = 0
    for (let q = lo; q <= hi; q++) {
      for (const j of planes.get(`${nk}|${q}`) ?? []) {
        const c = all[j]
        if (c.piece === a.piece || dot(a.n, c.n) > -0.9995) continue
        const r = clip(a, c)
        if (r.area > 1e-9 && r.lo > -GAP && r.hi < PRESSED) cover += r.area
      }
    }
    return cover > triArea(a) * 0.95
  })
  // Faces sunk inside a solid shell (the underside of a hood stripe) can't be seen either.
  const solids = list.filter((p) => p.solid)
  const sunk = new Map<number, boolean>()
  const buried = (i: number) => {
    let r = sunk.get(i)
    if (r === undefined) {
      const t = all[i]
      const q = [0, 1, 2].map((c) => (t.p[c] + t.p[c + 3] + t.p[c + 6]) / 3 + t.n[c] * 0.0005)
      r = hidden[i] || solids.some((s) => s !== list[t.piece] && inside(q, s.pos))
      if (!r) {
        // Something solid right in front of it, facing back at it (a face tucked against the nose).
        const c = [0, 1, 2].map((k) => (t.p[k] + t.p[k + 3] + t.p[k + 6]) / 3)
        const near = new Set<number>()
        const seg: Tri = { ...t, p: [...c, ...c.map((v, k) => v + t.n[k] * PRESSED), ...c] }
        span(seg, 0, (k) => cells.get(k)?.forEach((j) => near.add(j)))
        for (const j of near) {
          const o = all[j]
          if (o.piece === t.piece || CLEAR.has(o.look) || dot(o.n, t.n) > -0.2) continue
          const d = hit(c, t.n, o.p, 0)
          if (d > -1e-6 && d < PRESSED) { r = true; break }
        }
      }
      sunk.set(i, r)
    }
    return r
  }
  const seen = new Set<string>()
  all.forEach((a, i) => {
    for (const dd of [-1, 0, 1]) {
      for (const j of planes.get(key(a, dd)) ?? []) {
        if (j <= i) continue
        const b = all[j]
        if (!differ(a, b) || hidden[i] || hidden[j] || dot(a.n, b.n) < 0.9995) continue
        seen.add(`${i}|${j}`)
        const w = fight(a, b)
        if (w > 0 && !buried(i) && !buried(j)) note(a, b, w)
      }
    }
  })
  // Decals (flat planes and discs) against anything crossing them at a shallow angle.
  all.forEach((a, i) => {
    if (!a.flat || hidden[i]) return
    const near = new Set<number>()
    span(a, GAP, (k) => cells.get(k)?.forEach((j) => near.add(j)))
    for (const j of near) {
      const b = all[j]
      if (!differ(a, b) || hidden[j] || seen.has(`${Math.min(i, j)}|${Math.max(i, j)}`) || dot(a.n, b.n) < SHALLOW) continue
      const w = fight(a, b)
      if (w > 0 && !buried(i) && !buried(j)) note(a, b, w)
    }
  })
  return [...shared].filter(([, e]) => e.area >= AREA).map(([k, e]) => ({ k, line: `${k} at ${e.at.map((c) => c.toFixed(3)).join(',')} (${e.area.toFixed(4)})` }))
}

// Stock, each mod that fits on its own, and every slot filled (the n-th part of each slot).
function fits(body: Body) {
  const ok = MODS.filter((m) => modFits(m, body) && m.slot !== 'rims' && m.slot !== 'tires' && m.slot !== 'stance')
  const out: Partial<Record<ModSlot, string>>[] = [{}]
  for (const m of ok) out.push({ [m.slot]: m.id })
  for (let n = 0; n < 6; n++) {
    const f: Partial<Record<ModSlot, string>> = {}
    for (const slot of ['spoiler', 'exhaust', 'kit', 'hood', 'lights'] as ModSlot[]) {
      const of = ok.filter((m) => m.slot === slot)
      if (of.length) f[slot] = of[n % of.length].id
    }
    out.push(f)
  }
  return out
}

function check(model: string, body: Body, fit: Partial<Record<ModSlot, string>>) {
  pieces.length = 0
  freshGeo(body, fit, model)
  const list = [...pieces]
  const ids = modIds(fit)
  if (ids.length) {
    const g = modGeo(body, ids, ids, model)
    for (const [kind, geo] of Object.entries(g)) if (geo && MOD_LOOK[kind]) list.push({ look: MOD_LOOK[kind], open: false, flat: false, at: `mod ${kind}`, pos: geo.getAttribute('position').array })
  }
  const tag = ids.length ? ` +${ids.join('+')}` : ''
  return fights(list).map((f) => ({ k: f.k, line: `${model}${tag}: ${f.line}` }))
}

describe('cars never Z-fight', () => {
  for (const car of CARS) {
    it(`${car.id} (${car.body})`, () => {
      // Each fight once, from the first fit that shows it.
      const bad = new Map<string, string>()
      for (const fit of fits(car.body)) for (const b of check(car.id, car.body, fit)) if (!bad.has(b.k)) bad.set(b.k, b.line)
      expect([...bad.values()]).toEqual([])
    }, 60_000)
  }
})
