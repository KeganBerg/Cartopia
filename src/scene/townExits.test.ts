import { describe, expect, it } from 'vitest'
import { townExits } from './townExits'

// The fence and lanterns at the town line only care about roads on a plot's edge tiles,
// so painting inside town mustn't change what they're built from.
describe('townExits', () => {
  it('keeps edge-tile roads and drops the rest', () => {
    expect(townExits(['3,3', '4,4', '0,3', '7,5', '3,15', '-1,4', '9,9'])).toBe('-1,4|0,3|3,15|7,5')
  })
  it('is the same whatever order the roads were painted in', () => {
    expect(townExits(['7,5', '0,3'])).toBe(townExits(['0,3', '7,5']))
  })
})
