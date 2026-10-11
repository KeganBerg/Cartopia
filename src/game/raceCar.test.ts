import { describe, expect, it } from 'vitest'
import { CARS } from './data'
import { bestCar, carPi, raceCarOf } from './raceCar'
import { serverCar } from '../lib/serverCar'
import type { OwnedCar } from './store'

const up = (n: number) => ({ engine: n, turbo: n, tires: n, weight: n })
const slow: OwnedCar = { uid: 'a', model: CARS[0].id, color: '#111111', upgrades: up(0) }
const fast: OwnedCar = { uid: 'b', model: CARS[0].id, color: '#222222', upgrades: up(5) }

describe('race car', () => {
  it('is the picked car, or the highest-PI one when none is picked or it was sold', () => {
    expect(bestCar([slow, fast])).toBe(fast)
    expect(raceCarOf([slow, fast], 'a')).toBe(slow)
    expect(raceCarOf([slow, fast], null)).toBe(fast)
    expect(raceCarOf([slow, fast], 'gone')).toBe(fast)
    expect(raceCarOf([], 'a')).toBeUndefined()
  })
})

describe('serverCar', () => {
  const best_car = { name: 'Best', color: '#222222', body: CARS[0].body, pi: carPi(fast) }
  it('shows the picked race car from the save', () => {
    const c = serverCar({ best_car, race_car: 'a', cars: [slow, fast] })!
    expect(c.uid).toBe('a')
    expect(c.pi).toBe(carPi(slow))
    expect(c.color).toBe('#111111')
  })
  it('falls back to best_car and never shows a PI above it', () => {
    expect(serverCar({ best_car, race_car: 'gone', cars: [slow] })!.name).toBe('Best')
    expect(serverCar({ best_car, race_car: null, cars: null })!.pi).toBe(best_car.pi)
    expect(serverCar({ best_car: { ...best_car, pi: 1 }, race_car: 'b', cars: [fast] })!.pi).toBe(1)
    expect(serverCar({ best_car, race_car: 'x', cars: [{ uid: 'x', model: 'not-a-car', upgrades: up(0) }] })!.name).toBe('Best')
    expect(serverCar({ best_car: null })).toBeNull()
  })
})
