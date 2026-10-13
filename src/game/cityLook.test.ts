import { describe, expect, it } from 'vitest'
import { useGame, saveOf } from './store'
import {
  BUILDINGS, DECOR_GROWTH, MAX_DECOR_LEVEL, TOURIST_BONUS_MAX, TOURIST_GAP_MIN, TOURIST_GROUP_MAX, VISIT_GAP_MIN, VISITORS,
  buildingDef, buildingUpgradeCost, maxLevel, themable, touristGroup, touristScore, touristWeight, upgradable,
} from './data'
import { econCatalog } from './econCatalog'
import { COLOR_THEMES, DEFAULT_LIGHTS, LAMP_POSTS, LIGHT_TONES, cleanLights, themeFor } from './cityLook'
import { rollKind } from '../lib/visitors'

const g = () => useGame.getState()

describe('decor levels', () => {
  it('lets gardens, parks, statues and the Clock Tower level up to 5, and no other decor', () => {
    for (const d of BUILDINGS.filter((b) => b.kind === 'decor')) {
      expect(upgradable(d), d.id).toBe(d.id in DECOR_GROWTH)
      if (d.id in DECOR_GROWTH) expect(maxLevel(d)).toBe(MAX_DECOR_LEVEL)
    }
    expect(maxLevel(buildingDef('pizza'))).toBe(10)
  })

  it('costs follow the business curve: 75% of the build price, +50% a level, parts from level 4', () => {
    expect([1, 2, 3, 4].map((l) => buildingUpgradeCost(buildingDef('garden'), l))).toEqual([
      { coins: 3600, parts: 0 }, { coins: 5400, parts: 0 }, { coins: 8100, parts: 0 }, { coins: 12150, parts: 4 },
    ])
    expect(buildingUpgradeCost(buildingDef('clocktower'), 1)).toEqual({ coins: 2650, parts: 0 })
    // The gem-bought Golden Car Statue counts 3 gems as a $3,000 build price.
    expect(buildingUpgradeCost(buildingDef('statue'), 1)).toEqual({ coins: 2250, parts: 0 })
  })

  it('are in the server catalog, with spend and no earnings', () => {
    const b = econCatalog().buildings as Record<string, { up?: { spend: number[]; coins: number[]; xp: number[]; fuel: number[] } }>
    for (const id of Object.keys(DECOR_GROWTH)) {
      const up = b[id].up!
      expect(up.spend.slice(0, 5), id).toEqual([0, 1, 2, 3, 4].map((_, i) => [1, 2, 3, 4].slice(0, i).reduce((n, l) => {
        const c = buildingUpgradeCost(buildingDef(id), l)
        return n + c.coins + c.parts * 50
      }, 0)))
      expect([...up.coins, ...up.xp, ...up.fuel].every((n) => n === 0), id).toBe(true)
    }
    expect(b.tree.up).toBeUndefined()
  })

  it('upgrades through the store and stops at 5', () => {
    useGame.setState({ coins: 1e7, parts: 1000, visiting: null, buildings: [{ uid: 'g1', def: 'garden', x: 0, z: 0, jobEndsAt: null }] })
    for (let i = 0; i < 6; i++) g().upgradeBuilding('g1')
    expect(g().buildings[0].level).toBe(5)
  })
})

describe('city look in the save', () => {
  it('keeps street lights and the city theme, leaving defaults out', () => {
    useGame.setState({ lights: undefined, cityTheme: undefined })
    expect(saveOf(g()).lights).toBeUndefined()
    expect(saveOf(g()).cityTheme).toBeUndefined()
    g().setLights({ tone: 'ice' })
    g().setLights({ post: 'globe' })
    g().setCityTheme('white')
    expect(saveOf(g()).lights).toEqual({ tone: 'ice', post: 'globe' })
    expect(saveOf(g()).cityTheme).toBe('white')
    g().setLights(DEFAULT_LIGHTS)
    g().setCityTheme(null)
    expect(saveOf(g()).lights).toBeUndefined()
    expect(saveOf(g()).cityTheme).toBeUndefined()
  })

  it('drops unknown ids', () => {
    expect(cleanLights({ tone: 'plaid', post: 'neon' })).toBeUndefined()
    expect(cleanLights({ tone: 'rose', post: 'lantern' })).toEqual({ tone: 'rose', post: 'lantern' })
    g().setCityTheme('plaid')
    expect(saveOf(g()).cityTheme).toBeUndefined()
    expect(LIGHT_TONES.length).toBeGreaterThanOrEqual(3)
    expect(LAMP_POSTS.filter((p) => p.id !== 'auto')).toHaveLength(3)
  })

  it('tints one building (a merged block as one) and clears it', () => {
    useGame.setState({ buildings: [{ uid: 'a', def: 'pizza', x: 0, z: 0, jobEndsAt: null }, { uid: 'b', def: 'tree', x: 3, z: 0, jobEndsAt: null }] })
    g().setBuildingTint('a', 'mint')
    expect(saveOf(g()).buildings.find((b) => b.uid === 'a')!.tint).toBe('mint')
    g().setBuildingTint('a', null)
    expect('tint' in saveOf(g()).buildings.find((b) => b.uid === 'a')!).toBe(false)
  })

  it('a building theme wins over the city theme, which skips decor', () => {
    expect(themeFor('rose', 'white', false)?.id).toBe('rose')
    expect(themeFor(undefined, 'white', false)?.id).toBe('white')
    expect(themeFor(undefined, 'white', true)).toBeNull()
    expect(themeFor('noir', 'white', true)?.id).toBe('noir')
    expect(COLOR_THEMES[0].id).toBe('white')
    expect(themable(buildingDef('rock'))).toBe(false)
  })
})

describe('tourists', () => {
  it('scores levels above 1 on growing decor only', () => {
    expect(touristScore([{ def: 'garden' }, { def: 'pizza', level: 9 }])).toBe(0)
    expect(touristScore([{ def: 'garden', level: 5 }, { def: 'statue', level: 3 }, { def: 'tree', level: 4 }])).toBe(6)
  })

  it('come more often with a higher score, up to a cap', () => {
    expect(touristWeight(0)).toBe(VISITORS.tourist.weight)
    expect(touristWeight(5)).toBeGreaterThan(touristWeight(1))
    expect(touristWeight(1000)).toBe(VISITORS.tourist.weight + TOURIST_BONUS_MAX)
    const share = (score: number) => {
      let n = 0
      for (let i = 0; i < 1000; i++) if (rollKind(false, score, (i + 0.5) / 1000) === 'tourist') n++
      return n / 1000
    }
    expect(share(0)).toBeCloseTo(40 / 95, 2)
    expect(share(20)).toBeGreaterThan(0.6)
  })

  it('come in small groups only in grown towns', () => {
    expect(touristGroup(0, 0)).toBe(1)
    expect(touristGroup(4, 0)).toBe(2)
    expect(touristGroup(20, 0)).toBe(TOURIST_GROUP_MAX)
    expect(touristGroup(20, 0.99)).toBe(1)
    for (let s = 0; s < 50; s++) expect(touristGroup(s, 0)).toBeLessThanOrEqual(TOURIST_GROUP_MAX)
  })

  it('never pop up more often than before', () => {
    expect(TOURIST_GAP_MIN).toBeGreaterThanOrEqual(Math.max(5, VISIT_GAP_MIN))
  })
})
