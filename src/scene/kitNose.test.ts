// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import type { BufferGeometry } from 'three'
import { CARS, MODS, isBike, modFits } from '../game/data'
import { freshGeo, type Part } from './CarModel'
import { modFrame, modParts } from './CarMods'

// Front lips, splitters and skid plates sit under the car's own nose: every part of the blade
// either has the nose right over it or juts a little way out ahead of it. A blade sized to the
// body's full width under a nose that tapers in hangs out past the corners in the air, and one
// stood out ahead of a low pointed nose on struts reads as a tray on stilts (the Vanta, 10-16).

// How far over the top of a blade the nose may sit and still read as bolted to it.
const OVER = 0.03
// How far ahead of the nose a blade may jut.
const AHEAD = 0.09
// How far a blade may reach out past the sides of the nose (the aero kit's, with end plates).
const WIDE = 0.045
const KITS = ['streetkit', 'widebody', 'carbonkit', 'rallykit', 'boxflares', 'aerokit']
// Car parts the nose is made of (not glass, lamps or tyres).
const SKIN: Part[] = ['paint', 'black', 'dark', 'stripe', 'chrome']

const flatten = (g: BufferGeometry) => (g.index ? g.toNonIndexed() : g).getAttribute('position').array

// Distance along dir (a unit axis: 1 = up, 2 = back along the car) from q to the nearest
// triangle, or Infinity.
function hit(q: number[], axis: 1 | 2, sign: number, tris: ArrayLike<number>[]) {
  let best = Infinity
  const [u, v] = axis === 1 ? [0, 2] : [0, 1]
  for (const pos of tris) for (let t = 0; t + 8 < pos.length; t += 9) {
    const a = [pos[t], pos[t + 1], pos[t + 2]], b = [pos[t + 3], pos[t + 4], pos[t + 5]], c = [pos[t + 6], pos[t + 7], pos[t + 8]]
    if (Math.min(a[u], b[u], c[u]) > q[u] || Math.max(a[u], b[u], c[u]) < q[u]) continue
    if (Math.min(a[v], b[v], c[v]) > q[v] || Math.max(a[v], b[v], c[v]) < q[v]) continue
    // Barycentric test in the (u, v) plane, then where the triangle's plane meets the ray.
    const d = (b[u] - a[u]) * (c[v] - a[v]) - (c[u] - a[u]) * (b[v] - a[v])
    if (Math.abs(d) < 1e-12) continue
    const s = ((q[u] - a[u]) * (c[v] - a[v]) - (c[u] - a[u]) * (q[v] - a[v])) / d
    const r = ((b[u] - a[u]) * (q[v] - a[v]) - (q[u] - a[u]) * (b[v] - a[v])) / d
    if (s < -1e-6 || r < -1e-6 || s + r > 1 + 1e-6) continue
    const at = a[axis] + s * (b[axis] - a[axis]) + r * (c[axis] - a[axis])
    const dist = (at - q[axis]) * sign
    if (dist >= -0.002) best = Math.min(best, Math.max(0, dist))
  }
  return best
}

// The blades: wide flat kit pieces low down at the front.
function blades(body: Parameters<typeof modFrame>[0], id: string) {
  const f = modFrame(body, [id])
  const out: { lo: number[]; hi: number[]; pos: ArrayLike<number> }[] = []
  for (const [kind, list] of Object.entries(modParts(f, id))) {
    if (kind === 'flame' || kind === 'glass') continue
    for (const g of list) {
      const pos = flatten(g)
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
      for (let i = 0; i < pos.length; i += 3) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], pos[i + c]); hi[c] = Math.max(hi[c], pos[i + c]) }
      if (hi[0] - lo[0] > 0.15 && hi[1] - lo[1] < 0.06 && (lo[2] + hi[2]) / 2 > f.front - 0.12 && lo[1] < f.lift + 0.08) out.push({ lo, hi, pos })
    }
  }
  return out
}

describe('front lips sit under the nose', () => {
  // Open-wheelers hang a lip on pylons under a narrow nose cone, like a front wing.
  const bodies = [...new Set(CARS.map((c) => c.body))].filter((b) => !isBike(b) && b !== 'formula' && b !== 'highboy')
  for (const body of bodies) {
    const kits = KITS.filter((id) => modFits(MODS.find((m) => m.id === id)!, body))
    if (!kits.length) continue
    const model = CARS.find((c) => c.body === body)!.id
    it(`${body} (${model})`, () => {
      const parts = freshGeo(body, {}, model).parts
      const tris = SKIN.flatMap((p) => (parts[p] ? [flatten(parts[p]!)] : []))
      const bad: string[] = []
      for (const id of kits) for (const b of blades(body, id)) {
        // Points over the blade's top, in from its edges.
        let worst = ''
        for (let i = 0; i <= 8; i++) for (let j = 0; j <= 4; j++) {
          const x = b.lo[0] + 0.01 + ((b.hi[0] - b.lo[0] - 0.02) * i) / 8
          const z = b.lo[2] + 0.005 + ((b.hi[2] - b.lo[2] - 0.01) * j) / 4
          // Looking up from the blade's underside, and back from it (a little in from the
          // corners, which may reach just past the sides of the nose).
          // Only points on the blade itself (a corner piece turned at an angle leaves its box half empty).
          if (hit([x, b.lo[1] - 0.01, z], 1, 1, [b.pos]) === Infinity) continue
          // A blade sunk up into the nose has the nose's floor running through it, just over its underside.
          const t = b.hi[1] - b.lo[1] + 0.01
          const xi = x - Math.sign(x) * Math.min(WIDE, Math.abs(x))
          if ([x, xi].some((u) => hit([u, b.lo[1] - 0.01, z], 1, 1, tris) <= t + OVER) || [0, 0.03, 0.06].some((dy) => hit([xi, (b.lo[1] + b.hi[1]) / 2 + dy, z], 2, -1, tris) <= AHEAD)) continue
          worst = `at x ${x.toFixed(3)} z ${z.toFixed(3)}`
        }
        if (worst) bad.push(`${id} blade hangs clear of the nose ${worst}`)
      }
      if (process.env.FIT_DUMP) for (const s of bad) console.log(`LIP ${body}: ${s}`)
      expect(bad).toEqual([])
    }, 120_000)
  }
})
