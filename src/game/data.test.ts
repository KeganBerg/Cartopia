import { describe, expect, it } from 'vitest'
import { buildingDef, carDef, knownBuilding, BUILDINGS, MAX_BUILDING_LEVEL, buildingLevel, upgradable, upgradePayout, upgradeJobSeconds, upgradeXp, upgradeFuelCap, buildingUpgradeCost, jobLevel, houseResidents, levelName, performance, fittedMods, modStats, modCost, MODS, MOD_SLOTS, modFits, ownedMods, CARS, takesDriver, loves, driverPayout, skillBoost, skillDrag, liveSkillBoost, SKILLS , CAMPAIGN, CAMPAIGN_RACES, campaignRivalPi, campaignReward, campaignShift, campaignStars, CAR_SETS, carSource, readySets } from './data'
import { MAX_RACE_PI } from './race'
import { VENUES } from '../scene/venues'

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
        } else if (d.kind === 'house') {
          expect(houseResidents(l + 1)).toBeGreaterThan(houseResidents(l))
          expect(upgradeFuelCap(d, l + 1)).toBe(upgradeFuelCap(d, l) + 1)
        } else {
          expect(upgradeFuelCap(d, l + 1)).toBeGreaterThan(upgradeFuelCap(d, l))
        }
        if (l > 1) expect(buildingUpgradeCost(d, l).coins).toBeGreaterThan(buildingUpgradeCost(d, l - 1).coins)
      }
      if (d.jobSeconds) expect(upgradeJobSeconds(d, MAX_BUILDING_LEVEL)).toBeLessThan(d.jobSeconds)
    }
  })

  it('only upgrades businesses, parts makers, gas stations and houses', () => {
    expect(upgradable(buildingDef('pizza'))).toBe(true)
    expect(upgradable(buildingDef('house'))).toBe(true)
    expect(upgradable(buildingDef('tuner'))).toBe(true)
    expect(upgradable(buildingDef('gas'))).toBe(true)
    expect(upgradable(buildingDef('rescue'))).toBe(false)
    expect(upgradable(buildingDef('tree'))).toBe(false)
    expect(upgradable(buildingDef('rock'))).toBe(false)
    expect(upgradable(buildingDef('from-the-future'))).toBe(false)
  })

  it('grows houses into apartments at 4 and a tower at 7', () => {
    const house = buildingDef('house')
    expect([1, 3, 4, 6, 7, 10].map((l) => levelName(house, l))).toEqual(['House', 'House', 'Apartments', 'Apartments', 'Sky Tower', 'Sky Tower'])
    expect(levelName(buildingDef('pizza'), 8)).toBe(buildingDef('pizza').name)
    expect(houseResidents(1)).toBe(2)
    expect(buildingUpgradeCost(house, 1)).toEqual({ coins: 300, parts: 0 })
    expect([1, 2, 10].map((l) => upgradeFuelCap(house, l))).toEqual([0, 1, 9])
  })
})

describe('drivers', () => {
  it('only loves businesses that take a driver, and every such business has fans', () => {
    for (const c of CARS) {
      expect(c.likes.length, c.id).toBe(3)
      for (const id of c.likes) expect(knownBuilding(id) && takesDriver(buildingDef(id)), `${c.id} -> ${id}`).toBe(true)
    }
    for (const d of BUILDINGS.filter(takesDriver)) {
      expect(CARS.some((c) => loves(c, d.id)), d.id).toBe(true)
    }
  })

  it('pays +10% with any driver and +25% with one that loves the place', () => {
    const pizza = buildingDef('pizza')
    expect(driverPayout(pizza, 1, null)).toBe(60)
    expect(driverPayout(pizza, 1, carDef('trail'))).toBe(66)
    expect(driverPayout(pizza, 1, carDef('pip'))).toBe(75)
    expect(driverPayout(pizza, 3, carDef('pip'))).toBe(Math.round(upgradePayout(pizza, 3) * 1.25))
    expect(takesDriver(buildingDef('gas'))).toBe(false)
    expect(takesDriver(buildingDef('rock'))).toBe(false)
    expect(carDef('future-car').likes).toEqual([])
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
    const best = MOD_SLOTS.map((s) => MODS.filter((m) => m.slot === s.id && modFits(m, car.body)).at(-1)!.id)
    const modGain = performance(car, none, best) - performance(car, none)
    const upGain = performance(car, { engine: 5, turbo: 5, tires: 5, weight: 5 }) - performance(car, none)
    expect(modGain).toBeGreaterThan(5)
    expect(modGain).toBeLessThan(upGain / 2)
  })

  it('gives every vehicle a part for every slot, none stronger than the generic best', () => {
    const top = (s: string, k: 'power' | 'grip') => Math.max(...MODS.filter((m) => m.slot === s && !m.only).map((m) => m[k]))
    for (const c of CARS) for (const s of MOD_SLOTS) expect(MODS.some((m) => m.slot === s.id && modFits(m, c.body))).toBe(true)
    for (const m of MODS.filter((x) => x.only)) {
      expect(m.power).toBeLessThanOrEqual(top(m.slot, 'power'))
      expect(m.grip).toBeLessThanOrEqual(top(m.slot, 'grip') + 1)
    }
  })

  it('ignores parts that do not fit the body, like the server', () => {
    const bike = carDef('shinden')
    expect(fittedMods(['gtwing', 'tailfairing'], bike.body)).toEqual({ spoiler: 'tailfairing' })
    expect(performance(bike, none, ['gtwing'])).toBe(performance(bike, none))
  })

  it('prices every mod in coins or bucks, never both', () => {
    for (const m of MODS) {
      expect(new Set(MODS.map((x) => x.id)).size).toBe(MODS.length)
      expect(m.bucks > 0).toBe(m.coins === 0 && m.parts === 0)
    }
  })
})

