import { describe, expect, it } from 'vitest'
import { gateLevel, useGame } from './store'
import { CARS } from './data'

// The admin account skips level locks; nobody else does.
describe('gateLevel', () => {
  it('is the player level for players and open for the admin', () => {
    expect(gateLevel({ level: 3 })).toBe(3)
    expect(gateLevel({ level: 3, admin: false })).toBe(3)
    expect(gateLevel({ level: 3, admin: true })).toBeGreaterThan(1000)
  })

  it('lets only the admin past a car level lock', () => {
    const car = CARS.find((c) => c.unlockLevel > 5 && !c.season && !c.rescueOnly && !c.secret && !c.pack)!
    const needs: string[] = []
    useGame.setState({ level: 1, admin: false, showNeed: (kind: string) => void needs.push(kind) } as never)
    useGame.getState().buyCar(car.id, car.colors[0])
    expect(needs).toEqual(['level'])
    useGame.setState({ admin: true })
    useGame.getState().buyCar(car.id, car.colors[0])
    expect(needs).toEqual(['level'])
  })
})
