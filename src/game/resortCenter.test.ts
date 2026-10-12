import { describe, expect, it } from 'vitest'
import { resortLayout, isResort, type Rect } from './resortCenter'
import { storeDoors } from './storeDoors'
import type { PlacedBuilding } from './store'

const BLOCKS: [number, number][] = [[2, 1], [1, 2], [2, 2], [4, 4]]
const hit = (a: Rect, b: Rect) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-6 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 1e-6

describe('resort layout', () => {
  it('only merged motels at level 7+ become one', () => {
    expect(isResort('motel', 7, [2, 1, 1])).toBe(true)
    expect(isResort('motel', 10, [4, 4, 4])).toBe(true)
    expect(isResort('motel', 6, [2, 2, 2])).toBe(false)
    expect(isResort('motel', 10, [1, 1, 1])).toBe(false)
    expect(isResort('market', 10, [2, 2, 2])).toBe(false)
  })

  for (const [sx, sz] of BLOCKS) {
    it(`fits the ${sx}x${sz} block with the pool clear of the buildings`, () => {
      const t = resortLayout(sx, sz)
      const inLot = (r: Rect) => Math.abs(r.x) + r.w / 2 <= t.L / 2 && Math.abs(r.z) + r.d / 2 <= t.D / 2
      const blocks = [t.wing, ...t.sides, ...(t.lobby ? [t.lobby] : [])]
      for (const r of [...blocks, t.deck]) expect(inLot(r)).toBe(true)
      for (const r of blocks) expect(hit(r, t.deck)).toBe(false)
      // The pool sits inside the deck, with room round it.
      expect(t.pool.w).toBeGreaterThan(1)
      expect(Math.abs(t.pool.x - t.deck.x) + t.pool.w / 2).toBeLessThanOrEqual(t.deck.w / 2 - 0.4)
      expect(Math.abs(t.pool.z - t.deck.z) + t.pool.d / 2).toBeLessThanOrEqual(t.deck.d / 2)
      // Loungers stand on the deck, not in the water.
      for (const l of t.loungers) {
        expect(hit({ x: l.x, z: l.z, w: 0.17, d: 0.36 }, t.pool)).toBe(false)
        expect(hit({ x: l.x, z: l.z, w: 0.17, d: 0.36 }, t.deck)).toBe(true)
      }
      // The doors face the road, in front of a building.
      expect(t.door[1]).toBeLessThan(t.D / 2 - 0.12)
      expect(blocks.some((r) => Math.abs(t.door[0] - r.x) < r.w / 2 && Math.abs(t.door[1] - 0.12 - (r.z + r.d / 2)) < 1e-6)).toBe(true)
    })
  }

  it('sends guests in at the lobby doors', () => {
    const b = (uid: string, x: number, z: number, extra: Partial<PlacedBuilding> = {}): PlacedBuilding => ({ uid, def: 'motel', x, z, jobEndsAt: null, level: 9, ...extra })
    const doors = storeDoors([b('a', 0, 0, { merge: 21 }), b('b', 2, 0)], new Set(['0,1', '1,1', '2,1', '3,1']))
    expect([...doors.keys()].sort()).toEqual(['ba', 'bb'])
    expect(storeDoors([b('a', 0, 0, { merge: 21, level: 6 }), b('b', 2, 0, { level: 6 })], new Set()).size).toBe(0)
  })
})
