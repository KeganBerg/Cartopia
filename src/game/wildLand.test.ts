// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useGame } from './store'
import { BUILDINGS, PLOT, START_LAND, buildingDef } from './data'
import { clearCost, wildPlot, type Wild } from './wildLand'
import { econCatalog } from './econCatalog'

const g = () => useGame.getState()

describe('wild land', () => {
  it('grows the same trees and rocks on the same plot every time', () => {
    expect(wildPlot(3, 1)).toEqual(wildPlot(3, 1))
    expect(wildPlot(3, 1)).not.toEqual(wildPlot(1, 3))
  })

  it('fills each plot with 12 to 16, inside it, one per tile, mostly trees and rocks', () => {
    const all: Wild[] = []
    for (let px = -3; px <= 6; px++) for (let pz = -3; pz <= 6; pz++) {
      const w = wildPlot(px, pz)
      expect(w.length).toBeGreaterThanOrEqual(12)
      expect(w.length).toBeLessThanOrEqual(16)
      expect(new Set(w.map((o) => `${o.x},${o.z}`)).size).toBe(w.length)
      for (const o of w) {
        expect(Math.floor(o.x / PLOT)).toBe(px)
        expect(Math.floor(o.z / PLOT)).toBe(pz)
        expect(buildingDef(o.def).kind).toBe('obstacle')
      }
      all.push(...w)
    }
    const share = (ids: string[]) => all.filter((o) => ids.includes(o.def)).length / all.length
    expect(share(['wildoak', 'wildpine'])).toBeGreaterThan(0.45)
    expect(share(['wildrock'])).toBeGreaterThan(0.2)
  })

  it('costs a little more to bulldoze as the player levels, in 5s', () => {
    const oak = buildingDef('wildoak')
    expect(clearCost(oak, 1)).toBe(oak.price)
    expect(clearCost(oak, 20)).toBeGreaterThan(clearCost(oak, 10))
    for (const l of [1, 7, 13, 40]) expect(clearCost(oak, l) % 5).toBe(0)
  })

  it('leaves the wild ones out of the server catalog, which reads unknown defs as worthless obstacles', () => {
    const wild = BUILDINGS.filter((b) => b.wild)
    expect(wild.length).toBeGreaterThan(0)
    for (const b of wild) {
      expect(b.kind).toBe('obstacle')
      expect(econCatalog().buildings).not.toHaveProperty(b.id)
    }
  })
})

describe('buying and clearing land', () => {
  beforeEach(() => {
    useGame.setState({ buildings: [], stored: [], roads: [], land: [...START_LAND], coins: 100000, xp: 0, level: 10, visiting: null, mode: 'play', placing: null, panel: null })
  })

  it('new land comes with its wild trees and rocks', () => {
    g().buyPlot(3, 1)
    expect(g().land).toContain('3,1')
    expect(g().buildings.map(({ def, x, z }) => ({ def, x, z }))).toEqual(wildPlot(3, 1))
  })

  it('the bulldoze tool clears one for coins and XP, freeing the tile', () => {
    g().buyPlot(3, 1)
    const [first] = g().buildings
    const coins = g().coins
    useGame.setState({ mode: 'bulldoze' })
    g().bulldoze(first.x, first.z)
    expect(g().buildings.find((b) => b.uid === first.uid)).toBeUndefined()
    expect(g().stored ?? []).toHaveLength(0)
    expect(g().coins).toBe(coins - clearCost(buildingDef(first.def), 10))
    expect(g().xp).toBeGreaterThan(0)
  })

  it('a tap in play mode bulldozes it too', () => {
    g().buyPlot(3, 1)
    const [first] = g().buildings
    g().tapBuilding(first.uid)
    expect(g().buildings.find((b) => b.uid === first.uid)).toBeUndefined()
  })

  it('without the coins it stays and asks for them', () => {
    g().buyPlot(3, 1)
    useGame.setState({ coins: 0 })
    const [first] = g().buildings
    g().bulldoze(first.x, first.z)
    expect(g().buildings.find((b) => b.uid === first.uid)).toBeDefined()
    expect(g().panel).toBe('need')
  })

  it('one already paid for under the old timed clearing goes for free', () => {
    useGame.setState({ buildings: [{ uid: 'old', def: 'cactus', x: 4, z: 4, jobEndsAt: Date.now() + 60_000 }] })
    const coins = g().coins
    g().tapBuilding('old')
    expect(g().buildings).toHaveLength(0)
    expect(g().coins).toBe(coins)
  })
})
