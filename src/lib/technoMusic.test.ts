import { describe, expect, it } from 'vitest'
import { clipAt, fadeAt } from './technoMusic'
import { BAR_MS, CYCLE_BARS } from '../game/techno'

// Kegan: "only give them a 10 second warning then DROP it ... make it slowly
// transition so it doesn't startle people."
describe('Rave Mode song', () => {
  const loop = (CYCLE_BARS * BAR_MS) / 1000

  it('halcyon: plays the build-up through the warning, then loops the drop', () => {
    expect(clipAt(0)).toBe(0)
    expect(clipAt(9.5)).toBeCloseTo(9.5)
    expect(clipAt(10)).toBeCloseTo(10)
    expect(clipAt(10 + loop + 1)).toBeCloseTo(11)
    expect(clipAt(10 + 3 * loop + 2)).toBeCloseTo(12)
  })

  it('fades in from silence over the warning, gently at first, and is full at the drop', () => {
    expect(fadeAt(0)).toBe(0)
    expect(fadeAt(2)).toBeLessThan(0.05)
    expect(fadeAt(5)).toBeCloseTo(0.25)
    expect(fadeAt(10)).toBe(1)
    expect(fadeAt(40)).toBe(1)
  })
})
