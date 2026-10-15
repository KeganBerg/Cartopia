// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './store'
import { boostsSpent } from './boosts'
import { CARS, PAINTS, PATTERNS, xpToNext } from './data'
import { CAR_CLASSES, carsInClass, classOf, classesOf, inClass } from './classes'
import { CLASS_GOLD, MASTERY_TIERS, carClassTier, classTier, firstPaint, galaxy, masteryMode, noteRace, tierReached, type Mastery } from './mastery'
import { MYSTERY_EVERY, ROAD_POOL, ROAD_STEP, ROAD_STOPS, roadClaim, roadPay, roadReached } from './trophyRoad'
import { CUP_CRATE, CUP_RACES, cupCrateSource, cupFits, cupPrize, cupRacesOf, cupWon } from './cups'
import { paintOpen } from './paintRivals'
import { econCatalog } from './econCatalog'

const up = () => ({ engine: 0, turbo: 0, tires: 0, weight: 0 })
const g = () => useGame.getState()
const MONDAY = Date.UTC(2026, 9, 12, 12)
afterEach(() => vi.restoreAllMocks())

describe('car classes', () => {
  it('are six, and every car is in exactly one', () => {
    expect(CAR_CLASSES.length).toBe(6)
    for (const c of CARS) expect(CAR_CLASSES.map((k) => k.id)).toContain(classOf(c.id).id)
    for (const k of CAR_CLASSES) expect(carsInClass(k.id).length, k.id).toBeGreaterThanOrEqual(3)
  })
  it('put cars where a player would expect', () => {
    expect(classOf('pip').id).toBe('compact')
    expect(classOf('stallion').id).toBe('muscle')
    expect(classOf('miata').id).toBe('sport')
    expect(classOf('zenith').id).toBe('super')
    expect(classOf('trail').id).toBe('offroad')
    expect(classOf('schoolbus').id).toBe('oddball')
  })
  it('give some cars a second tag, never more than two', () => {
    for (const c of CARS) expect(classesOf(c.id).length).toBeLessThanOrEqual(2)
    expect(classesOf('tusker').map((c) => c.id)).toEqual(['oddball', 'offroad'])
    expect(inClass('tusker', 'offroad')).toBe(true)
    expect(carsInClass('offroad').map((c) => c.id)).toContain('tusker')
  })
})

