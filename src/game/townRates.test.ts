import { describe, expect, it } from 'vitest'
import { townRates } from './townRates'
import { fuelCap, type PlacedBuilding } from './store'
import { fuelPerMin } from './data'

const at = (def: string, x: number, level = 1): PlacedBuilding => ({ uid: `${def}${x}`, def, x, z: 0, jobEndsAt: null, level })

describe('townRates', () => {
  it('adds up every job an hour: a pizza place every 30s, a diner every 5 minutes', () => {
    const r = townRates({ level: 5, buildings: [at('pizza', 0), at('diner', 4), at('house', 8)], cars: [] })
    // Pizza: $60 and 1 fuel every 30s; diner: $600 and 4 fuel every 300s; a house runs no jobs.
    expect(r.coins).toBe(60 * 120 + 600 * 12)
    expect(r.fuelUse).toBe(1 * 120 + 4 * 12)
    expect(r.parts).toBe(0)
    expect(r.jobs).toBe(2)
  })

  it('refills at the regen rate and reports the whole tank', () => {
    const buildings = [at('house', 0, 4), at('pizza', 4)]
    const r = townRates({ level: 5, buildings, cars: [] })
    expect(r.fuelIn).toBe(fuelPerMin(5) * 60)
    expect(townRates({ level: 30, buildings, cars: [] }).fuelIn).toBe(180)
    expect(r.tank).toBe(fuelCap({ level: 5, buildings }))
  })

  it('counts a higher level as faster jobs that pay more', () => {
    const low = townRates({ level: 5, buildings: [at('pizza', 0, 1)], cars: [] })
    const high = townRates({ level: 5, buildings: [at('pizza', 0, 6)], cars: [] })
    expect(high.coins).toBeGreaterThan(low.coins)
    expect(high.fuelUse).toBeGreaterThanOrEqual(low.fuelUse)
  })

  it('leaves out wild trees and rocks', () => {
    expect(townRates({ level: 5, buildings: [at('wildoak', 0)], cars: [] }).jobs).toBe(0)
  })
})
