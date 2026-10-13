import { describe, expect, it } from 'vitest'
import { eiaLatest, gasLabel, gasPrice } from './gasPrice'

describe('gas price', () => {
  it('keeps believable pump prices, rounded to the cent', () => {
    expect(gasPrice(4.917)).toBe(4.92)
    expect(gasPrice('5.049')).toBe(5.05)
    expect(gasPrice(0)).toBeNull()
    expect(gasPrice(99)).toBeNull()
    expect(gasPrice('n/a')).toBeNull()
    expect(gasPrice(undefined)).toBeNull()
  })

  it('reads the newest week from an EIA reply', () => {
    const reply = { response: { data: [
      { period: '2026-09-29', value: '4.701' },
      { period: '2026-10-06', value: '4.862' },
    ] } }
    expect(eiaLatest(reply)).toEqual({ price: 4.86, period: '2026-10-06' })
    expect(eiaLatest({ response: { data: [] } })).toBeNull()
    expect(eiaLatest({ error: 'bad key' })).toBeNull()
    expect(eiaLatest(null)).toBeNull()
  })

  it('always shows two decimals', () => {
    expect(gasLabel(5)).toBe('5.00')
    expect(gasLabel(4.9)).toBe('4.90')
  })
})
