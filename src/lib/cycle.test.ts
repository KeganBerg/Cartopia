import { describe, expect, it } from 'vitest'
import { cycle } from './cycle'

describe('cycle', () => {
  it('wraps negative numbers onto the list', () => {
    expect(cycle(['a', 'b', 'c'], -1)).toBe('c')
    expect(cycle(['a', 'b', 'c'], -3)).toBe('a')
    expect(cycle(['a', 'b', 'c'], 4)).toBe('b')
  })
  // World.tsx picks a street prop with cycle(PROPS, x * 5 + z * 3); PROPS has nine kinds.
  const PROPS = ['bin', 'news', 'mail', 'bollards', 'planter', 'sign', 'box', 'bikes', 'meter']
  it('gives a street prop for every road tile, negative ones included', () => {
    // ifinishfast's town had a straight road at -8,-8, where (x*5+z*3) % 9 was -1.
    for (let x = -40; x <= 40; x++) for (let z = -40; z <= 40; z++) expect(PROPS).toContain(cycle(PROPS, x * 5 + z * 3))
  })
})
