import { describe, expect, it } from 'vitest'
import { FINISHES, PAINT_COST, STRIPE_COST, paintJobCost } from './data'

const car = { color: '#e53935', stripe: null }
const chrome = FINISHES.find((f) => f.id === 'chrome')!.coins

describe('paintJobCost', () => {
  it('is free when nothing changes', () => {
    expect(paintJobCost(car, { color: '#e53935', finish: 'gloss', stripe: null })).toEqual({ coins: 0, bucks: 0 })
  })
  it('charges each changed part once', () => {
    expect(paintJobCost(car, { color: '#1e88e5', finish: 'chrome', stripe: '#fafafa' })).toEqual({ coins: PAINT_COST + chrome + STRIPE_COST, bucks: 0 })
  })
  it('charges a buck, not coins, for neon colours', () => {
    expect(paintJobCost(car, { color: '#76ff03', finish: 'gloss', stripe: null })).toEqual({ coins: 0, bucks: 1 })
  })
  it('lets a car keep its finish and take stripes off for free', () => {
    expect(paintJobCost({ color: '#e53935', finish: 'matte', stripe: '#fafafa' }, { color: '#e53935', finish: 'matte', stripe: null })).toEqual({ coins: 0, bucks: 0 })
  })
})
