// Where the player is, roughly, and when the sun rises and sets there. The place
// comes from the device's time zone (its main city, see tzCoords.ts), so no
// location prompt is needed. An unknown zone (UTC, a VPN default...) gets fixed
// 6am sunrise and 7pm sunset on the device clock.
import { TZ_COORDS } from './tzCoords'

export type Place = { lat: number; lon: number }

const MIN = 60_000
const DAY = 1440 // minutes
const rad = Math.PI / 180

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

// One solar day: noon, sunrise and sunset as timestamps (ms).
export type SunDay = { noon: number; rise: number; set: number }

// Day of the year (0..365) for a timestamp.
function dayOfYear(ms: number) {
  const d = new Date(ms)
  return (ms - Date.UTC(d.getUTCFullYear(), 0, 1)) / (DAY * MIN)
}

// Minutes the device clock is ahead of UTC at `ms` (follows daylight saving).
const clockAhead = (ms: number) => -new Date(ms).getTimezoneOffset()

// The longitude whose solar time the day is counted in: the real one, or for an
// unknown place the device clock itself.
const lonOf = (place: Place | null, ms: number) => (place ? place.lon : clockAhead(ms) / 4)

// Solar day number at `ms`: the day whose midnight (local solar time) came last.
export const solarDate = (ms: number, place: Place | null = PLACE) => Math.floor((ms / MIN + lonOf(place, ms) * 4) / DAY)

// Sun times for solar day `d`, from the NOAA approximations (good to a few
// minutes, plenty for lighting). Days are kept between 4 and 20 hours long so
// polar summers and winters still get a night and a day.
const cache = new Map<number, SunDay>() // the player's own place, read every frame
export function sunDay(d: number, place: Place | null = PLACE): SunDay {
  if (place !== PLACE) return computeDay(d, place)
  let s = cache.get(d)
  if (!s) {
    if (cache.size > 8) cache.clear()
    cache.set(d, (s = computeDay(d, place)))
  }
  return s
}

function computeDay(d: number, place: Place | null): SunDay {
  const mid = (d * DAY + 720) * MIN
  if (!place) {
    // Device clock 6am to 7pm, so "noon" is 12:30.
    const noon = (d * DAY + 750 - clockAhead(mid)) * MIN
    return { noon, rise: noon - 390 * MIN, set: noon + 390 * MIN }
  }
  const n = dayOfYear(mid)
  const b = (2 * Math.PI * (n - 81)) / 364
  const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b) // minutes
  const decl = 23.44 * Math.sin((2 * Math.PI * (n - 81)) / 365) * rad
  const lat = place.lat * rad
  const cosH = (Math.sin(-0.833 * rad) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl))
  const half = Math.min(600, Math.max(120, (Math.acos(Math.max(-1, Math.min(1, cosH))) / rad) * 4))
  const noon = (d * DAY + 720 - place.lon * 4 - eot) * MIN
  return { noon, rise: noon - half * MIN, set: noon + half * MIN }
}

// The solar day whose noon came last at `ms` (a night belongs to the day before it).
export function dayAt(ms: number, place: Place | null = PLACE) {
  let d = solarDate(ms, place)
  if (sunDay(d, place).noon > ms) d--
  else if (sunDay(d + 1, place).noon <= ms) d++
  return d
}

// Southern hemisphere: the seasons run the other way round.
export const south = (place: Place | null = PLACE) => !!place && place.lat < 0
