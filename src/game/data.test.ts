import { describe, expect, it } from 'vitest'
import { buildingDef, carDef, knownBuilding, BUILDINGS, MAX_BUILDING_LEVEL, buildingLevel, upgradable, upgradePayout, upgradeJobSeconds, upgradeXp, upgradeFuelCap, buildingUpgradeCost, jobLevel, performance, fittedMods, modStats, modCost, MODS, MOD_SLOTS, ownedMods } from './data'

describe('unknown ids from newer builds', () => {
  it('gives an unknown building a harmless stand-in instead of crashing', () => {
    const d = buildingDef('crew-house-from-the-future')
    expect(d.parked).toBe(true)
    expect(d.jobSeconds).toBeUndefined()
    expect(d.fuelCap).toBeUndefined()
    expect(d.id).toBe('crew-house-from-the-future')
    expect(buildingDef('crew-house-from-the-future')).toBe(d)
    expect(knownBuilding('pizza')).toBe(true)
    expect(buildingDef('pizza').parked).toBeUndefined()
  })

  it('gives an unknown car a stand-in that keeps its id', () => {
    const c = carDef('future-car')
    expect(c.parked).toBe(true)
    expect(c.id).toBe('future-car')
    expect(c.price).toBe(0)
    expect(carDef('pip').parked).toBeUndefined()
  })
})

describe('building upgrades', () => {
  it('treats saves without a level as level 1 with the base stats', () => {
    const d = buildingDef('pizza')
    expect(buildingLevel({})).toBe(1)
    expect(buildingLevel({ level: 0 })).toBe(1)
    expect(buildingLevel({ level: 42 })).toBe(MAX_BUILDING_LEVEL)
    expect(upgradePayout(d, 1)).toBe(d.payout)
    expect(upgradeJobSeconds(d, 1)).toBe(d.jobSeconds)
    expect(upgradeXp(d, 1)).toBe(d.xp)
    expect(upgradeFuelCap(buildingDef('gas'), 1)).toBe(buildingDef('gas').fuelCap)
  })

  it('pays more and finishes sooner every level, and costs more to climb', () => {
    for (const d of BUILDINGS.filter(upgradable)) {
      for (let l = 1; l < MAX_BUILDING_LEVEL; l++) {
        if (d.jobSeconds) {
          expect(upgradePayout(d, l + 1)).toBeGreaterThan(upgradePayout(d, l))
          expect(upgradeJobSeconds(d, l + 1)).toBeLessThanOrEqual(upgradeJobSeconds(d, l))
        } else {
          expect(upgradeFuelCap(d, l + 1)).toBeGreaterThan(upgradeFuelCap(d, l))
        }
        if (l > 1) expect(buildingUpgradeCost(d, l).coins).toBeGreaterThan(buildingUpgradeCost(d, l - 1).coins)
      }
      if (d.jobSeconds) expect(upgradeJobSeconds(d, MAX_BUILDING_LEVEL)).toBeLessThan(d.jobSeconds)
    }
  })

  it('only upgrades businesses, parts makers and gas stations', () => {
    expect(upgradable(buildingDef('pizza'))).toBe(true)
    expect(upgradable(buildingDef('tuner'))).toBe(true)
    expect(upgradable(buildingDef('gas'))).toBe(true)
    expect(upgradable(buildingDef('rescue'))).toBe(false)
    expect(upgradable(buildingDef('tree'))).toBe(false)
    expect(upgradable(buildingDef('rock'))).toBe(false)
    expect(upgradable(buildingDef('from-the-future'))).toBe(false)
  })
})

describe('jobs locked to the level they started at', () => {
  it('pays the starting level after a mid-job upgrade', () => {
    expect(jobLevel({ level: 3 })).toBe(3)
    expect(jobLevel({ level: 4, jobLevel: 3 })).toBe(3)
    expect(jobLevel({ level: 2, jobLevel: 9 })).toBe(2)
  })
})

describe('car mods', () => {
  const none = { engine: 0, turbo: 0, tires: 0, weight: 0 }

  it('adds fitted mod stats to the performance index', () => {
    const pip = carDef('pip')
    const base = performance(pip, none)
    expect(performance(pip, none, [])).toBe(base)
    expect(performance(pip, none, ['flamepipes'])).toBe(Math.round((pip.power + 6) * 0.6 + pip.grip * 0.3 + (100 - pip.weight) * 0.1))
    expect(performance(pip, none, MODS.map((m) => m.id))).toBeGreaterThan(base)
  })

  it('counts one mod per slot and ignores unknown ids', () => {
    expect(fittedMods(['ducktail', 'gtwing', 'future-mod', 'chrome'])).toEqual({ spoiler: 'ducktail', rims: 'chrome' })
    expect(fittedMods(undefined)).toEqual({})
    expect(modStats('future-mod')).toEqual({ power: 0, grip: 0, weight: 0 })
    expect(modCost('future-mod')).toEqual({ coins: 0, parts: 0, bucks: 0 })
  })

  it('stays smaller than maxed Garage upgrades', () => {
    const car = carDef('civic')
    const best = MOD_SLOTS.map((s) => MODS.filter((m) => m.slot === s.id).at(-1)!.id)
    const modGain = performance(car, none, best) - performance(car, none)
    const upGain = performance(car, { engine: 5, turbo: 5, tires: 5, weight: 5 }) - performance(car, none)
    expect(modGain).toBeGreaterThan(5)
    expect(modGain).toBeLessThan(upGain / 2)
  })

  it('prices every mod in coins or bucks, never both', () => {
    for (const m of MODS) {
      expect(new Set(MODS.map((x) => x.id)).size).toBe(MODS.length)
      expect(m.bucks > 0).toBe(m.coins === 0 && m.parts === 0)
    }
  })
})

describe('owned mods', () => {
  it('owns whatever is fitted, plus everything bought for the car', () => {
    expect(ownedMods({ mods: ['gtwing'] })).toEqual(['gtwing'])
    expect(ownedMods({ mods: ['gtwing'], ownedMods: ['ducktail', 'gtwing', 'future-mod'] })).toEqual(['ducktail', 'gtwing'])
    expect(ownedMods({})).toEqual([])
  })
})
