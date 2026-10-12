import { describe, expect, it } from 'vitest'
import { parseSplits, withRun } from './bestSplits'

describe('best split times on this device', () => {
  it('reads back only whole, sensible runs', () => {
    expect(parseSplits(null)).toEqual({})
    expect(parseSplits('not json')).toEqual({})
    expect(parseSplits(JSON.stringify({
      'main:400': { t: 11, splits: [4, 6, 8] },
      'pier:400': { t: 11, splits: [4, 6] },
      'dock:400': { t: 11, splits: [4, 6, 12] },
      'bad:400': null,
    }))).toEqual({ 'main:400': { t: 11, splits: [4, 6, 8] } })
  })

  it('keeps a run only when it beats the best on that strip', () => {
    const first = withRun({}, 'main:400', 11, [4, 6, 8])
    expect(first).toEqual({ 'main:400': { t: 11, splits: [4, 6, 8] } })
    expect(withRun(first, 'main:400', 11.5, [3, 5, 7])).toBe(first)
    expect(withRun(first, 'main:400', 10.5, [3.9, 5.8, 7.7])['main:400'].t).toBe(10.5)
    expect(withRun(first, 'pier:400', 12, [4, 6, 8])['pier:400'].t).toBe(12)
  })

  it('skips a run that missed a checkpoint', () => {
    const holes: number[] = []
    holes[0] = 4
    holes[2] = 8
    expect(withRun({}, 'main:400', 11, holes)).toEqual({})
    expect(withRun({}, 'main:400', 11, [4, 6])).toEqual({})
  })
})
