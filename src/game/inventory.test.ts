// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useGame, saveOf, type PlacedBuilding } from './store'
import { START_LAND } from './data'

const g = () => useGame.getState()
const pizza: PlacedBuilding = { uid: 'p1', def: 'pizza', x: 4, z: 4, jobEndsAt: null, level: 5, car: 'c1', tint: 'mint', rot: 1 }

beforeEach(() => {
  useGame.setState({ buildings: [pizza], stored: [], roads: [], land: [...START_LAND], coins: 100, xp: 0, visiting: null, mode: 'bulldoze', placing: null, placingStored: null })
})

describe('bulldozed buildings go to the inventory', () => {
  it('keeps the level and theme, frees the driver, and pays nothing', () => {
    g().bulldoze(4, 4)
    expect(g().buildings).toHaveLength(0)
    expect(g().coins).toBe(100)
    expect(g().stored).toEqual([{ uid: 'p1', def: 'pizza', x: 4, z: 4, jobEndsAt: null, level: 5, tint: 'mint', rot: 1 }])
  })

  it('saves stored buildings inside buildings, flagged, and loads them back out', () => {
    g().bulldoze(4, 4)
    const save = saveOf(g())
    // The server's guard reads `buildings`, so a stored building keeps its worth and level there.
    expect(save.buildings).toEqual([expect.objectContaining({ uid: 'p1', level: 5, stored: true })])
    expect(save).not.toHaveProperty('stored')
    useGame.setState({ stored: [] })
    g().loadSave(save)
    expect(g().buildings).toHaveLength(0)
    expect(g().stored).toEqual([expect.objectContaining({ uid: 'p1', level: 5 })])
    expect(g().stored![0]).not.toHaveProperty('stored')
  })

  it('places a stored building again for free, same uid and level', () => {
    g().bulldoze(4, 4)
    g().pickStored('p1')
    expect(g()).toMatchObject({ mode: 'place', placing: 'pizza', placingStored: 'p1', placeRot: 1 })
    expect(g().placeStored('p1', 8, 8, 0)).toBe(true)
    expect(g().stored).toHaveLength(0)
    expect(g().buildings).toEqual([expect.objectContaining({ uid: 'p1', x: 8, z: 8, rot: 0, level: 5, tint: 'mint' })])
    expect(g().coins).toBe(100)
    expect(g().xp).toBe(0)
  })

  it("won't place on a taken lot or twice", () => {
    useGame.setState({ buildings: [pizza, { uid: 'd1', def: 'donut', x: 8, z: 8, jobEndsAt: null }] })
    g().bulldoze(4, 4)
    expect(g().placeStored('p1', 8, 8)).toBe(false)
    expect(g().placeStored('p1', 4, 4)).toBe(true)
    expect(g().placeStored('p1', 12, 12)).toBe(false)
    expect(g().buildings).toHaveLength(2)
  })

  it('counts a stored one-of-a-kind building as owned', () => {
    useGame.setState({ buildings: [{ uid: 'cr', def: 'crew', x: 4, z: 4, jobEndsAt: null }], coins: 1e6, level: 50 })
    g().bulldoze(4, 4)
    expect(g().stored).toHaveLength(1)
    expect(g().placeBuilding('crew', 10, 10)).toBe(false)
  })
})
