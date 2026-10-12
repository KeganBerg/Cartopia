// Car classes: every car belongs to one, by its body. Class Cups (game/cups.ts) are races
// only a car of that class can enter. To change the classes, edit CAR_CLASSES and
// CLASS_OF_BODY: any body left out lands in the last class, so nothing is ever classless.
import { CARS, carDef, type Body, type CarDef } from './data'

export type CarClassId = 'compact' | 'muscle' | 'sport' | 'super' | 'offroad' | 'oddball'
export type CarClass = { id: CarClassId; name: string; icon: string; blurb: string }

export const CAR_CLASSES: CarClass[] = [
  { id: 'compact', name: 'Compact', icon: '🚗', blurb: 'Small, nimble everyday cars' },
  { id: 'muscle', name: 'Muscle', icon: '💪', blurb: 'Big engines, straight lines' },
  { id: 'sport', name: 'Sport', icon: '🏎️', blurb: 'Coupes and roadsters built to corner' },
  { id: 'super', name: 'Super', icon: '🚀', blurb: 'The fastest things on four wheels' },
  { id: 'offroad', name: 'Off-road', icon: '🏔️', blurb: 'Trucks and 4x4s for any ground' },
  { id: 'oddball', name: 'Oddballs', icon: '🤪', blurb: 'Buses, bikes, a tank and the rest' },
]

const CLASS_OF_BODY: Partial<Record<Body, CarClassId>> = {
  compact: 'compact', sedan: 'compact', hatch: 'compact', wagon: 'compact', ev: 'compact',
  muscle: 'muscle', widebody: 'muscle', longnose: 'muscle', classic: 'muscle',
  sports: 'sport', coupe: 'sport', roadster: 'sport', rearengine: 'sport', luxury: 'sport',
  super: 'super', wedge: 'super', prototype: 'super', scissor: 'super', horseshoe: 'super', teardrop: 'super',
  truck: 'offroad', rally: 'offroad', suv: 'offroad', offroad: 'offroad',
  // Everything else (bus, tank, dog van, Tusker, bikes, formula, bubble, van) is an oddball.
}

const FALLBACK = CAR_CLASSES[CAR_CLASSES.length - 1]
export const carClass = (id: string) => CAR_CLASSES.find((c) => c.id === id) ?? FALLBACK
export const classOfBody = (body: Body) => carClass(CLASS_OF_BODY[body] ?? FALLBACK.id)
export const classOf = (model: string) => classOfBody(carDef(model).body)
// The cars in a class that can be owned (not the ones parked for a future update).
export const carsInClass = (id: CarClassId): CarDef[] => CARS.filter((c) => !c.parked && classOfBody(c.body).id === id)
