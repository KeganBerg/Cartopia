import { describe, expect, it } from 'vitest'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { roundedBox } from './roundedBox'

describe('roundedBox', () => {
  // Cars build hundreds of these; the fast one has to be the very same shape, normals and UVs.
  it('matches three’s RoundedBoxGeometry exactly', () => {
    const cases: [number, number, number, number, number][] = [
      [1, 1, 1, 2, 0.1], [0.3, 1.7, 0.05, 2, 0.02], [2.2, 0.4, 0.9, 1, 0.15], [0.02, 0.02, 0.6, 2, 0.5], [0.5, 0.2, 0.3, 1, 0.003],
    ]
    for (const c of cases) {
      const a = new RoundedBoxGeometry(...c), b = roundedBox(...c)
      for (const name of ['position', 'normal', 'uv']) {
        const x = a.getAttribute(name).array, y = b.getAttribute(name).array
        expect(y.length).toBe(x.length)
        expect(Array.from(y)).toEqual(Array.from(x))
      }
      expect(b.index).toBeNull()
      expect(b.groups).toEqual(a.groups)
    }
  })
})
