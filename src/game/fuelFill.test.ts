import { describe, expect, it } from 'vitest'
import { refillBucks } from './data'

describe('gem fill-up', () => {
  it('costs 1 gem per missing fuel (Kegan 10-17)', () => {
    expect(refillBucks(1)).toBe(1)
    expect(refillBucks(7)).toBe(7)
    expect(refillBucks(40)).toBe(40)
    expect(refillBucks(0.5)).toBe(1)
  })
})
