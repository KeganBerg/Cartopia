// World Tour: nine racers, one per country, beaten in order. Each is faster than the last and
// brings a random car near their PI every time you race them. Every win pays coins (more the
// first time), and beating the last racer unlocks Tour Blue, a light blue paint you can't get
// any other way (data.ts PAINTS with earn 'tour'). The tour opens at the Street Racer
// reputation title (game/reputation.ts). The save keeps how many racers are beaten
// (`worldTour`); pay goes through finishRace, so the server guard's coin bank covers it.
import { CARS, PAINTS, performance, type CarDef } from './data'
import type { RaceDist } from './distance'
import type { WorldVenueId } from '../scene/venues'

export type TourRacer = {
  country: string; flag: string; name: string; pi: number; venue: WorldVenueId; night?: boolean; dist: RaceDist
  hello: string; beaten: string
}

export const WORLD_TOUR: TourRacer[] = [
  { country: 'Egypt', flag: '🇪🇬', name: 'Amira Saleh', pi: 30, venue: 'giza', dist: 'quarter', hello: 'The desert is my home track.', beaten: 'The sand was on your side today.' },
  { country: 'India', flag: '🇮🇳', name: 'Dev Kapoor', pi: 38, venue: 'jaipur', dist: 'quarter', hello: 'I learned to drive in Mumbai traffic. Nothing scares me.', beaten: 'Fast hands. Respect.' },
  { country: 'Russia', flag: '🇷🇺', name: 'Nika Volkova', pi: 46, venue: 'moscow', dist: 'quarter', hello: 'Snow is just road you have not met yet.', beaten: 'You did not slide once. Impressive.' },
  { country: 'China', flag: '🇨🇳', name: 'Li Wei', pi: 55, venue: 'shanghai', night: true, dist: 'half', hello: 'The harbor lights will watch you lose.', beaten: 'The harbor saw something new tonight.' },
  { country: 'Australia', flag: '🇦🇺', name: 'Jack Murray', pi: 64, venue: 'sydney', dist: 'half', hello: 'G\'day! Hope you brought sunscreen.', beaten: 'Fair dinkum, that was quick.' },
  { country: 'Italy', flag: '🇮🇹', name: 'Sofia Bianchi', pi: 74, venue: 'rome', dist: 'half', hello: 'In Italy we race for style. And to win.', beaten: 'Bellissimo. You drove like an Italian.' },
  { country: 'UK', flag: '🇬🇧', name: 'Oliver Hart', pi: 84, venue: 'london', night: true, dist: 'mile', hello: 'Jolly good. Shall we get on with it?', beaten: 'Well raced. Top marks.' },
  { country: 'Brazil', flag: '🇧🇷', name: 'Rafa Costa', pi: 95, venue: 'rio', night: true, dist: 'mile', hello: 'Carnival speed. Try to keep up!', beaten: 'You dance on the throttle, my friend.' },
  { country: 'USA', flag: '🇺🇸', name: 'Ace Walker', pi: 108, venue: 'vegas', dist: 'mile', hello: 'Last stop. Nobody gets past the USA.', beaten: 'World champion. Go paint that car.' },
]

export const TOUR_BLUE = PAINTS.find((p) => p.earn === 'tour')!.color
// The reputation title (an index into REP_TITLES) that opens the tour.
export const WORLD_TOUR_REP = 1

// What a win pays: double the first time.
export const worldPrize = (i: number, first: boolean) => Math.round(((400 + WORLD_TOUR[i].pi * 12) * (first ? 2 : 1)) / 10) * 10
// How cleanly they shift, rising along the tour.
export const worldShift = (i: number) => Math.min(0.97, 0.5 + i * 0.06)
export const worldDone = (beaten: number | undefined) => (beaten ?? 0) >= WORLD_TOUR.length

const ZERO = { engine: 0, turbo: 0, tires: 0, weight: 0 }
// A random car near their PI (from the five closest), so each race against them is a surprise.
export function worldCar(i: number, rand: () => number = Math.random): CarDef {
  const pi = WORLD_TOUR[i].pi
  const near = CARS.filter((c) => !c.parked).sort((a, b) => Math.abs(performance(a, ZERO) - pi) - Math.abs(performance(b, ZERO) - pi)).slice(0, 5)
  return near[Math.floor(rand() * near.length)]
}
