import { describe, expect, it } from 'vitest'
import { softClipCurve } from './sound'

describe('master soft clip', () => {
  const n = 4097
  const c = softClipCurve(n)
  const at = (x: number) => c[Math.round(((x + 1) / 2) * (n - 1))]

  it('leaves normal levels untouched', () => {
    for (const x of [-0.5, -0.25, 0, 0.1, 0.3, 0.5]) expect(at(x)).toBeCloseTo(x, 3)
  })

  it('rounds off loud peaks instead of clipping', () => {
    expect(at(0.8)).toBeLessThan(0.8)
    expect(at(1)).toBeLessThan(0.9)
    expect(at(-1)).toBeGreaterThan(-0.9)
    for (let i = 1; i < n; i++) expect(c[i]).toBeGreaterThanOrEqual(c[i - 1])
  })
})
