import { describe, expect, it } from 'vitest'
import { BoxGeometry, Color } from 'three'
import { bake } from './bake'
import { Kit } from './kit'

describe('Kit', () => {
  it('lays pieces out like bake() does, moved, turned and coloured', () => {
    const box = new BoxGeometry(1, 1, 1)
    const k = new Kit().add(box, '#ff0000', 0, 0, 0).add(box, '#00ff00', 5, 1, 0, Math.PI / 2, 2, 1, 1, 0, 0, 0.4)
    const g = k.geometry()!
    const n = box.getAttribute('position').count
    expect(g.getAttribute('position').count).toBe(n * 2)
    expect(g.index!.count).toBe(box.index!.count * 2)
    // Second box: scaled 2 along x, then turned a quarter, so it spans 2 along z.
    const pos = g.getAttribute('position')
    let minZ = Infinity, maxZ = -Infinity, minX = Infinity
    for (let i = n; i < n * 2; i++) {
      minZ = Math.min(minZ, pos.getZ(i))
      maxZ = Math.max(maxZ, pos.getZ(i))
      minX = Math.min(minX, pos.getX(i))
    }
    expect(maxZ - minZ).toBeCloseTo(2)
    expect(minX).toBeCloseTo(4.5)
    const col = g.getAttribute('color')
    expect(new Color(col.getX(0), col.getY(0), col.getZ(0)).getHexString()).toBe('ff0000')
    expect(g.getAttribute('look').getY(n)).toBeCloseTo(0.4)
    // Same attribute set the baked material reads.
    const ref = bake([[box, { color: '#ff0000' }]])
    expect(Object.keys(g.attributes).sort()).toEqual(Object.keys(ref.attributes).sort())
  })

  it('makes nothing from nothing', () => {
    expect(new Kit().geometry()).toBeNull()
  })
})
