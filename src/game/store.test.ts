// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { useGame, readyRewards } from './store'
import { CAMPAIGN, CAMPAIGN_RACES, campaignReward, carDef, upgradeCost, xpToNext } from './data'

describe('level-up bonuses', () => {
  it('add on top of a race reward instead of replacing it', () => {
    useGame.setState({ level: 1, xp: xpToNext(1) - 1, coins: 1000, bucks: 10, levelUp: null })
    useGame.getState().finishRace(true, 500)
    const s = useGame.getState()
    expect(s.level).toBe(2)
    expect(s.coins).toBe(1000 + 500 + 200)
    expect(s.bucks).toBe(11)
  })

  it('still charge for a car upgrade that levels you up', () => {
    const car = { uid: 'c1', model: 'pip', color: '#fff', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } }
    useGame.setState({ level: 1, xp: xpToNext(1) - 1, coins: 2500, parts: 10, bucks: 10, levelUp: null, cars: [car] })
    const cost = upgradeCost(carDef('pip'), 0)
    expect(useGame.getState().upgradeCar('c1', 'engine')).toBe(true)
    const s = useGame.getState()
    expect(s.level).toBe(2)
    expect(s.coins).toBe(2500 - cost.coins + 200)
    expect(s.parts).toBe(10 - cost.parts)
  })
})

describe('car mods', () => {
  it('keeps swapped-out parts so they go back on for free', () => {
    const car = { uid: 'm1', model: 'pip', color: '#fff', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } }
    useGame.setState({ level: 10, xp: 0, coins: 10000, parts: 50, bucks: 0, levelUp: null, cars: [car] })
    const g = () => useGame.getState()
    expect(g().modCar('m1', 'ducktail')).toBe(true)
    expect(g().modCar('m1', 'gtwing')).toBe(true)
    expect(g().coins).toBe(10000 - 1200 - 4000)
    expect(g().cars[0].mods).toEqual(['gtwing'])
    expect(g().cars[0].ownedMods).toEqual(['ducktail', 'gtwing'])
    // Back to the ducktail: no charge.
    expect(g().modCar('m1', 'ducktail')).toBe(true)
    expect(g().coins).toBe(10000 - 1200 - 4000)
    expect(g().cars[0].mods).toEqual(['ducktail'])
    // Taking it off keeps it owned.
    expect(g().modCar('m1', 'ducktail', true)).toBe(true)
    expect(g().cars[0].mods).toEqual([])
    expect(g().cars[0].ownedMods).toEqual(['ducktail', 'gtwing'])
  })
})

describe('welcome back report', () => {
  it('previews exactly what Collect All pays', () => {
    const past = Date.now() - 1000
    const later = Date.now() + 600_000
    const b = (uid: string, def: string, jobEndsAt: number | null, level?: number) => ({ uid, def, x: 0, z: 0, jobEndsAt, level })
    useGame.setState({
      level: 5, xp: 0, coins: 0, parts: 0, fuel: 0, levelUp: null,
      cars: [{ uid: 'g1', model: 'pip', color: '#fff', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 }, lowFuel: true }],
      buildings: [b('r', 'rescue', null), b('g', 'gas', null), b('p1', 'pizza', past), b('p2', 'pizza', past, 3), b('t', 'tires', past), b('d', 'diner', later)],
    })
    const r = readyRewards(useGame.getState(), Date.now())
    expect(r.collected).toBe(3)
    expect(r.filled).toBe(1)
    expect(r.jobs.map((j) => [j.def, j.n])).toEqual(expect.arrayContaining([['pizza', 2], ['tires', 1]]))
    useGame.getState().collectAll(true)
    const s = useGame.getState()
    expect(s.coins).toBe(r.coins)
    expect(s.parts).toBe(r.parts)
    expect(s.buildings.find((o) => o.uid === 'd')?.jobEndsAt).toBe(later)
  })
})

describe('campaign', () => {
  const g = () => useGame.getState()
  const start = () => useGame.setState({ level: 20, xp: 0, coins: 0, bucks: 0, trophies: 0, campaign: {}, campaignPrize: null, levelUp: null })

  it('pays the full reward for a first win and less for a replay', () => {
    start()
    const first = campaignReward(CAMPAIGN[0], 0, true)
    expect(g().campaignResult('c1', 0, 9, 9.2)).toBe(1)
    expect(g().coins).toBe(first)
    expect(g().campaign['c1-0']).toBe(1)
    g().campaignResult('c1', 0, 9, 10)
    expect(g().coins).toBe(first + campaignReward(CAMPAIGN[0], 0, false))
    expect(g().campaign['c1-0']).toBe(3)
    // A loss never takes stars away.
    expect(g().campaignResult('c1', 0, 10, 9)).toBe(0)
    expect(g().campaign['c1-0']).toBe(3)
  })

  it('pays the chapter bonus once, and the star bonus once', () => {
    start()
    for (let i = 0; i < CAMPAIGN_RACES; i++) g().campaignResult('c1', i, 9, 9.1)
    const ch = CAMPAIGN[0]
    expect(g().bucks).toBe(ch.bucks)
    expect(g().campaignPrize).toMatchObject({ chapter: 'c1', cleared: true, perfect: false, coins: ch.coins })
    g().campaignResult('c1', 0, 9, 9.1)
    expect(g().bucks).toBe(ch.bucks)
    for (let i = 0; i < CAMPAIGN_RACES; i++) g().campaignResult('c1', i, 9, 10)
    expect(g().bucks).toBe(ch.bucks + ch.starBucks)
    expect(g().campaignPrize).toMatchObject({ cleared: false, perfect: true, coins: 0 })
  })
})