describe('mastery', () => {
  const run = (n: number, won: boolean, mode: Parameters<typeof noteRace>[2] = 'drag', upset = false, from?: Mastery) => {
    let m = from
    for (let i = 0; i < n; i++) m = noteRace(m, won, mode, upset).next
    return m!
  }
  it('reads the mode from the rival', () => {
    expect(masteryMode('camp-ch1-0')).toBe('campaign')
    expect(masteryMode('live:abc')).toBe('live')
    expect(masteryMode('row-ace')).toBe('rival')
    expect(masteryMode('cup-muscle-2')).toBe('cup')
    expect(masteryMode('ai-3')).toBe('drag')
    expect(masteryMode('trial')).toBeNull()
    expect(masteryMode('ghost')).toBeNull()
  })
  it('climbs Bronze, Silver, Signature, Gold in order', () => {
    let m = run(10, false)
    expect(m.tier).toBe(1)
    m = run(10, true, 'drag', false, m)
    expect(m.tier).toBe(2)
    m = run(1, true, 'tour', false, m)
    m = run(1, true, 'event', false, m)
    expect(m.tier).toBe(3)
    m = run(5, true, 'drag', true, m)
    expect(m.tier).toBe(4)
    expect(tierReached(m)).toBe(4)
  })
  it('needs the tiers before it: upsets alone give no Gold', () => {
    const m = run(5, true, 'drag', true)
    expect(m.upsets).toBe(5)
    expect(m.tier).toBe(0)
  })
  it('pays each tier once, in the store', () => {
    useGame.setState({ bucks: 0, trophies: 0, mastery: {}, masteryPrize: null })
    for (let i = 0; i < 10; i++) g().masteryRace('pip', false, 'drag', false)
    expect(g().bucks).toBe(MASTERY_TIERS[0].bucks)
    expect(g().masteryPrize).toEqual({ model: 'pip', tier: 1, classes: [], galaxy: false, first: [], xp: Math.round(0.02 * xpToNext(g().level)) })
    g().masteryRace('pip', false, 'drag', false)
    expect(g().bucks).toBe(MASTERY_TIERS[0].bucks)
    expect(g().mastery?.pip.races).toBe(11)
  })
  it('opens the Signature pattern on that model only', () => {
    useGame.setState({ level: 50, coins: 50000, bucks: 0, mastery: {}, oldPaints: true,
      cars: [{ uid: 'm1', model: 'pip', color: '#e53935', upgrades: up() }] })
    expect(g().paintPanels('m1', { body: { pattern: 'signature' } })).toBe(false)
    useGame.setState({ mastery: { pip: { races: 20, wins: 10, modes: ['drag', 'tour', 'event'], upsets: 0, tier: 3 } } })
    expect(g().paintPanels('m1', { body: { pattern: 'signature' } })).toBe(true)
  })
  it('gives a first win in a class its colour, once', () => {
    useGame.setState({ mastery: {}, masteryPrize: null, rivalRow: {}, oldPaints: false })
    expect(paintOpen(g(), firstPaint('muscle'))).toBe(false)
    g().masteryRace('stallion', false, 'drag', false)
    expect(paintOpen(g(), firstPaint('muscle'))).toBe(false)
    g().masteryRace('stallion', true, 'drag', false)
    expect(g().masteryPrize?.first).toEqual(['muscle'])
    expect(paintOpen(g(), firstPaint('muscle'))).toBe(true)
    useGame.setState({ masteryPrize: null })
    g().masteryRace('stallion', true, 'drag', false)
    expect(g().masteryPrize).toBeNull()
  })
})

describe('class mastery', () => {
  const done: Mastery = { races: 20, wins: 20, modes: ['drag', 'tour', 'event'], upsets: 5, tier: MASTERY_TIERS.length }
  const master = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, done]))
  it('Gold at three cars mastered, Diamond at six, Galaxy with Diamond everywhere', () => {
    const compact = carsInClass('compact').map((c) => c.id)
    expect(classTier(master(compact.slice(0, CLASS_GOLD - 1)), 'compact')).toBe(0)
    expect(classTier(master(compact.slice(0, CLASS_GOLD)), 'compact')).toBe(1)
    expect(classTier(master(compact.slice(0, 6)), 'compact')).toBe(2)
    const all = master(CARS.filter((c) => !c.parked).map((c) => c.id))
    expect(galaxy(all)).toBe(true)
    expect(carClassTier(all, 'pip')).toBe(3)
  })
  it('opens Gold only on cars in that class', () => {
    const compact = carsInClass('compact').map((c) => c.id).filter((id) => id !== 'pip')
    useGame.setState({ level: 50, coins: 50000, bucks: 0, mastery: {}, oldPaints: true,
      cars: [{ uid: 'm1', model: 'pip', color: '#e53935', upgrades: up() }, { uid: 'm2', model: 'stallion', color: '#e53935', upgrades: up() }] })
    const job = { color: '#e53935', finish: 'gold' as const, stripe: null }
    expect(g().paintCar('m1', job)).toBe(false)
    useGame.setState({ mastery: master(compact.slice(0, CLASS_GOLD)) })
    expect(g().paintCar('m1', job)).toBe(true)
    expect(g().paintCar('m2', job)).toBe(false)
    expect(g().paintCar('m1', { ...job, finish: 'diamond' })).toBe(false)
  })
  it('shows the class tier reached in the prize', () => {
    const compact = carsInClass('compact').map((c) => c.id)
    const almost = { ...done, upsets: 4, tier: 3 }
    useGame.setState({ bucks: 0, mastery: { ...master(compact.slice(0, CLASS_GOLD - 1)), [compact[CLASS_GOLD - 1]]: almost }, masteryPrize: null })
    g().masteryRace(compact[CLASS_GOLD - 1], true, 'drag', true)
    expect(g().masteryPrize?.classes).toContainEqual({ cls: 'compact', tier: 1 })
  })
})

