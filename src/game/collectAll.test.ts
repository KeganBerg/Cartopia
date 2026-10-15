// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { useGame, collectAllSkips } from './store'
import { buildingDef, flatFixCost, gasCanCost, servicePay } from './data'

const up = { engine: 0, turbo: 0, tires: 0, weight: 0 }
const car = (uid: string, extra: { flat?: boolean; lowFuel?: boolean } = {}) => ({ uid, model: 'pip', color: '#fff', upgrades: up, ...extra })
const b = (uid: string, def: string, jobEndsAt: number | null) => ({ uid, def, x: 0, z: 0, jobEndsAt })
const g = () => useGame.getState()

describe('the lightning button does every chore', () => {
  it('fixes flats and fills up for coins, collects and restarts jobs', () => {
    const past = Date.now() - 1000
    useGame.setState({
      level: 5, xp: 0, coins: 1000, parts: 0, fuel: 100, levelUp: null, tutorial: 99,
      cars: [car('a', { flat: true }), car('b', { lowFuel: true })],
      buildings: [b('p', 'pizza', past), b('q', 'pizza', null)],
    })
    g().collectAll(true)
    const s = g()
    expect(s.cars.every((c) => !c.flat && !c.lowFuel)).toBe(true)
    expect(s.buildings.every((x) => x.jobEndsAt !== null && x.jobEndsAt > Date.now())).toBe(true)
    expect(s.fuel).toBe(100 - 2 * (buildingDef('pizza').fuelCost ?? 0))
    expect(s.stats.flatsFixed).toBeGreaterThanOrEqual(1)
    expect(s.coins).toBeLessThan(1000 + 10_000)
    expect(collectAllSkips()).toMatchObject({ fuel: 0, coins: 0 })
  })

  it('charges exactly the manual prices', () => {
    useGame.setState({ level: 5, xp: 0, coins: 1000, parts: 0, fuel: 0, levelUp: null, cars: [car('a', { flat: true, lowFuel: true })], buildings: [] })
    g().collectAll(true)
    expect(g().coins).toBe(1000 - flatFixCost(5) - gasCanCost(5))
  })

  it('uses your Tire Shop, Gas Station and Rusty instead of paying', () => {
    useGame.setState({
      level: 5, xp: 0, coins: 0, parts: 0, fuel: 0, levelUp: null,
      cars: [car('a', { flat: true, lowFuel: true })],
      buildings: [b('t', 'tires', Date.now() + 600_000), b('g', 'gas', null), b('r', 'rescue', null)],
    })
    g().collectAll(true)
    expect(g().cars[0]).toMatchObject({ flat: false, lowFuel: false })
    expect(g().coins).toBe(servicePay(5, 'tires') + servicePay(5, 'gas'))
  })

  it('tows for free with Rusty when there is no Tire Shop', () => {
    useGame.setState({ level: 5, xp: 0, coins: 0, parts: 0, fuel: 0, levelUp: null, cars: [car('a', { flat: true })], buildings: [b('r', 'rescue', null)] })
    g().collectAll(true)
    expect(g().cars[0].flat).toBe(false)
    expect(g().coins).toBe(0)
  })

  it('pays for a repair with coins it just collected', () => {
    const past = Date.now() - 1000
    useGame.setState({ level: 5, xp: 0, coins: 0, parts: 0, fuel: 0, levelUp: null, cars: [car('a', { flat: true })], buildings: [b('p', 'pizza', past), b('p2', 'pizza', past), b('p3', 'pizza', past), b('p4', 'pizza', past), b('p5', 'pizza', past)] })
    g().collectAll(true)
    expect(g().cars[0].flat).toBe(false)
  })

  it('skips only what it cannot afford and says so with an icon', () => {
    useGame.setState({ level: 5, xp: 0, coins: 0, parts: 0, fuel: 0, levelUp: null, cars: [car('a', { flat: true }), car('b', { lowFuel: true })], buildings: [b('q', 'pizza', null)] })
    g().collectAll(true)
    expect(g().cars.map((c) => [c.flat, c.lowFuel])).toEqual([[true, undefined], [undefined, true]])
    expect(g().buildings[0].jobEndsAt).toBe(null)
    expect(collectAllSkips()).toMatchObject({ fuel: 1, coins: 2 })
  })
})
