import { describe, expect, it } from 'vitest'
import { travelLayout, isTravelCenter, ISLAND } from './travelCenter'
import { storeDoors } from './storeDoors'
import type { PlacedBuilding } from './store'
import { toWorld } from '../scene/grid'

const BLOCKS: [number, number][] = [[2, 1], [1, 2], [2, 2], [4, 4]]
const b = (uid: string, x: number, z: number, extra: Partial<PlacedBuilding> = {}): PlacedBuilding => ({ uid, def: 'gas', x, z, jobEndsAt: null, level: 7, ...extra })

describe('travel stop layout', () => {
  it('only merged gas stations at level 7+ become one', () => {
    expect(isTravelCenter('gas', 7, [2, 1, 1])).toBe(true)
    expect(isTravelCenter('gas', 10, [2, 2, 2])).toBe(true)
    expect(isTravelCenter('gas', 6, [2, 2, 2])).toBe(false)
    expect(isTravelCenter('gas', 10, [1, 1, 1])).toBe(false)
    expect(isTravelCenter('diner', 10, [2, 2, 2])).toBe(false)
  })

  for (const [sx, sz] of BLOCKS) {
    it(`fits the ${sx}x${sz} block and keeps the walk to the doors clear`, () => {
      const t = travelLayout(sx, sz)
      expect(t.islands.length).toBeGreaterThan(0)
      const inLot = (x: number, z: number, hw: number, hd: number) => Math.abs(x) + hw <= t.L / 2 && Math.abs(z) + hd <= t.D / 2
      expect(inLot(t.store.x, t.store.z, t.store.w / 2, t.store.d / 2)).toBe(true)
      for (const p of t.islands) {
        expect(inLot(p.x, p.z, ISLAND / 2, 0.16)).toBe(true)
        // Nobody walks through a pump island on the way in.
        const onWalk = Math.abs(p.x - t.door[0]) < ISLAND / 2 + 0.2 && p.z > t.door[1]
        const alongFront = p.z + 0.16 > t.D / 2 - 0.25
        expect(onWalk || alongFront).toBe(false)
      }
      if (t.statue) expect(Math.abs(t.statue[2] - (t.D / 2 - 0.12))).toBeGreaterThan(0.3)
      // The doors are in front of the store.
      expect(t.door[1]).toBeGreaterThan(t.store.z + t.store.d / 2)
    })
  }

  it('sends people in at the doors from every lot of the block', () => {
    const blocks = [b('a', 0, 0, { merge: 21 }), b('b', 2, 0)]
    const doors = storeDoors(blocks, new Set(['0,1', '1,1', '2,1', '3,1']))
    expect([...doors.keys()].sort()).toEqual(['ba', 'bb'])
    expect(doors.get('ba')).toBe(doors.get('bb'))
    expect(doors.get('ba')).toHaveLength(2)
    // Facing the road along z = 1: the doors are on the road side of the block,
    // the walk starts at the lot's front edge, and the store is at the far (+x) end.
    const [edge, door] = doors.get('ba')!
    const [cx, cz] = toWorld(1.5, 0)
    const [, fz] = toWorld(1.5, 0.5)
    expect(edge[1]).toBeCloseTo(fz - 0.12, 5)
    expect(door[1]).toBeGreaterThan(cz)
    expect(door[0]).toBeGreaterThan(cx)
    expect(door[0]).toBeCloseTo(edge[0], 5)
    // Not yet a travel stop: no doors.
    expect(storeDoors([b('a', 0, 0, { merge: 21, level: 6 }), b('b', 2, 0, { level: 6 })], new Set()).size).toBe(0)
  })
})
