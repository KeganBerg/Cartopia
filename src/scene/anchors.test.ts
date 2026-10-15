import { describe, expect, it } from 'vitest'
import { bobAt } from './anchors'

describe('coin bob', () => {
  it('rises 6px and settles back every 0.9s, starting still', () => {
    expect(bobAt(-100)).toBe(0)
    expect(bobAt(0)).toBe(0)
    expect(bobAt(450)).toBeCloseTo(-6)
    expect(bobAt(900)).toBeCloseTo(0)
    expect(bobAt(1350)).toBeCloseTo(-6)
  })
})
