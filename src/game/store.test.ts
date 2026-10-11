// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { useGame } from './store'
import { carDef, upgradeCost, xpToNext } from './data'

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
