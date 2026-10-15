import { describe, expect, it } from 'vitest'
import { PACES, nextPace } from './townPace'

describe('town pace', () => {
  it('drops sharpness first on a sharp screen, then frames', () => {
    const steps: number[] = []
    for (let i: number | null = 1; i != null; i = nextPace(i, 3)) steps.push(i)
    expect(steps.map((i) => PACES[i])).toEqual([PACES[1], PACES[2], PACES[3], PACES[4]])
  })

  it('skips sharpness steps a 1x screen never used', () => {
    expect(nextPace(0, 1)).toBe(4)
    expect(nextPace(4, 1)).toBeNull()
  })

  it('a 1.5x screen skips the 2x step', () => {
    expect(nextPace(0, 1.5)).toBe(2)
  })
})
