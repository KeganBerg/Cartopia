// Service trips the town should show: after a fill-up the car drives to the
// gas station, after a tire fix to the tire shop, and a tow hauls it to Rusty's.
export type TripKind = 'gas' | 'tires' | 'tow'

export const tripRequests = new Map<string, TripKind>()

export function requestTrip(uid: string, kind: TripKind) {
  tripRequests.set(uid, kind)
}

// A driver heading to the business it works for (car uid -> building uid).
export const visitRequests = new Map<string, string>()

export function requestVisit(uid: string, building: string) {
  visitRequests.set(uid, building)
}