describe('race skills', () => {
  const r = (gear: number, dist = 10) => ({ gear, dist })
  it('boosts the owner where each skill says', () => {
    expect(skillBoost('launch', r(0), r(0))).toBe(1.2)
    expect(skillBoost('launch', r(1), r(0))).toBe(1)
    expect(skillBoost('nitro', r(3), r(0))).toBe(1.15)
    expect(skillBoost('slipstream', r(2, 5), r(2, 9))).toBe(1.08)
    expect(skillBoost('slipstream', r(2, 9), r(2, 5))).toBe(1)
    expect(skillBoost('torque', r(1), r(1))).toBe(1.1)
    expect(skillBoost('torque', r(2), r(1))).toBe(1)
    expect(skillBoost(undefined, r(0), r(0))).toBe(1)
  })
  it('slows the other car with Oil Slick and Brain Freeze', () => {
    expect(skillDrag('oil', r(0), 1)).toBe(0.9)
    expect(skillDrag('oil', r(0), 3)).toBe(1)
    expect(skillDrag('freeze', r(1), 5)).toBe(0.9)
    expect(skillDrag('freeze', r(2), 5)).toBe(1)
    expect(skillDrag('launch', r(0), 0)).toBe(1)
    expect(liveSkillBoost('freeze', r(1), r(1), 5)).toBe(1.1)
    expect(liveSkillBoost('oil', r(2), r(1), 1)).toBe(1.1)
  })
  it('gives every skill to at least one car', () => {
    for (const id of Object.keys(SKILLS)) expect(CARS.some((c) => c.skill === id), id).toBe(true)
  })
})

describe('owned mods', () => {
  it('owns whatever is fitted, plus everything bought for the car', () => {
    expect(ownedMods({ mods: ['gtwing'] })).toEqual(['gtwing'])
    expect(ownedMods({ mods: ['gtwing'], ownedMods: ['ducktail', 'gtwing', 'future-mod'] })).toEqual(['ducktail', 'gtwing'])
    expect(ownedMods({})).toEqual([])
  })
})

describe('campaign ladder', () => {
  it('gets harder and pays more the further you go', () => {
    let lastPi = 0, lastPay = 0, lastShift = -1
    CAMPAIGN.forEach((ch, ci) => {
      expect(ch.rivals).toHaveLength(CAMPAIGN_RACES)
      expect(VENUES.map((v) => v.id)).toContain(ch.venue)
      for (let i = 0; i < CAMPAIGN_RACES; i++) {
        expect(campaignRivalPi(ch, i)).toBeGreaterThanOrEqual(lastPi)
        expect(campaignReward(ch, i, true)).toBeGreaterThanOrEqual(lastPay)
        expect(campaignShift(ci, i)).toBeGreaterThanOrEqual(lastShift)
        lastPi = campaignRivalPi(ch, i)
        lastPay = campaignReward(ch, i, true)
        lastShift = campaignShift(ci, i)
      }
      if (ci > 0) {
        expect(ch.coins).toBeGreaterThan(CAMPAIGN[ci - 1].coins)
        expect(ch.unlockLevel).toBeGreaterThan(CAMPAIGN[ci - 1].unlockLevel)
      }
    })
    expect(lastPi).toBeLessThanOrEqual(MAX_RACE_PI)
  })

  it('gives stars by winning margin', () => {
    expect(campaignStars(10, 9)).toBe(0)
    expect(campaignStars(9.9, 10)).toBe(1)
    expect(campaignStars(9.65, 10)).toBe(2)
    expect(campaignStars(9.3, 10)).toBe(3)
  })
})

describe('collection book', () => {
  it('puts every car in exactly one set', () => {
    const all = CAR_SETS.flatMap((s) => s.cars)
    expect([...all].sort()).toEqual(CARS.map((c) => c.id).sort())
  })

  it('says where to find each car', () => {
    expect(carSource(carDef('bug')).text).toBe("Rusty's · Suburbs")
    expect(carSource(carDef('lambo')).text).toBe('Showroom · 💎90')
    expect(carSource(carDef('vette')).text).toBe('Showroom · Lv 15')
  })

  it('lists a set as ready once every car in it is owned and unclaimed', () => {
    const daily = CAR_SETS.find((s) => s.id === 'daily')!
    const cars = daily.cars.map((model) => ({ model }))
    expect(readySets({ cars: cars.slice(1), claimedSets: [] })).toEqual([])
    expect(readySets({ cars, claimedSets: [] })).toEqual([daily])
    expect(readySets({ cars, claimedSets: ['daily'] })).toEqual([])
  })
})
