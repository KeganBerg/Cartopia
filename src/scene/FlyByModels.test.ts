// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import { Box3, Vector3, type BufferGeometry } from 'three'
import { LIVERIES, airlinerGeo, rocketGeo } from './FlyByModels'

const finite = (g: BufferGeometry) => Array.from(g.getAttribute('position').array).every(Number.isFinite)
const size = (g: BufferGeometry) => new Box3().setFromBufferAttribute(g.getAttribute('position') as never).getSize(new Vector3())

describe('fly-by models', () => {
  it('builds every airliner livery at the old plane size', () => {
    for (let i = 0; i < LIVERIES.length; i++) {
      const g = airlinerGeo(i)
      expect(finite(g)).toBe(true)
      const s = size(g)
      // Wings about 2.3 across, nose to tail about 2.5, flying along +z.
      expect(s.x).toBeGreaterThan(2.2)
      expect(s.x).toBeLessThan(2.45)
      expect(s.z).toBeGreaterThan(2.3)
      expect(s.z).toBeLessThan(2.7)
    }
  })
  it('turns every face of the lofted wings outwards', () => {
    // Faces pointing into the solid would show as holes: the normal of each
    // triangle points away from the airliner's middle on its own side.
    const g = airlinerGeo(0)
    const pos = g.getAttribute('position'), nor = g.getAttribute('normal')
    let bad = 0, wingTris = 0
    const idx = g.index!
    for (let t = 0; t < idx.count; t += 3) {
      const a = idx.getX(t)
      const x = (pos.getX(a) + pos.getX(idx.getX(t + 1)) + pos.getX(idx.getX(t + 2))) / 3
      // Outer wing panels only (past the engines), where nothing else is.
      if (Math.abs(x) < 0.7 || Math.abs(x) > 1.1) continue
      wingTris++
      const n = new Vector3(nor.getX(a), nor.getY(a), nor.getZ(a))
      // A flat wing's faces point up or down or along its edges, never back into the body.
      if (n.x * Math.sign(x) < -0.6) bad++
    }
    expect(wingTris).toBeGreaterThan(8)
    expect(bad).toBe(0)
  })
  it('builds the rocket', () => {
    expect(finite(rocketGeo)).toBe(true)
    expect(size(rocketGeo).y).toBeGreaterThan(1.8)
  })
})
