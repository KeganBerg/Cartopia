import { describe, expect, it } from 'vitest'
import { TILE } from '../game/data'
import { toWorld } from './grid'
import { townFocus } from './townFocus'

const b = (def: string, x: number, z: number, extra = {}) => ({ uid: `${def}${x},${z}`, def, x, z, jobEndsAt: null, ...extra })

describe('town focus', () => {
  it('centres on the buildings and roads, not trees far off', () => {
    const f = townFocus({ buildings: [b('house', 30, 30), b('house', 34, 30), b('tree', 2, 2), b('tree', 60, 60)], roads: ['30,31', '34,31'] })!
    const [cx, cz] = toWorld(32, 30.5)
    expect(f.x).toBeCloseTo(cx)
    expect(f.z).toBeCloseTo(cz)
    expect(f.maxX - f.minX).toBeCloseTo(5 * TILE)
  })

  it('leaves out buildings in the inventory', () => {
    const f = townFocus({ buildings: [b('house', 10, 10), b('house', 50, 50, { stored: true })], roads: [] })!
    expect(f.x).toBeCloseTo(toWorld(10, 10)[0])
  })

  it('falls back to decorations, then to nothing', () => {
    expect(townFocus({ buildings: [b('tree', 8, 8)], roads: [] })!.x).toBeCloseTo(toWorld(8, 8)[0])
    expect(townFocus({ buildings: [], roads: [] })).toBeNull()
  })
})
