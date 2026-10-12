// Business hours, purely for looks: after dark, offices empty out window by
// window and shops close at their own times, so the town winds down at night
// instead of every light burning till dawn. Nothing here touches jobs or
// payouts, and no hours are shown anywhere.

// Which closing pattern a building follows. 0 never closes (gas, hospital,
// police...), so a mesh with no hours info (race venues, previews) stays lit.
export const HOURS = { always: 0, office: 1, early: 2, shop: 3, school: 4, evening: 5, late: 6, home: 7 } as const
export type HoursKind = keyof typeof HOURS

const KIND: Record<string, HoursKind> = {
  offices: 'office', hq: 'office', glasstower: 'office',
  coffee: 'early', donut: 'early',
  tires: 'shop', lube: 'shop', parts: 'shop', tuner: 'shop', bodyshop: 'shop', carwash: 'shop', junkyard: 'shop', academy: 'shop',
  school: 'school', highschool: 'school', university: 'school',
  pizza: 'evening', burger: 'evening', tacos: 'evening', icecream: 'evening', arcade: 'evening', bowling: 'evening', cinema: 'evening', market: 'evening', stadium: 'evening', crew: 'evening',
  diner: 'late',
  house: 'home', trailer: 'home',
}

export const hoursOf = (id: string): number => HOURS[KIND[id] ?? 'always']

// A stable 0..1 number from a string (a building's uid), so each building keeps
// its own closing time from one visit to the next.
export function seedOf(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 100000) / 100000
}

// The town clock as hours from noon to the next noon (12..36, midnight is 24),
// so a whole night counts up without wrapping.
export const clockHour = (phase: number) => 12 + phase * 24
