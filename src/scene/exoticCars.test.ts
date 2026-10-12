// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import { Box3, Vector3 } from 'three'
import { Kit, bar, brakes, carSize, seat, steering } from './CarModel'
import { EXOTIC } from './exoticCars'
import { CARS, type Body } from '../game/data'

describe('exotic cars', () => {
  for (const [body, draw] of Object.entries(EXOTIC) as [Body, NonNullable<(typeof EXOTIC)[Body]>][]) {
    it(`${body} builds a clean, phone-sized body`, () => {
      const k = new Kit()
      draw(k, {}, { seat, steering, brakes, bar })
      const parts = k.build()
      let tris = 0
      const box = new Box3()
      for (const g of Object.values(parts)) {
        const p = g!.getAttribute('position')
        tris += p.count / 3
        for (let i = 0; i < p.count; i++) expect(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))).toBe(true)
        g!.computeBoundingBox()
        box.union(g!.boundingBox!)
      }
      // About as heavy as the detailed procedural cars close up (15-25K).
      expect(tris).toBeLessThan(26000)
      // It stays in its footprint (mirrors and pipes may poke out a little) and on the ground.
      const s = carSize(body)
      const size = box.getSize(new Vector3())
      expect(size.x).toBeLessThan(s.wid + 0.12)
      expect(size.z).toBeLessThan(s.len + 0.1)
      expect(box.min.y).toBeGreaterThan(0.03)
      expect(parts.paint && parts.glass && parts.lamp && parts.tail && parts.stripe).toBeTruthy()
    })
    it(`${body} is used by a car`, () => expect(CARS.some((c) => c.body === body)).toBe(true))
  }
})
