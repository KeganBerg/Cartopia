// The live side of fairPi.ts: caps an AI rival at what the player's race car can beat right now.
import { CARS, performance, type CarDef, type SkillId } from './data'
import { fairRivalPi } from './fairPi'
import { carPi, raceCarOf } from './raceCar'
import { useGame } from './store'
import { tourPrize, tourRivalPi, tourShift, tourSkills } from './tour'

const stock = { engine: 0, turbo: 0, tires: 0, weight: 0 }

// The race car's PI (the one picked in the Race menu, else the best), or null with no car.
export function raceCarPi() {
  const g = useGame.getState()
  const c = raceCarOf(g.cars, g.raceCar)
  return c ? carPi(c) : null
}

// The rival PI to race: the ladder's, or less when the race car couldn't beat that.
export function fairNow(ladder: number, cleanness: number, skill?: SkillId) {
  const mine = raceCarPi()
  return mine === null ? ladder : fairRivalPi(ladder, mine, cleanness, skill)
}

// The stock car nearest a PI, for rivals without a named car.
export const carNear = (target: number): CarDef =>
  [...CARS].sort((a, b) => Math.abs(performance(a, stock) - target) - Math.abs(performance(b, stock) - target))[0]

// What a Pro Tour race pays the race car: the ladder's prize, or the eased rival's.
export function tourPayNow(race: number) {
  const ladder = tourRivalPi(race)
  return tourPrize(race, fairNow(ladder, tourShift(race), tourSkills(race) ? carNear(ladder).skill : undefined))
}
