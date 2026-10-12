// Where the player is, roughly, from the device's time zone (its main city, see
// tzCoords.ts), so no location prompt is needed. Used to run the seasons the
// right way round; an unknown zone (UTC, a VPN default...) counts as north.
import { TZ_COORDS } from './tzCoords'

export type Place = { lat: number; lon: number }

export function placeOf(zone: string | undefined): Place | null {
  if (!zone) return null
  const i = zone.indexOf('/')
  const list = TZ_COORDS[i < 0 ? '' : zone.slice(0, i)]
  if (!list) return null
  const city = zone.slice(i + 1)
  for (const entry of list.split(',')) {
    const [name, lat, lon] = entry.split(' ')
    if (name === city) return { lat: Number(lat), lon: Number(lon) }
  }
  return null
}

function deviceZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

export const PLACE: Place | null = placeOf(deviceZone())

// Southern hemisphere: the seasons run the other way round.
export const south = (place: Place | null = PLACE) => !!place && place.lat < 0