describe('Trophy Road', () => {
  it('has a stop every 25 trophies, paying more up to a cap', () => {
    expect(ROAD_STEP).toBe(25)
    expect(roadReached(24)).toBe(0)
    expect(roadReached(50)).toBe(2)
    expect(roadPay(1).coins).toBeGreaterThan(roadPay(0).coins)
    expect(roadPay(ROAD_STOPS + 5)).toEqual(roadPay(ROAD_STOPS))
  })
  it('draws mystery cosmetics only from earned-only ones, never twice', () => {
    for (const id of ROAD_POOL) expect(PAINTS.find((x) => x.color === id)?.earn === 'road' || PATTERNS.find((x) => x.id === id)?.road, id).toBe(true)
    const all = roadClaim(0, ROAD_POOL.length * MYSTERY_EVERY + 10, [])
    expect(new Set(all.items).size).toBe(ROAD_POOL.length)
    expect(all.items.length).toBe(ROAD_POOL.length)
  })
  it('claims every stop reached, once, and opens what the mystery stops gave', () => {
    useGame.setState({ trophies: 110, road: 0, roadItems: [], coins: 0, parts: 0, rivalRow: {}, oldPaints: false })
    g().claimRoad()
    expect(g().road).toBe(4)
    const pay = [0, 1, 2, 3].map(roadPay)
    expect(g().coins).toBe(pay.reduce((a, p) => a + p.coins, 0))
    expect(g().parts).toBe(pay.reduce((a, p) => a + p.parts, 0))
    expect(g().roadItems?.length).toBe(1)
    const won = g().roadItems![0]
    if (PAINTS.some((p) => p.color === won)) expect(paintOpen(g(), won)).toBe(true)
    const coins = g().coins
    g().claimRoad()
    expect(g().coins).toBe(coins)
  })
  it('matches the server catalog', () => {
    const c = econCatalog()
    expect(c.road.step).toBe(ROAD_STEP)
    expect(c.road.stops.length).toBe(ROAD_STOPS)
    expect(c.road.after).toEqual(roadPay(ROAD_STOPS))
    expect(c.mastery.tiers.map((t) => t.bucks)).toEqual(MASTERY_TIERS.map((t) => t.bucks))
  })
})

describe('Class Cups', () => {
  it('give each class three races in its own cars, getting harder', () => {
    for (const k of CAR_CLASSES) {
      const rs = cupRacesOf(k.id)
      expect(rs.length, k.id).toBe(3)
      for (const r of rs) expect(inClass(r.car, k.id)).toBe(true)
      expect(rs[2].pi).toBeGreaterThan(rs[0].pi)
    }
    expect(new Set(CUP_RACES.map((r) => r.id)).size).toBe(CUP_RACES.length)
  })
  it('take a car with either class tag', () => {
    const r = cupRacesOf('muscle')[0]
    expect(cupFits(r, 'stallion')).toBe(true)
    expect(cupFits(r, 'lemans')).toBe(true)
    expect(cupFits(r, 'pip')).toBe(false)
  })
  it('pay double the first time, with a free crate once per race', () => {
    vi.spyOn(Date, 'now').mockReturnValue(MONDAY)
    useGame.setState({ coins: 0, cups: {}, freeCrates: [], cupPrize: null, levelUp: null, boosts: boostsSpent(MONDAY) })
    const [a, b, c] = cupRacesOf('compact')
    g().cupResult(a.id, true)
    expect(g().coins).toBe(cupPrize(a, true))
    expect(g().cupPrize).toBe(a.id)
    expect(g().freeCrates).toEqual([cupCrateSource(a.id)])
    g().cupResult(a.id, true)
    expect(g().freeCrates?.length).toBe(1)
    g().cupResult(b.id, false)
    expect(g().freeCrates?.length).toBe(1)
    g().cupResult(b.id, true)
    g().cupResult(c.id, true)
    expect(g().freeCrates?.length).toBe(3)
    expect(cupWon(g().cups, 'compact')).toBe(true)
    expect(CUP_CRATE).toBe('garage')
  })
})
