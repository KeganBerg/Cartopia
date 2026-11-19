// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { fuelRegenSeconds } from './data'

// The once-a-second tick (App.tsx) must leave a full tank alone: any change to the store
// rewrites the whole save and wakes every subscriber, so writing the time each second made
// the game hitch once a second.
describe('fuel tick', () => {
  beforeEach(() => localStorage.clear())

  it('changes nothing while the tank is full', async () => {
    const { useGame, fuelCap } = await import('./store')
    useGame.setState({ tutorial: 99, level: 20, buildings: [], fuelUpdatedAt: 1000 })
    useGame.setState({ fuel: fuelCap(useGame.getState()) })
    const t0 = Date.now()
    // The first tick may roll the day's goals; only the ticks after it are counted.
    useGame.getState().tick(t0 - 1000)
    const before = useGame.getState()
    let sets = 0
    const stop = useGame.subscribe(() => sets++)
    for (let i = 0; i < 5; i++) useGame.getState().tick(t0 + i * 1000)
    stop()
    expect(sets).toBe(0)
    expect(useGame.getState().fuelUpdatedAt).toBe(before.fuelUpdatedAt)
  })

  it('a tank that stops being full without spending refills from then, not from an old save time', async () => {
    const { useGame, fuelCap } = await import('./store')
    const t0 = Date.now()
    useGame.setState({ tutorial: 99, level: 20, buildings: [], fuelUpdatedAt: t0 - 3_600_000 })
    const cap = fuelCap(useGame.getState())
    useGame.setState({ fuel: cap })
    useGame.getState().tick(t0)
    // The cap grows by one (as a new gas station would) with the old save time still there.
    useGame.setState({ fuel: cap - 1 })
    useGame.getState().tick(t0 + 1000)
    expect(useGame.getState().fuel).toBe(cap - 1)
    expect(useGame.getState().fuelUpdatedAt).toBe(t0)
    const every = fuelRegenSeconds(20) * 1000
    useGame.getState().tick(t0 + every + 10)
    expect(useGame.getState().fuel).toBe(cap)
  })

  it('still refills one by one after spending', async () => {
    const { useGame, fuelCap } = await import('./store')
    const t0 = Date.now()
    useGame.setState({ tutorial: 99, level: 20, buildings: [] })
    const cap = fuelCap(useGame.getState())
    useGame.setState({ fuel: cap - 3, fuelUpdatedAt: t0 })
    const every = fuelRegenSeconds(20) * 1000
    useGame.getState().tick(t0 + every * 2 + 5)
    expect(useGame.getState().fuel).toBe(cap - 1)
    expect(useGame.getState().fuelUpdatedAt).toBe(t0 + every * 2)
  })
})
