import { describe, expect, it } from 'vitest'
import { carPi, fetchPlayerCard, profileCars } from './playerCard'
import type { OwnedCar } from '../game/store'

const up = (n: number) => ({ engine: n, turbo: n, tires: n, weight: n })
const car = (uid: string, n: number): OwnedCar => ({ uid, model: 'miata', color: '#d32f2f', upgrades: up(n) })

describe('player card', () => {
  it('lists the cars on show first, then the rest fastest first', () => {
    const cars = [car('a', 0), car('b', 3), car('c', 1), car('d', 2)]
    expect(profileCars(cars, ['c']).map((c) => c.uid)).toEqual(['c', 'b', 'd', 'a'])
    // No picks: the best three are on show, best first.
    expect(profileCars(cars, null).map((c) => c.uid)).toEqual(['b', 'd', 'c', 'a'])
  })

  it('builds a neighbour card with its best PI', async () => {
    const card = await fetchPlayerCard('demo-nitro')
    expect(card?.level).toBe(12)
    expect(card?.cars.length).toBeGreaterThan(0)
    expect(card?.bestPi).toBe(Math.max(...card!.cars.map(carPi)))
    expect(card?.showcase.length).toBe(3)
  })
})
