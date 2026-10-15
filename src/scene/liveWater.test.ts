import { describe, expect, it } from 'vitest'
import { Box3 } from 'three'
import { heightAt, rippleHeight, splash } from './liveWater'
import { CHICK_SIZE, duckParts } from './Ducks'
import { PERSON_H } from './peopleGeo'

describe('live water', () => {
  it('never dips below where it is laid, so the banks under a lake stay hidden', () => {
    for (const wind of [0, 0.5, 1])
      for (let i = 0; i < 400; i++) expect(heightAt(Math.sin(i) * 20, Math.cos(i * 1.3) * 12, i * 0.37, wind)).toBeGreaterThanOrEqual(-1e-6)
  })

  it('rings spread out from a splash and fade', () => {
    splash(0, 0, 1)
    const t0 = performance.now() / 1000
    const at = (r: number, dt: number) => Math.max(...[0, 0.02, 0.04, 0.06, 0.08, 0.1].map((k) => Math.abs(rippleHeight(r + k, 0, t0 + dt))))
    // The ring has reached 1 unit out after about a second, not yet 3 units.
    expect(at(1, 1.2)).toBeGreaterThan(at(3, 1.2))
    expect(at(1, 1.2)).toBeGreaterThan(0)
    // Long after, nothing is left of it.
    expect(at(1, 10)).toBeLessThan(1e-6)
  })
})

describe('ducks', () => {
  it('are mallard-sized next to a townsperson, ducklings smaller', () => {
    const p = duckParts()
    for (const g of [p.drake, p.hen]) {
      const b = new Box3().setFromBufferAttribute(g.getAttribute('position') as never)
      const len = b.max.z - b.min.z
      // About 60 cm nose to tail: a third of a person.
      expect(len / PERSON_H).toBeGreaterThan(0.25)
      expect(len / PERSON_H).toBeLessThan(0.45)
      // Riding on the water, not standing on it.
      expect(b.max.y).toBeLessThan(PERSON_H * 0.3)
    }
    expect(CHICK_SIZE).toBeLessThan(0.6)
  })
})
