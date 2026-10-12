// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './store'
import { boostsSpent } from './boosts'
import { CARS, PAINTS, PATTERNS } from './data'
import { CAR_CLASSES, carsInClass, classOf } from './classes'
import { MASTERY_TIERS, masteryMode, noteRace, tierReached, type Mastery } from './mastery'
import { ROAD, ROAD_AFTER, ROAD_STEP, roadPrize, roadReached } from './trophyRoad'
import { CUP_RACES, cupFits, cupPaint, cupPrize, cupRacesOf, cupWon } from './cups'
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
    expect(g().masteryPrize).toEqual({ model: 'pip', tier: 1 })
    g().masteryRace('pip', false, 'drag', false)
    expect(g().bucks).toBe(MASTERY_TIERS[0].bucks)
    expect(g().mastery?.pip.races).toBe(11)
  })
  it('opens its finishes and the Signature pattern on that model only', () => {
    useGame.setState({ level: 50, coins: 50000, bucks: 0, mastery: {}, oldPaints: true,
      cars: [{ uid: 'm1', model: 'pip', color: '#e53935', upgrades: up() }, { uid: 'm2', model: 'civic', color: '#e53935', upgrades: up() }] })
    const job = { color: '#e53935', finish: 'bronze' as const, stripe: null }
    expect(g().paintCar('m1', job)).toBe(false)
    useGame.setState({ mastery: { pip: { races: 10, wins: 0, modes: [], upsets: 0, tier: 1 } } })
    expect(g().paintCar('m1', job)).toBe(true)
    expect(g().paintCar('m2', job)).toBe(false)
    expect(g().paintPanels('m1', { body: { pattern: 'signature' } })).toBe(false)
    useGame.setState({ mastery: { pip: { races: 20, wins: 10, modes: ['drag', 'tour', 'event'], upsets: 0, tier: 3 } } })
    expect(g().paintPanels('m1', { body: { pattern: 'signature' } })).toBe(true)
  })
})

describe('Trophy Road', () => {
  it('has a stop every 25 trophies, each paint and pattern earned-only', () => {
    expect(ROAD_STEP).toBe(25)
    expect(roadReached(24)).toBe(0)
    expect(roadReached(50)).toBe(2)
    expect(roadPrize(ROAD.length + 3)).toEqual(ROAD_AFTER)
    for (const p of ROAD) {
      if (p.paint) expect(PAINTS.find((x) => x.color === p.paint)?.earn).toBe('road')
      if (p.pattern) expect(PATTERNS.find((x) => x.id === p.pattern)?.road).toBe(true)
    }
    expect(PAINTS.filter((p) => p.earn === 'road').length).toBe(ROAD.filter((p) => p.paint).length)
  })
  it('claims every stop reached, once, and opens its colours', () => {
    useGame.setState({ trophies: 110, road: 0, coins: 0, parts: 0, rivalRow: {}, oldPaints: false })
    expect(paintOpen(g(), ROAD[0].paint!)).toBe(false)
    g().claimRoad()
    expect(g().road).toBe(4)
    expect(g().coins).toBe(ROAD[3].coins)
    expect(g().parts).toBe(ROAD[3].parts)
    expect(paintOpen(g(), ROAD[0].paint!)).toBe(true)
    expect(paintOpen(g(), ROAD[4].paint!)).toBe(false)
    g().claimRoad()
    expect(g().coins).toBe(ROAD[3].coins)
  })
  it('matches the server catalog', () => {
    const c = econCatalog()
    expect(c.road.step).toBe(ROAD_STEP)
    expect(c.road.stops.length).toBe(ROAD.length)
    expect(c.mastery.tiers.map((t) => t.bucks)).toEqual(MASTERY_TIERS.map((t) => t.bucks))
  })
})

describe('Class Cups', () => {
  it('give each class three races in its own cars, getting harder', () => {
    for (const k of CAR_CLASSES) {
      const rs = cupRacesOf(k.id)
      expect(rs.length, k.id).toBe(3)
      for (const r of rs) expect(classOf(r.car).id).toBe(k.id)
      expect(rs[2].pi).toBeGreaterThan(rs[0].pi)
      expect(PAINTS.find((p) => p.color === cupPaint(k.id))?.earn).toBe('cup')
    }
    expect(new Set(CUP_RACES.map((r) => r.id)).size).toBe(CUP_RACES.length)
  })
  it('only take a car of the class', () => {
    const r = cupRacesOf('muscle')[0]
    expect(cupFits(r, 'stallion')).toBe(true)
    expect(cupFits(r, 'pip')).toBe(false)
  })
  it('pay double the first time and unlock the colour once all three are won', () => {
    vi.spyOn(Date, 'now').mockReturnValue(MONDAY)
    useGame.setState({ coins: 0, cups: {}, cupPrize: null, levelUp: null, boosts: boostsSpent(MONDAY), rivalRow: {}, oldPaints: false })
    const [a, b, c] = cupRacesOf('compact')
    g().cupResult(a.id, true)
    expect(g().coins).toBe(cupPrize(a, true))
    g().cupResult(b.id, true)
    expect(g().cupPrize).toBeNull()
    expect(paintOpen(g(), cupPaint('compact'))).toBe(false)
    g().cupResult(c.id, true)
    expect(g().cupPrize).toBe('compact')
    expect(cupWon(g().cups, 'compact')).toBe(true)
    expect(paintOpen(g(), cupPaint('compact'))).toBe(true)
  })
})
