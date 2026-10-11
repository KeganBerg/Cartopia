import { describe, expect, it } from 'vitest'
import { showcaseOf, togglePick, SHOWCASE_MAX } from './meet'
import { CARS } from './data'
import type { OwnedCar } from './store'

const up = { engine: 0, turbo: 0, tires: 0, weight: 0 }
const car = (uid: string, model: string, engine = 0): OwnedCar => ({ uid, model, color: '#fff', upgrades: { ...up, engine } })

describe('car meet showcase', () => {
  const cars = [car('a', CARS[0].id), car('b', CARS[0].id, 5), car('c', CARS[1].id), car('d', CARS[0].id, 3)]

  it('shows the best cars when nothing is picked', () => {
    const shown = showcaseOf(cars, [])
    expect(shown).toHaveLength(SHOWCASE_MAX)
    expect(shown.map((c) => c.uid)).toContain('b')
    expect(shown.map((c) => c.uid)).not.toContain('a')
  })

  it('keeps the picks in order and skips sold cars', () => {
    expect(showcaseOf(cars, ['c', 'gone', 'a']).map((c) => c.uid)).toEqual(['c', 'a'])
    expect(showcaseOf(cars, ['gone']).length).toBe(SHOWCASE_MAX)
  })

  it('toggles picks and caps the display', () => {
    expect(togglePick(['a'], 'a')).toEqual([])
    expect(togglePick(['a', 'b', 'c'], 'd')).toEqual(['b', 'c', 'd'])
  })
})
