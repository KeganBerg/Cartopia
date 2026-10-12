import { describe, expect, it } from 'vitest'
import { marketLayout, isMarketCenter, BAY_W, BAY_D } from './marketCenter'
import { storeDoors } from './storeDoors'
import type { PlacedBuilding } from './store'

const BLOCKS: [number, number][] = [[2, 1], [1, 2], [2, 2], [4, 4]]

describe('supercenter layout', () => {
  it('only merged markets at level 7+ become one', () => {
    expect(isMarketCenter('market', 7, [2, 1, 1])).toBe(true)
    expect(isMarketCenter('market', 10, [1, 1, 2])).toBe(true)
    expect(isMarketCenter('market', 6, [2, 2, 2])).toBe(false)
    expect(isMarketCenter('market', 10, [1, 1, 1])).toBe(false)
    expect(isMarketCenter('gas', 10, [2, 2, 2])).toBe(false)
  })

  for (const [sx, sz] of BLOCKS) {
    it(`fits the ${sx}x${sz} block with a clear walk to the doors`, () => {
      const t = marketLayout(sx, sz)
      const { store: s, door } = t
      const inLot = (x: number, z: number, hw: number, hd: number) => Math.abs(x) + hw <= t.L / 2 && Math.abs(z) + hd <= t.D / 2
      expect(inLot(s.x, s.z, s.w / 2, s.d / 2)).toBe(true)
      expect(door[1]).toBeGreaterThan(s.z + s.d / 2)
      expect(door[1]).toBeLessThan(t.D / 2 - 0.12)
      expect(t.bays.length).toBeGreaterThan(0)
      const hit = (ax: number, az: number, aw: number, ad: number, bx: number, bz: number, bw: number, bd: number) =>
        Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(az - bz) < (ad + bd) / 2
      for (const b of t.bays) {
        expect(inLot(b.x, b.z, BAY_W / 2, BAY_D / 2)).toBe(true)
        expect(hit(b.x, b.z, BAY_W, BAY_D, s.x, s.z, s.w, s.d + 0.7)).toBe(false)
        if (t.garden) expect(hit(b.x, b.z, BAY_W, BAY_D, t.garden.x, t.garden.z, t.garden.w, t.garden.d)).toBe(false)
        // Nobody walks through a parked car on the way in.
        expect(Math.abs(b.x - door[0]) < BAY_W / 2 + 0.25 && b.z > door[1]).toBe(false)
        for (const [lx, lz] of t.lamps) expect(hit(b.x, b.z, BAY_W, BAY_D, lx, lz, 0.14, 0.14)).toBe(false)
      }
    })
  }

  it('sends shoppers in at the supercenter doors', () => {
    const b = (uid: string, x: number, z: number, extra: Partial<PlacedBuilding> = {}): PlacedBuilding => ({ uid, def: 'market', x, z, jobEndsAt: null, level: 8, ...extra })
    const doors = storeDoors([b('a', 0, 0, { merge: 21 }), b('b', 2, 0)], new Set(['0,1', '1,1', '2,1', '3,1']))
    expect([...doors.keys()].sort()).toEqual(['ba', 'bb'])
    expect(doors.get('ba')).toHaveLength(2)
    expect(storeDoors([b('a', 0, 0, { merge: 21, level: 6 }), b('b', 2, 0, { level: 6 })], new Set()).size).toBe(0)
  })
})
