import { describe, expect, it } from 'vitest'
import { CITY, HWY0, HWY_DIR, LAKE, R0, buildTerrain, heightAt, hwyHeight } from './horizonLand'
import { LAYER } from './layers'

describe('land beyond the town', () => {
  it('starts under the edge of the town meadow', () => {
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      for (const r of [0, 100, R0 - 1]) expect(heightAt(Math.cos(a) * r, Math.sin(a) * r)).toBeLessThan(LAYER.outer)
    }
  })

  it('rises over the corners of the meadow square, so the two never flicker', () => {
    // The countryside ground is a 400-unit square; past 215 units out the land must be above it.
    for (let x = -200; x <= 200; x += 5) {
      for (let z = -200; z <= 200; z += 5) {
        if (Math.hypot(x, z) < 215) continue
        expect(heightAt(x, z)).toBeGreaterThan(LAYER.outer + 0.2)
      }
    }
  })

  it('holds a lake below the water line, a flat city and a level highway', () => {
    expect(heightAt(LAKE[0], LAKE[1])).toBeLessThan(-1.4 - 2)
    expect(Math.abs(heightAt(CITY[0], CITY[1]) - 2)).toBeLessThan(0.5)
    for (const s of [-600, -200, 0, 300, 700]) {
      const x = HWY0[0] + HWY_DIR[0] * s
      const z = HWY0[1] + HWY_DIR[1] * s
      expect(Math.abs(heightAt(x, z) - (hwyHeight(s) - 0.3))).toBeLessThan(0.5)
    }
  })

  it('builds a mesh of upward-facing triangles', () => {
    const g = buildTerrain()
    const n = g.attributes.normal
    expect(n.count).toBeGreaterThan(10000)
    for (let i = 0; i < n.count; i++) expect(n.getY(i)).toBeGreaterThan(0)
  })
})
