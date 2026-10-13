import { describe, expect, it } from 'vitest'
import { SPLIT_MARKS, crossings, curveSplits, refSplits, splitDelta, splitLabel } from './splits'
import { ghostDist } from './trial'
import { TRACK } from './race'

describe('split times', () => {
  it('times the ghost at each checkpoint on the curve it drives', () => {
    const splits = curveSplits(12)
    expect(splits).toHaveLength(SPLIT_MARKS.length)
    splits.forEach((t, i) => expect(ghostDist(t, 12)).toBeCloseTo(SPLIT_MARKS[i] * TRACK, 6))
    // Pulling away from the line: the first quarter takes longest.
    expect(splits[0]).toBeGreaterThan(splits[1] - splits[0])
  })

  it('stretches your own best run to the time being chased', () => {
    expect(refSplits(10, { t: 11, splits: [4.4, 6.6, 8.8] })).toEqual([4, 6, 8].map((n) => expect.closeTo(n, 9)))
    expect(refSplits(10, null)).toEqual(curveSplits(10))
    // A run saved before the checkpoints changed falls back to the curve.
    expect(refSplits(10, { t: 11, splits: [5] })).toEqual(curveSplits(10))
  })

  it('finds the checkpoints passed in a step, and when', () => {
    expect(crossings(90, 110, 2, 2.1, 400)).toEqual([{ i: 0, t: expect.closeTo(2.05, 9) }])
    expect(crossings(100, 110, 2, 2.1, 400)).toEqual([])
    expect(crossings(110, 120, 2, 2.1, 400)).toEqual([])
    expect(crossings(0, 400, 0, 1, 400).map((c) => c.i)).toEqual([0, 1, 2])
    // A longer strip moves the checkpoints with it.
    expect(crossings(190, 210, 0, 1, 800).map((c) => c.i)).toEqual([0])
  })

  it('shows the gap to a tenth, green ahead and red behind', () => {
    expect(splitDelta(5.36, 5.76)).toBe(-0.4)
    expect(splitDelta(5.9, 5.7)).toBeCloseTo(0.2, 9)
    expect(splitDelta(5.71, 5.7)).toBe(0)
    expect(Object.is(splitDelta(5.69, 5.7), -0)).toBe(false)
    expect(splitLabel(-0.4)).toBe('-0.4')
    expect(splitLabel(0.2)).toBe('+0.2')
    expect(splitLabel(0)).toBe('0.0')
    expect(splitLabel(1.25)).toBe('+1.3')
  })
})
