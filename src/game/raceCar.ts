import { carDef, performance } from './data'
import type { OwnedCar } from './store'

// The car you race with: the one picked in the Race menu (save field raceCar), or your
// highest-PI car until you pick one or after the picked one is sold.
export const carPi = (c: OwnedCar) => performance(carDef(c.model), c.upgrades, c.mods)

export function bestCar(cars: OwnedCar[]): OwnedCar | undefined {
  let best: OwnedCar | undefined
  for (const c of cars) if (!best || carPi(c) > carPi(best)) best = c
  return best
}

export function raceCarOf(cars: OwnedCar[], uid: string | null | undefined): OwnedCar | undefined {
  return (uid ? cars.find((c) => c.uid === uid) : undefined) ?? bestCar(cars)
}
