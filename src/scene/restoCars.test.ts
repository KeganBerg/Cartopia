// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import { Box3, Vector3 } from 'three'
import { Kit, bar, brakes, carSize, seat, steering } from './CarModel'
import { RESTO } from './restoCars'
import { CARS, type Body } from '../game/data'

describe('resto-mod cars', () => {
  for (const [body, draw] of Object.entries(RESTO) as [Body, NonNullable<(typeof RESTO)[Body]>][]) {
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
      expect(tris).toBeLessThan(26000)
      const s = carSize(body)
      const size = box.getSize(new Vector3())
      expect(size.x).toBeLessThan(s.wid + 0.12)
      expect(size.z).toBeLessThan(s.len + 0.1)
      expect(box.min.y).toBeGreaterThan(0.03)
      expect(parts.paint && parts.glass && parts.lamp && parts.tail && parts.stripe).toBeTruthy()
    })
    it(`${body} is a secret car`, () => expect(CARS.filter((c) => c.body === body).every((c) => c.secret)).toBe(true))
  }
})
