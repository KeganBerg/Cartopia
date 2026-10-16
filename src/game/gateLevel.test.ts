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

describe('race locks open for the admin only', () => {
  it("rivals, campaign, Grand Prix and Rusty's spots, bay 2 and truck", async () => {
    const { currentRival, RIVALS } = await import('./rivals')
    const { CAMPAIGN, GP_SERIES, RESCUE_SPOTS, TRUCK, BAY2_LEVEL } = await import('./data')
    const player = gateLevel({ level: 1 })
    const admin = gateLevel({ level: 1, admin: true })
    expect(currentRival(player, {}, 0)?.locked).toBe(RIVALS[0].unlockLevel > 1)
    expect(currentRival(admin, {}, 0)?.locked).toBe(false)
    expect(CAMPAIGN.filter((c) => player < c.unlockLevel).length).toBeGreaterThan(0)
    expect(CAMPAIGN.filter((c) => admin < c.unlockLevel)).toEqual([])
    expect(GP_SERIES.filter((s) => player < s.unlockLevel).length).toBeGreaterThan(0)
    expect(GP_SERIES.filter((s) => admin < s.unlockLevel)).toEqual([])
    expect(RESCUE_SPOTS.filter((s) => admin < s.unlockLevel)).toEqual([])
    expect(TRUCK.filter((t) => admin < t.level)).toEqual([])
    expect(admin >= BAY2_LEVEL && player < BAY2_LEVEL).toBe(true)
  })
})
