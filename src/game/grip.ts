// Race conditions: what the weather and the venue do to grip on the strip.
// Rain and snow narrow the perfect-shift window and spin the wheels in the low
// gears; desert dust robs the launch. Tire mods take the edge off, and a grippy
// car (its grip stat) shrugs off some of the spin.
//
// Every effect only ever slows a car down (a narrower window still pays the same
// 1.08 for a perfect shift, and every multiplier is at most 1), so the referee's
// time floors from raceFloor() stay safe without knowing the weather. grip.test.ts checks.
import { FEEL, type WeatherKind } from './weather'
import type { VenueId } from '../scene/venues'
import { fittedMods, modDef, modStats, type CarDef, type UpgradeSlot } from './data'

// How slick the strip is, each 0..1.
export type Surface = { wet: number; snow: number; dust: number }

export function surfaceOf(kind: WeatherKind, venue: VenueId): Surface {
  const f = FEEL[kind]
  return {
    wet: f.rain > 0 ? 0.6 + 0.4 * f.rain : 0,
    // Frostbite Pass has packed snow on the road even on a clear day.
    snow: Math.min(1, (f.snow > 0 ? 0.6 + 0.4 * f.snow : 0) + (venue === 'snow' ? 0.35 : 0)),
    // Red Rock Canyon always has some sand on the strip.
    dust: Math.min(1, f.dust + (venue === 'desert' ? 0.35 : 0)),
  }
}

// A car's grip stat with its Garage tires and fitted mods, as performance() counts it.
export const carGrip = (car: CarDef, up: Record<UpgradeSlot, number>, mods?: string[] | null) =>
  car.grip + up.tires * 4 + Object.values(fittedMods(mods, car.body)).reduce((a, id) => a + modStats(id).grip, 0)

// The car's own grip stat (about 25..100) takes up to half the spin away.
const gripShare = (grip: number) => Math.min(1, Math.max(0, grip / 100)) * 0.5

export type Conditions = {
  surface: Surface // what's left after the tires
  lo: number // perfect-shift window
  hi: number
  spin: number // 0..1 wheelspin in first gear (half in second)
  dust: number // 0..1 launch loss in the first 1.5 s
}

export const CLEAR: Conditions = { surface: { wet: 0, snow: 0, dust: 0 }, lo: 0.78, hi: 0.93, spin: 0, dust: 0 }

export function conditions(kind: WeatherKind, venue: VenueId, grip: number, mods?: string[] | null): Conditions {
  const raw = surfaceOf(kind, venue)
  // The fitted tires (the mod's `tread`: how much of each slick surface they cancel).
  const tire = (Array.isArray(mods) ? mods : []).map((id) => modDef(id)).find((m) => m?.slot === 'tires')?.tread ?? {}
  const s: Surface = {
    wet: raw.wet * (1 - (tire.wet ?? 0)),
    snow: raw.snow * (1 - (tire.snow ?? 0)),
    dust: raw.dust * (1 - (tire.dust ?? 0)),
  }
  const narrow = 0.025 * s.wet + 0.035 * s.snow
  const hold = 1 - gripShare(grip)
  return {
    surface: s,
    lo: CLEAR.lo + narrow,
    hi: CLEAR.hi - narrow,
    spin: Math.min(0.6, (0.4 * s.wet + 0.55 * s.snow) * hold),
    dust: Math.min(0.5, 0.5 * s.dust * hold),
  }
}

// What the strip does to this frame's push. Wheelspin bites hardest high in the rev range.
export function gripMul(c: Conditions, gear: number, rpm: number, t: number) {
  let m = 1
  if (c.spin > 0 && gear <= 1) m *= 1 - c.spin * (gear === 0 ? 1 : 0.5) * (0.5 + 0.5 * Math.min(1, rpm))
  if (c.dust > 0 && gear === 0 && t < 1.5) m *= 1 - c.dust
  return m
}

// Whether the wheels are visibly spinning right now (for tire smoke and the "Wheelspin!" flash).
export const spinning = (c: Conditions, gear: number, rpm: number, t: number) => gripMul(c, gear, rpm, t) < 0.9

// A one-line, emoji-led note for the race intro, or null on a clean dry strip.
export function conditionsNote(c: Conditions): string | null {
  const s = c.surface
  const worst = Math.max(s.wet, s.snow, s.dust)
  if (worst < 0.05) return null
  if (s.snow === worst) return '❄️ Icy strip: tight shifts, wheelspin'
  if (s.wet === worst) return '🌧️ Wet strip: tight shifts, wheelspin'
  return '🏜️ Sandy strip: slow launch'
}
