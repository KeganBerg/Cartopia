import { describe, expect, it } from 'vitest'
import { buildingDef, carDef, knownBuilding } from './data'

describe('unknown ids from newer builds', () => {
  it('gives an unknown building a harmless stand-in instead of crashing', () => {
    const d = buildingDef('crew-house-from-the-future')
    expect(d.parked).toBe(true)
    expect(d.jobSeconds).toBeUndefined()
    expect(d.fuelCap).toBeUndefined()
    expect(d.id).toBe('crew-house-from-the-future')
    expect(buildingDef('crew-house-from-the-future')).toBe(d)
    expect(knownBuilding('pizza')).toBe(true)
    expect(buildingDef('pizza').parked).toBeUndefined()
  })

  it('gives an unknown car a stand-in that keeps its id', () => {
    const c = carDef('future-car')
    expect(c.parked).toBe(true)
    expect(c.id).toBe('future-car')
    expect(c.price).toBe(0)
    expect(carDef('pip').parked).toBeUndefined()
  })
})
