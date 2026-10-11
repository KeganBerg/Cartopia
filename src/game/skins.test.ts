// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { useGame } from './store'
import { CAR_SETS, MOD_SKINS, SKINS, ownedModSkins, ownedSkins, seasonSkin, skinNumber } from './data'

const car = { uid: 's1', model: 'pip', color: '#fff', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } }
const g = () => useGame.getState()

describe('skin catalogue', () => {
  it('gives every skin its own shader number and a real unlock', () => {
    const ns = SKINS.map((s) => s.n)
    expect(new Set(ns).size).toBe(SKINS.length)
    expect(Math.min(...ns)).toBeGreaterThan(0)
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(SKINS.length)
    for (const s of SKINS) if ('set' in s.unlock) expect(CAR_SETS.map((c) => c.id)).toContain(s.unlock.set)
    expect(skinNumber('nope')).toBe(0)
    expect(skinNumber(null)).toBe(0)
  })
  it('season skins sit on gem tiers of the track', () => {
    for (const s of SKINS) if ('season' in s.unlock) expect(s.unlock.season % 5).toBe(0)
    expect(seasonSkin(1)).toBeUndefined()
  })
  it('works out level and set skins from the save, and adds won ones', () => {
    expect(ownedSkins({ level: 1 })).toEqual([])
    expect(ownedSkins({ level: 3 })).toEqual(['hexcore'])
    expect(ownedSkins({ level: 3, claimedSets: ['daily'], skins: ['aurora'] })).toEqual(['hexcore', 'riptide', 'aurora'])
  })
})

describe('skinning a car', () => {
  it('puts an unlocked skin on free and takes it off', () => {
    useGame.setState({ level: 3, bucks: 0, skins: [], claimedSets: [], cars: [car] })
    expect(g().skinCar('s1', 'hexcore')).toBe(true)
    expect(g().cars[0].skin).toBe('hexcore')
    expect(g().skinCar('s1', null)).toBe(true)
    expect(g().cars[0].skin).toBeUndefined()
  })
  it('sells gem skins once, then they are free on any car', () => {
    useGame.setState({ level: 1, bucks: 40, skins: [], claimedSets: [], cars: [car, { ...car, uid: 's2' }] })
    expect(g().skinCar('s1', 'aurora')).toBe(true)
    expect(g().bucks).toBe(10)
    expect(g().skins).toEqual(['aurora'])
    expect(g().skinCar('s2', 'aurora')).toBe(true)
    expect(g().bucks).toBe(10)
  })
  it('refuses locked skins that are not for sale, and gem skins you cannot afford', () => {
    useGame.setState({ level: 1, bucks: 5, skins: [], claimedSets: [], cars: [car] })
    expect(g().skinCar('s1', 'prismatic')).toBe(false)
    expect(g().skinCar('s1', 'horizon')).toBe(false)
    expect(g().cars[0].skin).toBeUndefined()
    expect(g().bucks).toBe(5)
  })
  it('grants crate skins once', () => {
    useGame.setState({ level: 1, skins: [], claimedSets: [] })
    expect(g().grantSkin('prismatic')).toBe(true)
    expect(g().grantSkin('prismatic')).toBe(false)
    expect(g().grantSkin('nope')).toBe(false)
    expect(g().skins).toEqual(['prismatic'])
  })
})

describe('mod skins', () => {
  const modded = { ...car, uid: 'm1', mods: ['gtwing', 'blower'] }
  it('have their own pool, unlocked apart from body skins', () => {
    expect(new Set(MOD_SKINS.map((s) => s.id)).size).toBe(MOD_SKINS.length)
    for (const s of MOD_SKINS) expect(SKINS.map((b) => b.id)).not.toContain(s.id)
    expect(ownedModSkins({ level: 7, claimedSets: ['tuners'] })).toEqual(['ember', 'hexplate', 'neonpulse'])
    expect(ownedModSkins({ level: 1, modSkins: [] })).toEqual([])
  })
  it('mix and match per fitted part', () => {
    useGame.setState({ level: 7, bucks: 0, modSkins: [], claimedSets: [], cars: [modded] })
    expect(g().skinMod('m1', 'spoiler', 'ember')).toBe(true)
    expect(g().skinMod('m1', 'hood', 'hexplate')).toBe(true)
    expect(g().cars[0].modSkin).toEqual({ spoiler: 'ember', hood: 'hexplate' })
    // No exhaust fitted, so nothing to skin there.
    expect(g().skinMod('m1', 'exhaust', 'ember')).toBe(false)
    expect(g().skinMod('m1', 'spoiler', null)).toBe(true)
    expect(g().cars[0].modSkin).toEqual({ hood: 'hexplate' })
  })
  it('sells gem mod skins once and grants crate ones once', () => {
    useGame.setState({ level: 1, bucks: 40, modSkins: [], claimedSets: [], cars: [modded] })
    expect(g().skinMod('m1', 'spoiler', 'goldleaf')).toBe(true)
    expect(g().bucks).toBe(20)
    expect(g().skinMod('m1', 'hood', 'goldleaf')).toBe(true)
    expect(g().bucks).toBe(20)
    expect(g().skinMod('m1', 'hood', 'starlight')).toBe(false)
    expect(g().grantModSkin('starlight')).toBe(true)
    expect(g().grantModSkin('starlight')).toBe(false)
    expect(g().skinMod('m1', 'hood', 'starlight')).toBe(true)
  })
})
