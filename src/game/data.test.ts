import { describe, expect, it } from 'vitest'
import { buildingDef, carDef, knownBuilding, BUILDINGS, MAX_BUILDING_LEVEL, buildingLevel, upgradable, upgradePayout, upgradeJobSeconds, upgradeXp, upgradeFuelCap, buildingUpgradeCost } from './data'

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
