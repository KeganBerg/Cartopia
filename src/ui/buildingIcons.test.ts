import { describe, expect, it } from 'vitest'
import { CARS } from '../game/data'
import { BUILDING_ICONS } from './buildingIcons'

describe('building icons', () => {
  it('every building a car likes has its own icon', () => {
    const liked = [...new Set(CARS.flatMap((c) => c.likes))]
    expect(liked.filter((id) => !BUILDING_ICONS[id])).toEqual([])
  })
})
