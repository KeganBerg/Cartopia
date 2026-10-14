import { describe, expect, it } from 'vitest'
import { UNLOCKS, unlocked, type Unlock } from './unlocks'

type S = Parameters<typeof unlocked>[0]
const at = (tutorial: number, level = 1, races = 0) => ({ tutorial, level, stats: { races }, visiting: null }) as unknown as S
const shown = (s: S) => (Object.keys(UNLOCKS) as Unlock[]).filter((id) => unlocked(s, id))

describe('buttons arrive one at a time for new players', () => {
  it('starts with nothing but coins and level', () => {
    expect(shown(at(0))).toEqual([])
  })
  it('follows the tutorial', () => {
    expect(shown(at(1))).toEqual(['fuel'])
    expect(shown(at(3))).toEqual(['fuel', 'shop'])
    expect(shown(at(8))).toEqual(['fuel', 'shop', 'edit', 'parts', 'cars', 'race'])
  })
  it('social and season wait for levels after the tutorial', () => {
    expect(shown(at(99, 1))).not.toContain('social')
    expect(shown(at(99, 2))).toContain('social')
    expect(shown(at(99, 2))).not.toContain('season')
    expect(shown(at(99, 3))).toEqual(Object.keys(UNLOCKS))
  })
  it("shows everything in a friend's town", () => {
    expect(shown({ ...at(0), visiting: { townName: 'x' } } as unknown as S)).toEqual(Object.keys(UNLOCKS))
  })
})
