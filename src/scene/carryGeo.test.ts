import { describe, expect, it } from 'vitest'
import { Box3, BufferAttribute, Vector3 } from 'three'
import { HELD, ITEM_SHAPES, headCarryGeo, itemsGeo, torsoCarryGeo } from './carryGeo'
import { readFileSync } from 'node:fs'

// What townspeople carry out of shops is a real thing at true size in their
// hands: every item the walkers hand out has a model, each one fits between
// the hands that hold it, and both arm poses are there for the shader to pick.

const items = itemsGeo()
const shape = items.getAttribute('shape') as BufferAttribute
const pos = items.getAttribute('position') as BufferAttribute
const boxOf = (id: number) => {
  const b = new Box3()
  const v = new Vector3()
  for (let i = 0; i < pos.count; i++) if (shape.getX(i) === id) b.expandByPoint(v.fromBufferAttribute(pos, i))
  return b
}

describe('carried items', () => {
  it('every shop item the townspeople carry has a model', () => {
    const src = readFileSync(new URL('./Townspeople.tsx', import.meta.url), 'utf8')
    const block = src.slice(src.indexOf('const ITEMS'), src.indexOf('}\n', src.indexOf('const ITEMS')))
    const ids = [...block.matchAll(/^\s+(\w+): \{ emoji/gm)].map((m) => m[1])
    expect(ids.length).toBeGreaterThan(10)
    for (const id of ids) expect(ITEM_SHAPES[id], id).toBeTruthy()
  })
  it('each item is its own model, sized to be held', () => {
    const ids = Object.values(ITEM_SHAPES).map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const [name, { id, side }] of Object.entries(ITEM_SHAPES)) {
      const b = boxOf(id)
      expect(b.isEmpty(), name).toBe(false)
      const s = b.getSize(new Vector3())
      // Held out front, it sits between the hands; hung at the side, it's no bigger than a case.
      if (!side) expect(s.x, name).toBeLessThanOrEqual(HELD.x * 2 + 0.03)
      expect(Math.max(s.x, s.y, s.z), name).toBeLessThanOrEqual(0.21)
      expect(Math.min(s.x, s.y, s.z), name).toBeGreaterThan(0.01)
    }
  })
  it('the body and hands carry both arm poses', () => {
    for (const g of [torsoCarryGeo(), headCarryGeo()]) {
      const pose = g.getAttribute('pose') as BufferAttribute
      const seen = new Set<number>()
      for (let i = 0; i < pose.count; i++) seen.add(pose.getX(i))
      expect([...seen].sort()).toEqual([0, 1, 2])
    }
  })
})
