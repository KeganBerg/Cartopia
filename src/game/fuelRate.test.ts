import { describe, expect, it } from 'vitest'
import { FUEL_RATE_STEPS, fuelPerMin, fuelRegenSeconds, nextFuelStep } from './data'

describe('fuel refill rate by level', () => {
  it('keeps Kegan\'s steps: 1/min, 2 at level 15, 3 at level 30', () => {
    expect(fuelPerMin(1)).toBe(1)
    expect(fuelPerMin(14)).toBe(1)
    expect(fuelPerMin(15)).toBe(2)
    expect(fuelPerMin(29)).toBe(2)
    expect(fuelPerMin(30)).toBe(3)
    expect(fuelPerMin(200)).toBe(FUEL_RATE_STEPS[FUEL_RATE_STEPS.length - 1].perMin)
  })

  it('never drops as you level and only steps by 1 at a time', () => {
    for (let l = 2; l <= 200; l++) {
      const d = fuelPerMin(l) - fuelPerMin(l - 1)
      expect(d === 0 || d === 1).toBe(true)
    }
  })

  it('refills one fuel in whole seconds', () => {
    for (let l = 1; l <= 200; l++) expect(Number.isInteger(fuelRegenSeconds(l))).toBe(true)
  })

  it('names the next step until the last one', () => {
    expect(nextFuelStep(1)).toEqual({ level: 15, perMin: 2 })
    expect(nextFuelStep(15)).toEqual({ level: 30, perMin: 3 })
    expect(nextFuelStep(100)).toBeNull()
  })
})
