// Always a challenger: win a quick race and someone a little faster steps up straight away,
// in a car of your race car's class (game/classes.ts), for a bigger prize. Beat them and the
// next one is faster again; lose and the rematch is still there. Nothing to keep in the save:
// the run of challengers lasts while you stay on the result screen's button.
import { CARS, performance, type CarDef } from './data'
import { carsInClass, classOf } from './classes'

export const CHALLENGER_BONUS = 1.5
// Each challenger is about this much faster than the car you just beat (or your own, if that's faster).
export const CHALLENGER_STEP = 1.06

export const CHALLENGER_NAMES = [
  'Rocket Rhonda', 'Clutch Carter', 'Nitro Nell', 'Gearbox Gus', 'Flash Fiona', 'Turbo Tex', 'Slick Sid',
  'Redline Rosa', 'Burnout Benny', 'Apex Ava', 'Drift King Dex', 'Lightning Lou',
]

const ZERO = { engine: 0, turbo: 0, tires: 0, weight: 0 }

// The challenger's PI: a step up from whoever was just beaten, and never below your own car.
export const challengerPi = (beatenPi: number, myPi: number) => Math.max(beatenPi + 2, Math.round(Math.max(beatenPi, myPi) * CHALLENGER_STEP))

// The car they bring: one from your car's class nearest their PI (any car if the class is empty).
export function challengerCar(myModel: string, pi: number): CarDef {
  const pool = carsInClass(classOf(myModel).id)
  const from = pool.length ? pool : CARS.filter((c) => !c.parked)
  return [...from].sort((a, b) => Math.abs(performance(a, ZERO) - pi) - Math.abs(performance(b, ZERO) - pi))[0]
}

// The n-th challenger in a run (0 for the first), beaten car's PI, your car and its PI.
export function makeChallenger(n: number, beatenPi: number, myModel: string, myPi: number, rand: () => number = Math.random) {
  const pi = challengerPi(beatenPi, myPi)
  const car = challengerCar(myModel, pi)
  return {
    id: `chal-${n}`,
    town: CHALLENGER_NAMES[Math.floor(rand() * CHALLENGER_NAMES.length)],
    carName: car.name,
    color: car.colors[Math.floor(rand() * car.colors.length)],
    pi,
    body: car.body,
    model: car.id,
    skill: car.skill,
  }
}
