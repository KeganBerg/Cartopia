// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import { sameBuilding, shapeOf } from './World'
import type { PlacedBuilding } from '../game/store'

// Collect All swaps every building object at once (job timers). The town must
// not re-render for that, only for changes that show.
const shop: PlacedBuilding = { uid: 'a', def: 'pizza', x: 2, z: 3, rot: 1, jobEndsAt: null }
const roads = new Set<string>()
const props = (b: PlacedBuilding) => ({ b, roads })

describe('town re-renders on Collect All', () => {
  it('ignores job timers', () => {
    const busy = { ...shop, jobEndsAt: Date.now() + 30000, jobLevel: 2 }
    expect(shapeOf([shop])).toBe(shapeOf([busy]))
    expect(sameBuilding(props(shop), props(busy))).toBe(true)
  })

  it('still updates when a building moves, turns, levels or merges', () => {
    for (const change of [{ x: 4 }, { rot: 2 }, { level: 3 }, { merge: 1 }, { mturn: 1 }, { def: 'donut' }]) {
      const next = { ...shop, ...change }
      expect(shapeOf([shop])).not.toBe(shapeOf([next]))
      expect(sameBuilding(props(shop), props(next))).toBe(false)
    }
  })
})
