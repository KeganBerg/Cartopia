// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import { sameBuilding, shapeOf } from './World'
import type { PlacedBuilding } from '../game/store'

// Collect All swaps every building object at once (job timers). The town must
// not re-render for that, only for changes that show.
const shop: PlacedBuilding = { uid: 'a', def: 'pizza', x: 2, z: 3, rot: 1, jobEndsAt: null }
const props = (b: PlacedBuilding) => ({ b, turn: 0 })

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

// Opening a panel re-renders App, and switching modes re-renders World. Neither
// may re-run the whole town scene (roads, outskirts, cars): that cost phones
// hundreds of milliseconds per tap in a big town.
describe('town re-renders on panels and modes', () => {
  it('World is memoised', async () => {
    const { World } = await import('./World')
    expect((World as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.memo'))
  })
})
