// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import { Box3, type BufferGeometry } from 'three'
import { CARS, MODS, fittedMods, modFits } from '../game/data'
import { freshGeo } from './CarModel'
import { RIM_STYLE, SOLID_KINDS, modGeo, modIds } from './CarMods'
import { wheelGeo } from './carWheels'
import { PART_LIFT } from './PartPrize'
import { PART_OVER, partOver, prizeScale } from './CrateScene'

// A part won in the Crate Depot floats over the car wearing it, turning and tipped toward the
// camera. Wherever it turns, it never sinks into the car (or its roof rack, roll bar or mods):
// every corner of the turning part stays above everything on the car under its swing.

const TIP = 0.3
const AIR = 0.02

// Every corner of the part as PartPrize draws it, round its middle, before PART_OVER.
function partPoints(id: string, body: (typeof CARS)[number]['body']) {
  const slot = MODS.find((m) => m.id === id)!.slot
  const pts: number[][] = []
  if (slot === 'rims' || slot === 'tires') {
    const g = wheelGeo(RIM_STYLE[id] ?? 'five', 0.5, 0.3)
    const pos = g.tire.getAttribute('position')
    for (let i = 0; i < pos.count; i++) pts.push([pos.getX(i) * 1.5, pos.getY(i) * 1.5, pos.getZ(i) * 1.5])
    return { pts, tip: 0 }
  }
  const g = modGeo(body, [id])
  const geos = SOLID_KINDS.map((k) => g[k]).filter((x): x is BufferGeometry => !!x)
  const box = new Box3()
  for (const geo of geos) {
    geo.computeBoundingBox()
    box.union(geo.boundingBox!)
  }
  const mid = box.getCenter(box.min.clone())
  const size = box.getSize(box.min.clone())
  const scale = 2 / Math.max(0.05, size.x, size.y, size.z)
  for (const geo of geos) {
    const pos = geo.getAttribute('position')
    for (let i = 0; i < pos.count; i++) pts.push([(pos.getX(i) - mid.x) * scale, (pos.getY(i) - mid.y) * scale, (pos.getZ(i) - mid.z) * scale])
  }
  return { pts, tip: TIP }
}

// The part's lowest point (in the scene) and its widest swing from the turning axis, sampled round a full turn.
function partSpan(id: string, body: (typeof CARS)[number]['body'], y: number) {
  const { pts, tip } = partPoints(id, body)
  let low = Infinity
  let swing = 0
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 36) {
    const c = Math.cos(a), s = Math.sin(a)
    for (const [x, py, z] of pts) {
      const z1 = -x * s + z * c
      low = Math.min(low, y + PART_OVER * (PART_LIFT + py * Math.cos(tip) - z1 * Math.sin(tip)))
      swing = Math.max(swing, Math.hypot(x, z) * PART_OVER)
    }
  }
  return { low, swing }
}

// The highest point of the car (and its mods) anywhere under a swing of radius r round its middle.
function carHigh(model: string, body: (typeof CARS)[number]['body'], mods: string[], r: number) {
  const fit = fittedMods(mods, body)
  const sc = prizeScale(body)
  const geos = [...Object.values(freshGeo(body, fit, model).parts), ...Object.values(modGeo(body, modIds(fit), modIds(fit), model))]
  let high = 0
  for (const geo of geos) {
    const pos = geo?.getAttribute('position')
    if (!pos) continue
    const idx = geo!.index
    const n = idx ? idx.count : pos.count
    for (let i = 0; i + 2 < n; i += 3) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y = -Infinity
      for (let j = i; j < i + 3; j++) {
        const v = idx ? idx.getX(j) : j
        x0 = Math.min(x0, pos.getX(v)); x1 = Math.max(x1, pos.getX(v))
        z0 = Math.min(z0, pos.getZ(v)); z1 = Math.max(z1, pos.getZ(v))
        y = Math.max(y, pos.getY(v))
      }
      // The triangle's nearest point to the turning axis (by its bounds).
      const dx = Math.max(0, x0, -x1), dz = Math.max(0, z0, -z1)
      if (Math.hypot(dx, dz) * sc < r) high = Math.max(high, y * sc)
    }
  }
  return high
}

describe('a won part floats clear of the car wearing it', () => {
  for (const car of CARS) {
    it(`${car.id} (${car.body})`, () => {
      const bad: string[] = []
      for (const m of MODS) {
        if (!modFits(m, car.body) || m.slot === 'stance') continue
        const look = { body: car.body, model: car.id, mods: [m.id], hat: null }
        const { low, swing } = partSpan(m.id, car.body, partOver(look, m.id))
        const high = carHigh(car.id, car.body, [m.id], swing)
        if (low < high + AIR) bad.push(`${m.id}: lowest ${low.toFixed(3)} over car ${high.toFixed(3)}`)
      }
      expect(bad).toEqual([])
    }, 120_000)
  }
})
