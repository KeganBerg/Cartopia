// Race venues: each drag race runs somewhere different. Only the scenery
// changes; the strip, its length and the physics are identical everywhere,
// so the race referee and rewards don't care which venue was picked.

export type VenueId = 'main' | 'beach' | 'desert' | 'snow' | 'farm' | 'docks'

export type Venue = {
  id: VenueId
  name: string
  icon: string
  ground?: string // land colour; missing = the season's grass
  shoulder?: string // strip beside the road; missing = sidewalk pavers
  sky: string // daytime sky
  fog: string // daytime haze
  fogNear: number
  fogFar: number
}

export const VENUES: Venue[] = [
  { id: 'main', name: 'Main Street', icon: '🏙️', sky: '#3d9bff', fog: '#d9f2ff', fogNear: 28, fogFar: 105 },
  { id: 'beach', name: 'Sunset Boardwalk', icon: '🏖️', ground: '#ecd9a6', shoulder: '#a1795a', sky: '#2fa8ff', fog: '#e4f6ff', fogNear: 30, fogFar: 110 },
  { id: 'desert', name: 'Red Rock Canyon', icon: '🏜️', ground: '#d9a066', shoulder: '#c08350', sky: '#4aa3e8', fog: '#f2dcc2', fogNear: 26, fogFar: 110 },
  { id: 'snow', name: 'Frostbite Pass', icon: '🏔️', ground: '#eef3f7', shoulder: '#dde6ee', sky: '#8fbde6', fog: '#e6edf4', fogNear: 18, fogFar: 85 },
  { id: 'farm', name: 'Harvest Backroad', icon: '🌾', shoulder: '#a08a70', sky: '#55aaf5', fog: '#e2f4ff', fogNear: 30, fogFar: 110 },
  { id: 'docks', name: 'Harbor Docks', icon: '⚓', ground: '#9aa3a9', shoulder: '#b3babf', sky: '#5b9bd5', fog: '#d0dce5', fogNear: 24, fogFar: 100 },
]

export const venue = (id: string) => VENUES.find((v) => v.id === id) ?? VENUES[0]

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

let last: VenueId | null = null

// Live races seed the pick with the race id so both players see the same place.
// Otherwise it's random, but never the same venue twice in a row.
// `?venue=desert` pins one, for testing.
const pinned = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('venue')

export function pickVenue(seed?: string, roll = Math.random): Venue {
  if (pinned && VENUES.some((v) => v.id === pinned)) return venue(pinned)
  if (seed) return VENUES[hash(seed) % VENUES.length]
  const pool = VENUES.filter((v) => v.id !== last)
  const v = pool[Math.floor(roll() * pool.length) % pool.length]
  last = v.id
  return v
}
