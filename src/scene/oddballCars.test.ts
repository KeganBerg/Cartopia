// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import { Box3, Vector3 } from 'three'
import { Kit, bar, brakes, carFrame, carSize, seat, steering } from './CarModel'
import { ODDBALL } from './oddballCars'
import { CARS, type Body } from '../game/data'

describe('oddball cars', () => {
  for (const [body, draw] of Object.entries(ODDBALL) as [Body, NonNullable<(typeof ODDBALL)[Body]>][]) {
    it(`${body} builds a clean, phone-sized body that sits on its wheels`, () => {
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
      expect(tris).toBeLessThan(26000)
      // It stays in its footprint (mirrors and bumpers may poke out a little) and off the ground.
      const s = carSize(body)
      const size = box.getSize(new Vector3())
      expect(size.x).toBeLessThan(s.wid + 0.12)
      expect(size.z).toBeLessThan(s.len + 0.1)
      expect(box.min.y).toBeGreaterThan(0.03)
      // The body reaches down to the tops of its tyres, so the wheels never float clear of it.
      const f = carFrame(body)
      expect(f.lift).toBeLessThanOrEqual(f.wheel * 2 + 0.03)
      expect(parts.paint && parts.glass && parts.lamp && parts.tail).toBeTruthy()
    })
    it(`${body} is used by a car`, () => expect(CARS.some((c) => c.body === body)).toBe(true))
  }
})
